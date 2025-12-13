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
					vscode.window.showInformationMessage('⏳ Đang push code lên GitHub...');
					
					// Small delay to ensure file is written
					await new Promise(resolve => setTimeout(resolve, 500));
					
					await classroomViewProvider.handleAutoPush();
					
					// Show success notification
					vscode.window.showInformationMessage('✅ Đã push code lên GitHub!');
					vscode.window.setStatusBarMessage(
						'$(cloud-upload) Auto-pushed to GitHub',
						3000
					);
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
			vscode.window.showErrorMessage(`Auto-push failed: ${error.message}`);
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
					if (branch === 'teacher') {
						role = 'teacher';
					} else if (branch.startsWith('student/')) {
						role = 'student';
					}
					
					// Get class code from folder name
					let classCode = '';
					const match = folderName.match(/^([A-Z0-9]+)-/);
					if (match) {
						classCode = match[1];
					}
					
					// Try to get saved token from globalState
					const classInfo = context.globalState.get<any>('current_class');
					const savedToken = classInfo?.token || token;
					
					if (savedToken) {
						// Update globalState with current workspace info
						await context.globalState.update('current_class', {
							classCode: classCode,
							repoUrl: repoUrl,
							branch: branch,
							token: savedToken,
							role: role
						});
						
						// Initialize git service with detected credentials
						await gitService.initializeWorkspace(workspacePath, {
							token: savedToken,
							repoUrl: repoUrl,
							branch: branch
						});
						
						// Enable auto-push
						gitService.enableAutoPush();
						
						console.log(`Git service restored: role=${role}, branch=${branch}, classCode=${classCode}`);
					} else {
						console.warn('No token found, auto-push disabled');
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
