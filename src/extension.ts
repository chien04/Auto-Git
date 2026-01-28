// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ClassroomViewProvider } from './providers/classroomViewProvider';
import { ApiService } from './services/apiService';
import { GitService } from './services/gitService';
import simpleGit from 'simple-git';

let classroomViewProvider: ClassroomViewProvider;
let apiService: ApiService;
let gitService: GitService;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Auto Git Classroom extension is now active!');
	
	// Check if git is installed
	checkGitInstalled();

	// Initialize services
	apiService = new ApiService('http://localhost:8080/api');
	gitService = new GitService();

	// Create and register webview provider
	classroomViewProvider = new ClassroomViewProvider(
		context.extensionUri,
		context,
		apiService,
		gitService
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ClassroomViewProvider.viewType,
			classroomViewProvider
		)
	);

	// Register commands
	const openClassroomCommand = vscode.commands.registerCommand(
		'auto-git.openClassroom',
		() => {
			vscode.commands.executeCommand('autoGitClassroom.mainView.focus');
		}
	);

	const logoutCommand = vscode.commands.registerCommand(
		'auto-git.logout',
		async () => {
			await context.globalState.update('jwt_token', undefined);
			await context.globalState.update('user_data', undefined);
			await context.globalState.update('current_class', undefined);
			apiService.setToken(null);
			gitService.disableAutoPush();
			vscode.window.showInformationMessage('Đã đăng xuất và xóa dữ liệu');
		}
	);

	context.subscriptions.push(openClassroomCommand, logoutCommand);

	// Setup auto-push on save
	setupAutoPush(context);
	console.log('✅ Auto-push listener registered');

	// Restore git service state if student has joined a class
	restoreGitServiceState(context);
	
	// Listen for workspace folder changes to update UI
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		console.log('[DEBUG] Workspace folders changed, restoring state...');
		restoreGitServiceState(context);
		notifyFrontendOfCurrentWorkspace(context);
	});
}

function notifyFrontendOfCurrentWorkspace(context: vscode.ExtensionContext) {
	try {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return;
		}
		
		const folderName = workspaceFolders[0].uri.fsPath.split(/[\\/]/).pop() || '';
		const assignmentCode = folderName.split('-')[0]; // First part is assignment code
		
		console.log('[DEBUG] Notifying frontend of current workspace:', assignmentCode);
		
		// Send to webview if it exists
		if (classroomViewProvider) {
			classroomViewProvider.notifyWorkspaceChanged(assignmentCode);
		}
	} catch (error) {
		console.error('[DEBUG] Error notifying frontend:', error);
	}
}

function setupAutoPush(context: vscode.ExtensionContext) {
	// Listen to document save events
	const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
		try {
			const classInfo = context.globalState.get<any>('current_class');
			const autoPushEnabled = gitService.isAutoPushEnabled();
			const workspacePath = gitService.getWorkspacePath();
			
			// Debug info
			console.log('=== Save event triggered ===');
			console.log('Class info:', classInfo);
			console.log('Auto-push enabled:', autoPushEnabled);
			console.log('Workspace path:', workspacePath);
			console.log('File path:', document.uri.fsPath);
			
			// Auto-push for both students and teachers
			if (classInfo && (classInfo.role === 'student' || classInfo.role === 'teacher') && autoPushEnabled) {
				// Check if the saved file is in the workspace
				if (workspacePath && document.uri.fsPath.startsWith(workspacePath)) {
					console.log(`Auto-pushing changes for: ${document.fileName}`);
					
					// Small delay to ensure file is written
					await new Promise(resolve => setTimeout(resolve, 500));
					
					try {
						await classroomViewProvider.handleAutoPush(classInfo);
						
						// Only show success message if push succeeded
						vscode.window.showInformationMessage('✅ Đã push code lên GitHub!');
						vscode.window.setStatusBarMessage(
							'$(cloud-upload) Auto-pushed to GitHub',
							3000
						);
					} catch (pushError: any) {
						// Check if it's a deadline error
						if (pushError.message && pushError.message.includes('Deadline')) {
							vscode.window.showErrorMessage('⏰ Đã quá hạn nộp bài!');
						} else {
							vscode.window.showErrorMessage(`Lỗi push code: ${pushError.message}`);
						}
						// Don't re-throw, just return to avoid showing duplicate errors
						return;
					}
				} else {
					console.log('File not in workspace. Workspace:', workspacePath, 'File:', document.uri.fsPath);
					vscode.window.showWarningMessage(`File không trong workspace. WS: ${workspacePath}`);
				}
			} else {
				const reason = !classInfo ? 'No class info' : 
							   (classInfo.role !== 'student' && classInfo.role !== 'teacher') ? 'Not a student or teacher' :
							   !autoPushEnabled ? 'Auto-push disabled' : 'Unknown';
				console.log('Auto-push skipped. Reason:', reason);
			}
		} catch (error: any) {
			console.error('Auto-push error:', error);
			// Don't show error again if already shown in inner catch
			if (!error.message || !error.message.includes('Deadline')) {
				vscode.window.showErrorMessage(`Auto-push failed: ${error.message}`);
			}
		}
	});

	context.subscriptions.push(saveListener);
}

async function restoreGitServiceState(context: vscode.ExtensionContext) {
	try {
		const token = context.globalState.get<string>('jwt_token');

		if (token) {
			apiService.setToken(token);
		}

		// Check if workspace exists
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders && workspaceFolders.length > 0) {
			const workspacePath = workspaceFolders[0].uri.fsPath;
			
			// Try to get class info from workspace folder name
			// Format: CH1H3PT1-student-chiendeep1 or ClassName-ClassCode (teacher)
			const folderName = workspacePath.split(/[\\/]/).pop() || '';
			console.log('Workspace folder name:', folderName);
			
			// Check if this is a git repository
			const git = simpleGit(workspacePath);
			try {
				await git.status();
				
				// Get current branch from git
				const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
				const branch = currentBranch.trim();
				console.log('Current git branch:', branch);
				
				// Get remote URL
				const remotes = await git.getRemotes(true);
				const originRemote = remotes.find((r: any) => r.name === 'origin');
				
				if (originRemote && originRemote.refs.fetch) {
					const repoUrl = originRemote.refs.fetch.replace(/\.git$/, '').replace(/^.*@github\.com[:\/]/, 'https://github.com/');
					console.log('Repository URL:', repoUrl);
					
					// Determine role from branch name
					let role = 'student';
					let assignmentCode = '';
					
					if (branch === 'main' || branch === 'master' || branch === 'teacher') {
						role = 'teacher';
					} else if (branch.startsWith('student/')) {
						role = 'student';
					}
					
					// Get assignment code from folder name
					// Format: {assignmentCode}-{branch} or {classCode}-{assignmentCode} (teacher)
					const folderParts = folderName.split('-');
					if (folderParts.length > 0) {
						assignmentCode = folderParts[0]; // First part is assignment code
					}
					
					// For teacher, if it's classCode-assignmentCode format, get the second part
					if (role === 'teacher' && folderParts.length >= 2) {
						assignmentCode = folderParts[1]; // Second part is assignment code
					}
					
					console.log('Detected assignment code:', assignmentCode, 'role:', role, 'branch:', branch);
					
					// Try to get saved token from globalState
					// For assignment: student_assignment_{assignmentCode} or assignment_{assignmentCode}
					let savedInfo = null;
					let savedToken = null;
					
					if (role === 'student' && assignmentCode) {
						const key = `student_assignment_${assignmentCode}`;
						savedInfo = context.globalState.get<any>(key);
						console.log(`[DEBUG] Looking for student token with key: ${key}`);
						console.log('[DEBUG] Found savedInfo:', savedInfo ? 'YES' : 'NO');
					} else if (role === 'teacher' && assignmentCode) {
						const key = `assignment_${assignmentCode}`;
						savedInfo = context.globalState.get<any>(key);
						console.log(`[DEBUG] Looking for teacher token with key: ${key}`);
						console.log('[DEBUG] Found savedInfo:', savedInfo ? 'YES' : 'NO');
					}
					
					// Fallback to current_class for old format
					if (!savedInfo) {
						console.log('[DEBUG] savedInfo not found, trying current_class fallback');
						savedInfo = context.globalState.get<any>('current_class');
						console.log('[DEBUG] Fallback current_class:', savedInfo ? 'YES' : 'NO');
					}
					
					savedToken = savedInfo?.token || token;
					console.log('[DEBUG] Final token for git service:', savedToken ? 'EXISTS (length: ' + savedToken.length + ')' : 'NULL');
					
					if (savedToken) {
						console.log('[DEBUG] Initializing git service with token...');
						// Update globalState with current workspace info
						const currentInfo = {
							assignmentCode: assignmentCode,
							repoUrl: repoUrl,
							branch: branch,
							token: savedToken,
							role: role,
							deadline: savedInfo?.deadline
						};
						
						await context.globalState.update('current_class', currentInfo);
						console.log('[DEBUG] Updated current_class in globalState');
						
						// Initialize git service with detected credentials
						console.log('[DEBUG] Calling gitService.initializeWorkspace with:', {
							workspacePath,
							hasToken: !!savedToken,
							repoUrl,
							branch
						});
						await gitService.initializeWorkspace(workspacePath, {
							token: savedToken,
							repoUrl: repoUrl,
							branch: branch
						});
						
						// Set assignment info for deadline check (student only)
						if (role === 'student' && assignmentCode) {
							gitService.setClassInfo(apiService, assignmentCode);
						}
						
						// Enable auto-push
						gitService.enableAutoPush();
						
						console.log(`✅ Git service restored: role=${role}, branch=${branch}, assignmentCode=${assignmentCode}, token exists: ${!!savedToken}`);
					} else {
						console.warn('⚠️ No token found, auto-push disabled');
						await gitService.initializeWorkspace(workspacePath);
					}
				}
			} catch (gitError) {
				console.log('Not a git repository or git error:', gitError);
			}
		}
	} catch (error) {
		console.error('Failed to restore git service state:', error);
	}
}

/**
 * Check if git is installed
 */
async function checkGitInstalled() {
	const git = simpleGit();
	try {
		await git.version();
		console.log('Git is installed');
	} catch (error) {
		vscode.window.showErrorMessage(
			'⚠️ Git chưa được cài đặt! Extension cần Git để hoạt động.',
			'Hướng dẫn cài đặt'
		).then(selection => {
			if (selection === 'Hướng dẫn cài đặt') {
				vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/downloads'));
			}
		});
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Auto Git Classroom extension is now deactivated');
}
