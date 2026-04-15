// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { ClassroomViewProvider } from './providers/classroomViewProvider';
import { ApiService } from './services/apiService';
import { GitService } from './services/gitService';
import simpleGit from 'simple-git';

let classroomViewProvider: ClassroomViewProvider;
let apiService: ApiService;
let gitService: GitService;
type WorktreeBranchMap = Map<string, string>;
let cachedWorktreeBranchMap: WorktreeBranchMap = new Map();
let cachedWorktreeRepoRoot = '';
let lastCommentFetchKey = '';
let lastCommentFetchAt = 0;
const inFlightCommentFetches = new Map<string, Promise<void>>();
let suppressCommentAutoLoad = true;

async function closeAllOpenEditors() {
	try {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		console.log('[Startup] Closed all open editors by default.');
	} catch (error: any) {
		console.warn('[Startup] Failed to close all editors:', error?.message || error);
	}
}

interface FileCommentContext {
	assignmentCode: string;
	targetBranch: string;
	studentFilePath: string;
}

class SelectionCommentCodeLensProvider implements vscode.CodeLensProvider {
	private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

	refresh() {
		this._onDidChangeCodeLenses.fire();
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
			return [];
		}

		if (editor.selection.isEmpty) {
			return [];
		}

		const line = editor.selection.start.line;
		return [
			new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
				title: '$(comment-discussion) Comment selected code',
				command: 'auto-git.createCodeCommentFromSelection'
			})
		];
	}
}

function normalizePathForCompare(input: string): string {
	return input.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

async function refreshWorktreeBranchMap(repoRoot: string, forceRefresh: boolean = false): Promise<WorktreeBranchMap> {
	const normalizedRoot = normalizePathForCompare(repoRoot);
	if (!forceRefresh && cachedWorktreeRepoRoot === normalizedRoot && cachedWorktreeBranchMap.size > 0) {
		return cachedWorktreeBranchMap;
	}

	const git = simpleGit(repoRoot);
	const porcelain = await git.raw(['worktree', 'list', '--porcelain']);
	const blocks = porcelain.split(/\r?\n\r?\n/);
	const parsedMap: WorktreeBranchMap = new Map();

	for (const block of blocks) {
		const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
		const worktreeLine = lines.find(l => l.startsWith('worktree '));
		const branchLine = lines.find(l => l.startsWith('branch '));
		if (!worktreeLine || !branchLine) {
			continue;
		}

		const worktreePath = worktreeLine.replace('worktree ', '').trim();
		const fullRef = branchLine.replace('branch ', '').trim();
		const branchName = fullRef.replace(/^refs\/heads\//, '');

		parsedMap.set(normalizePathForCompare(worktreePath), branchName);
	}

	cachedWorktreeRepoRoot = normalizedRoot;
	cachedWorktreeBranchMap = parsedMap;
	return parsedMap;
}

function findBranchForFile(filePath: string, worktreeMap: WorktreeBranchMap): string | null {
	const normalizedFile = normalizePathForCompare(filePath);
	let bestMatchPath = '';
	let bestMatchBranch: string | null = null;

	for (const [worktreePath, branch] of worktreeMap.entries()) {
		if (normalizedFile.startsWith(worktreePath) && worktreePath.length > bestMatchPath.length) {
			bestMatchPath = worktreePath;
			bestMatchBranch = branch;
		}
	}

	return bestMatchBranch;
}

async function resolveBranchForEditorFile(workspaceRoot: string, editor: vscode.TextEditor): Promise<string | null> {
	const relativeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false).replace(/\\/g, '/');
	let worktreeMap = await refreshWorktreeBranchMap(workspaceRoot);
	let branch = findBranchForFile(editor.document.uri.fsPath, worktreeMap);

	if (relativeFilePath.startsWith('students/') && (!branch || branch === 'teacher')) {
		// Worktree list may be stale after sync/join; force refresh and retry once.
		worktreeMap = await refreshWorktreeBranchMap(workspaceRoot, true);
		branch = findBranchForFile(editor.document.uri.fsPath, worktreeMap);

		if (!branch || branch === 'teacher') {
			try {
				const gitAtFileDir = simpleGit(path.dirname(editor.document.uri.fsPath));
				const directBranch = (await gitAtFileDir.revparse(['--abbrev-ref', 'HEAD'])).trim();
				if (directBranch && directBranch !== 'HEAD') {
					branch = directBranch;
				}
			} catch (error: any) {
				console.warn('[Comment] Direct git branch resolve failed:', error?.message || error);
			}
		}
	}

	return branch;
}

async function notifyCurrentFileCommentContext(context: vscode.ExtensionContext, editor?: vscode.TextEditor) {
	const fileContext = await resolveCurrentFileCommentContext(context, editor);
	if (!fileContext) {
		return;
	}

	classroomViewProvider.notifyCurrentFileCommentContext(fileContext);
}

async function resolveCurrentFileCommentContext(
	context: vscode.ExtensionContext,
	editor?: vscode.TextEditor
): Promise<FileCommentContext | null> {
	if (!editor || editor.document.uri.scheme !== 'file') {
		return null;
	}

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return null;
	}

	const classInfo = context.globalState.get<any>('current_class') || {};
	const assignmentCode = classInfo.assignmentCode || null;
	if (!assignmentCode) {
		return null;
	}

	const relativeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false).replace(/\\/g, '/');
	const studentFilePath = relativeFilePath.startsWith('students/')
		? relativeFilePath.split('/').slice(2).join('/')
		: relativeFilePath;

	const role = String(classInfo.role || '').toLowerCase();
	let targetBranch: string | null = null;

	if (role === 'student' && classInfo.branch) {
		targetBranch = classInfo.branch;
	} else {
		try {
			targetBranch = await resolveBranchForEditorFile(workspaceRoot, editor);
		} catch (error: any) {
			console.error('[Comment] Failed to load worktree context:', error?.message || error);
		}

		if (!targetBranch && classInfo.branch) {
			targetBranch = classInfo.branch;
		}
	}

	if (!targetBranch) {
		return null;
	}

	return {
		assignmentCode,
		targetBranch,
		studentFilePath
	};
}

function truncateForInlineComment(text: string, maxLen: number = 72): string {
	if (!text) {
		return '';
	}
	const compact = text.replace(/\s+/g, ' ').trim();
	return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact;
}

function buildResolveCommandUri(comment: any, fileContext: FileCommentContext): vscode.Uri {
	const args = [{
		commentId: comment.id,
		assignmentCode: fileContext.assignmentCode,
		targetBranch: fileContext.targetBranch,
		studentFilePath: fileContext.studentFilePath
	}];
	return vscode.Uri.parse(`command:auto-git.resolveCodeComment?${encodeURIComponent(JSON.stringify(args))}`);
}

async function loadAndRenderCommentsForEditor(
	context: vscode.ExtensionContext,
	editor: vscode.TextEditor | undefined,
	commentDecorationType: vscode.TextEditorDecorationType,
	rangeHighlightDecorationType: vscode.TextEditorDecorationType,
	triggerSource: string = 'unknown'
) {
	if (!editor || editor.document.uri.scheme !== 'file') {
		return;
	}

	const fileContext = await resolveCurrentFileCommentContext(context, editor);
	if (!fileContext) {
		editor.setDecorations(commentDecorationType, []);
		editor.setDecorations(rangeHighlightDecorationType, []);
		return;
	}

	const fetchKey = `${fileContext.assignmentCode}|${fileContext.targetBranch}|${fileContext.studentFilePath}|${editor.document.uri.fsPath}`;
	const now = Date.now();
	const existingInFlight = inFlightCommentFetches.get(fetchKey);
	if (existingInFlight) {
		console.log(`[Comment] Skip duplicate in-flight fetch (${triggerSource}) -> ${fetchKey}`);
		await existingInFlight;
		return;
	}

	if (fetchKey === lastCommentFetchKey && now - lastCommentFetchAt < 700) {
		console.log(`[Comment] Skip rapid duplicate fetch (${triggerSource}) -> ${fetchKey}`);
		return;
	}

	const fetchTask = (async () => {
		console.log(`[Comment] Fetch triggered by ${triggerSource} -> ${fetchKey}`);
		try {
			const comments = await apiService.getCodeComments(
				fileContext.assignmentCode,
				fileContext.targetBranch,
				fileContext.studentFilePath
			);

			const decorations: vscode.DecorationOptions[] = comments
				.map((comment: any) => {
					const lineIndex = Math.max((comment.startLine || 1) - 1, 0);
					if (lineIndex >= editor.document.lineCount) {
						return null;
					}

					const startLine = Math.max((comment.startLine || 1) - 1, 0);
					const endLine = Math.min(Math.max((comment.endLine || comment.startLine || 1) - 1, startLine), editor.document.lineCount - 1);

					let anchorLine = startLine;
					let anchorLength = editor.document.lineAt(startLine).text.length;
					for (let i = startLine; i <= endLine; i++) {
						const len = editor.document.lineAt(i).text.length;
						if (len > anchorLength) {
							anchorLength = len;
							anchorLine = i;
						}
					}

					const range = new vscode.Range(anchorLine, anchorLength, anchorLine, anchorLength);
					const author = comment.authorName || 'Teacher';
					const content = comment.content || '';
					const resolveUri = buildResolveCommandUri(comment, fileContext);
					const hover = new vscode.MarkdownString(
						`**${author}**  \n\n${content}  \n\n[✓ Resolve comment](${resolveUri.toString()})`
					);
					hover.isTrusted = true;

					return {
						range,
						hoverMessage: hover,
						renderOptions: {
							after: {
								contentText: `   ${author}: ${truncateForInlineComment(content, 96)}   `
							}
						}
					} as vscode.DecorationOptions;
				})
				.filter((item: vscode.DecorationOptions | null): item is vscode.DecorationOptions => item !== null);

			const highlightedRanges: vscode.Range[] = comments
				.map((comment: any) => {
					const startLine = Math.max((comment.startLine || 1) - 1, 0);
					const startChar = Math.max((comment.startColumn || 1) - 1, 0);
					const endLine = Math.max((comment.endLine || comment.startLine || 1) - 1, 0);
					const endChar = Math.max((comment.endColumn || comment.startColumn || 1) - 1, 0);

					if (startLine >= editor.document.lineCount) {
						return null;
					}

					const safeEndLine = Math.min(endLine, editor.document.lineCount - 1);
					const safeStartLine = Math.min(startLine, safeEndLine);
					const safeEndChar = Math.min(endChar, editor.document.lineAt(safeEndLine).text.length);
					const safeStartChar = Math.min(startChar, editor.document.lineAt(safeStartLine).text.length);

					return new vscode.Range(safeStartLine, safeStartChar, safeEndLine, safeEndChar);
				})
				.filter((range: vscode.Range | null): range is vscode.Range => range !== null);

			editor.setDecorations(commentDecorationType, decorations);
			editor.setDecorations(rangeHighlightDecorationType, highlightedRanges);
		} catch (error: any) {
			console.error('[Comment] Failed to load/render comments:', error?.message || error);
			editor.setDecorations(commentDecorationType, []);
			editor.setDecorations(rangeHighlightDecorationType, []);
		} finally {
			lastCommentFetchKey = fetchKey;
			lastCommentFetchAt = Date.now();
			inFlightCommentFetches.delete(fetchKey);
		}
	})();

	inFlightCommentFetches.set(fetchKey, fetchTask);
	await fetchTask;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('Auto Git Classroom extension is now active!');
	const selectionCommentCodeLensProvider = new SelectionCommentCodeLensProvider();
	const commentDecorationType = vscode.window.createTextEditorDecorationType({
		after: {
			margin: '0 0 0 3.2rem',
			backgroundColor: 'rgba(37, 99, 235, 0.18)',
			color: '#bfdbfe',
			fontStyle: 'normal',
			fontWeight: '700'
		}
	});
	const rangeHighlightDecorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(56, 189, 248, 0.24)'
	});
	
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

	const createCodeCommentCommand = vscode.commands.registerCommand(
		'auto-git.createCodeCommentFromSelection',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage('Không tìm thấy editor đang mở.');
				return;
			}

			const selection = editor.selection;
			if (selection.isEmpty) {
				vscode.window.showWarningMessage('Hãy bôi đen đoạn code trước khi comment.');
				return;
			}

			const selectedText = editor.document.getText(selection);
			const comment = await vscode.window.showInputBox({
				prompt: 'Nhập comment cho đoạn code đã chọn',
				placeHolder: 'Ví dụ: Đoạn này cần xử lý null trước khi map()'
			});

			if (!comment || !comment.trim()) {
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceRoot) {
				vscode.window.showWarningMessage('Không tìm thấy workspace hiện tại để xác định branch.');
				return;
			}

			const classInfo = context.globalState.get<any>('current_class') || {};
			const assignmentCode = classInfo.assignmentCode || null;

			const relativeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false).replace(/\\/g, '/');
			const studentFilePath = relativeFilePath.startsWith('students/')
				? relativeFilePath.split('/').slice(2).join('/')
				: relativeFilePath;

			let targetBranch: string | null = null;
			try {
				targetBranch = await resolveBranchForEditorFile(workspaceRoot, editor);
			} catch (error: any) {
				console.error('[Comment] Failed to resolve worktree branch:', error?.message || error);
			}

			if (!targetBranch) {
				vscode.window.showWarningMessage('Không xác định được branch của file này. Hãy sync workspace và mở file trong students/.');
				return;
			}

			const draftComment = {
				assignmentCode,
				targetBranch,
				filePath: relativeFilePath,
				studentFilePath,
				startLine: selection.start.line + 1,
				startColumn: selection.start.character + 1,
				endLine: selection.end.line + 1,
				endColumn: selection.end.character + 1,
				selectedText,
				comment: comment.trim(),
				createdAt: new Date().toISOString()
			};

			try {
				await apiService.createCodeComment(draftComment);
				await loadAndRenderCommentsForEditor(context, editor, commentDecorationType, rangeHighlightDecorationType, 'createCodeCommentCommand');
				classroomViewProvider.notifyCurrentFileCommentContext({
					assignmentCode,
					targetBranch,
					studentFilePath
				});
			} catch (error: any) {
				vscode.window.showErrorMessage(`Tạo comment thất bại: ${error?.message || error}`);
			}
		}
	);

	const resolveCodeCommentCommand = vscode.commands.registerCommand(
		'auto-git.resolveCodeComment',
		async (args?: { commentId: number; assignmentCode: string; targetBranch: string; studentFilePath: string }) => {
			if (!args || !args.commentId) {
				return;
			}

			try {
				await apiService.resolveCodeComment(args.commentId);
				await loadAndRenderCommentsForEditor(context, vscode.window.activeTextEditor, commentDecorationType, rangeHighlightDecorationType, 'resolveCodeCommentCommand');
				vscode.window.showInformationMessage('Đã resolve comment.');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Resolve comment thất bại: ${error?.message || error}`);
			}
		}
	);

	const codelensProviderRegistration = vscode.languages.registerCodeLensProvider(
		{ scheme: 'file' },
		selectionCommentCodeLensProvider
	);

	const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(() => {
		selectionCommentCodeLensProvider.refresh();
	});

	const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
		selectionCommentCodeLensProvider.refresh();
		if (suppressCommentAutoLoad) {
			return;
		}
		notifyCurrentFileCommentContext(context, editor);
		loadAndRenderCommentsForEditor(context, editor, commentDecorationType, rangeHighlightDecorationType, 'onDidChangeActiveTextEditor');
	});

	context.subscriptions.push(
		openClassroomCommand,
		logoutCommand,
		createCodeCommentCommand,
		resolveCodeCommentCommand,
		codelensProviderRegistration,
		selectionChangeListener,
		activeEditorChangeListener,
		commentDecorationType,
		rangeHighlightDecorationType
	);

	// Setup auto-push on save
	setupAutoPush(context);
	console.log('✅ Auto-push listener registered');

	// Restore git service state if student has joined a class
	restoreGitServiceState(context);
	await closeAllOpenEditors();
	notifyCurrentFileCommentContext(context, vscode.window.activeTextEditor);
	suppressCommentAutoLoad = false;
	
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
						const pushed = await classroomViewProvider.handleAutoPush(classInfo);

						if (pushed) {
							vscode.window.showInformationMessage('✅ Đã push code lên GitHub!');
							vscode.window.setStatusBarMessage(
								'$(cloud-upload) Auto-pushed to GitHub',
								3000
							);
						} else {
							console.log('Save detected but no effective changes to push');
						}
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
				const currentGitBranch = currentBranch.trim();
				console.log('Current git branch:', currentGitBranch);
				
				// Get remote URL
				const remotes = await git.getRemotes(true);
				const originRemote = remotes.find((r: any) => r.name === 'origin');
				
				if (originRemote && originRemote.refs.fetch) {
					const repoUrl = originRemote.refs.fetch.replace(/\.git$/, '').replace(/^.*@github\.com[:\/]/, 'https://github.com/');
					console.log('Repository URL:', repoUrl);

					const folderParts = folderName.split('-');
					let assignmentCode = folderParts[0] || '';
					let role = 'student';
					let branch = currentGitBranch;
					let savedToken: string | undefined = token;

					const currentClass = context.globalState.get<any>('current_class');
					const isCurrentClassForThisWorkspace = !!(
						currentClass?.assignmentCode &&
						assignmentCode &&
						String(currentClass.assignmentCode) === String(assignmentCode)
					);
					const savedInfo = isCurrentClassForThisWorkspace ? currentClass : null;

					if (savedInfo?.assignmentCode) {
						assignmentCode = savedInfo.assignmentCode;
					}
					if (savedInfo?.role) {
						role = savedInfo.role;
					}
					if (savedInfo?.branch) {
						branch = savedInfo.branch;
					}

					const expectedStudentBranchFromFolder =
						assignmentCode && folderName.startsWith(`${assignmentCode}-student-`)
							? folderName.substring(assignmentCode.length + 1)
							: null;

					if (!savedInfo?.branch) {
						if (branch === 'main' || branch === 'master' || branch === 'teacher') {
							role = 'teacher';
							if (folderParts.length > 1) {
								assignmentCode = folderParts[1];
							}
						} else {
							role = 'student';
						}
					}

					// Only fallback to folder-derived branch when no persisted branch exists.
					if (!savedInfo?.branch && role === 'student' && expectedStudentBranchFromFolder) {
						branch = expectedStudentBranchFromFolder;
					}

					savedToken = savedInfo?.token || token;
					console.log('🎯 Final detected:', {
						assignmentCode,
						role,
						branch,
						branchSource: savedInfo?.branch ? 'current_class' : (expectedStudentBranchFromFolder ? 'workspace_folder' : 'git_current_branch')
					});
					console.log('[DEBUG] Final token for git service:', savedToken ? 'EXISTS (length: ' + savedToken.length + ')' : 'NULL');
					
					if (savedToken) {
						console.log('[DEBUG] Initializing git service with token...');
						
						// ✅ IMPORTANT: Checkout to correct branch if different from current
						if (branch !== currentGitBranch) {
							console.log(`⚠️ Branch mismatch! Git: ${currentGitBranch}, Saved: ${branch}`);
							console.log(`🔄 Checking out to correct branch: ${branch}`);
							
							try {
								// Check if branch exists locally
								const localBranches = await git.branchLocal();
								const branchExists = localBranches.all.includes(branch);
								
								if (branchExists) {
									await git.checkout(branch);
									console.log(`✅ Checked out to existing local branch: ${branch}`);
								} else {
									// Check if remote branch exists
									await git.fetch(['origin']);
									const remoteBranches = await git.branch(['-r']);
									const remoteBranchExists = remoteBranches.all.includes(`origin/${branch}`);
									
									if (remoteBranchExists) {
										await git.checkout(branch);
										console.log(`✅ Checked out to remote branch: ${branch}`);
									} else {
										console.error(`❌ Branch ${branch} not found locally or remotely!`);
										vscode.window.showErrorMessage(`Không tìm thấy branch: ${branch}`);
									}
								}
							} catch (checkoutError) {
								console.error('Failed to checkout branch:', checkoutError);
								vscode.window.showErrorMessage(`Lỗi chuyển branch: ${checkoutError}`);
							}
						} else {
							console.log(`✅ Already on correct branch: ${branch}`);
						}
						
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
