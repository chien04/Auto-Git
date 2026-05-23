// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ClassroomViewProvider } from './providers/classroomViewProvider';
import { ApiService } from './services/apiService';
import { GitService } from './services/gitService';
import { getBaseDirectoryKey, getRoomData } from './utils/localWorkspaceStore';
import simpleGit from 'simple-git';
import {
	checkGitInstalled,
	notifyFrontendOfCurrentWorkspace,
	restoreRuntimeState,
	tryOpenPendingNotificationFile
} from './extension/runtimeLifecycle';

import {
	handleRunCode,
	handleSubmitCode
} from './extension/executeCode';

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

function isTeacherRole(context: vscode.ExtensionContext): boolean {
	const classInfo = context.globalState.get<any>('current_class') || {};
	return String(classInfo.role || '').toLowerCase() === 'teacher';
}

class SelectionCommentCodeLensProvider implements vscode.CodeLensProvider {
	constructor(private readonly context: vscode.ExtensionContext) { }

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

		if (!isTeacherRole(this.context)) {
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
	let worktreeMap = await refreshWorktreeBranchMap(workspaceRoot);
	let branch = findBranchForFile(editor.document.uri.fsPath, worktreeMap);

	return branch;
}

function resolveStudentBranchFromCodingRooms(
	context: vscode.ExtensionContext,
	assignmentCode: string
): string | null {
	try {
		const userData = context.globalState.get<any>('user_data') || {};
		const userId = userData.userId ? String(userData.userId) : '';
		if (!userId) {
			return null;
		}

		const baseDirectoryKey = getBaseDirectoryKey(userId);
		const baseDirectory = context.globalState.get<string>(baseDirectoryKey);
		if (!baseDirectory) {
			return null;
		}

		const roomData = getRoomData(baseDirectory, userId, assignmentCode);
		const branchName = roomData.room?.branchName?.trim();
		return branchName || null;
	} catch (error: any) {
		console.warn('[Comment] Failed to resolve student branch from .coding-rooms.json:', error?.message || error);
		return null;
	}
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

	if (role === 'student') {
		targetBranch = resolveStudentBranchFromCodingRooms(context, assignmentCode);
	} else {
		try {
			targetBranch = await resolveBranchForEditorFile(workspaceRoot, editor);
		} catch (error: any) {
			console.error('[Comment] Failed to load worktree context:', error?.message || error);
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
						`**${author}**  \n\n${content}  \n\n[✓ Đồng ý](${resolveUri.toString()})`
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
	const selectionCommentCodeLensProvider = new SelectionCommentCodeLensProvider(context);
	const commentDecorationType = vscode.window.createTextEditorDecorationType({
		after: {
			margin: '0 0 0 3.2rem',
			fontStyle: 'normal',
			fontWeight: '700'
		},
		light: {
			after: {
				backgroundColor: 'rgba(37, 99, 235, 0.15)',
				color: '#1e40af' // Màu xanh đậm tương phản tốt trên nền sáng
			}
		},
		dark: {
			after: {
				backgroundColor: 'rgba(37, 99, 235, 0.25)',
				color: '#bfdbfe' // Màu xanh nhạt trên nền tối
			}
		}
	});
	const rangeHighlightDecorationType = vscode.window.createTextEditorDecorationType({
		light: {
			backgroundColor: 'rgba(56, 189, 248, 0.3)'
		},
		dark: {
			backgroundColor: 'rgba(56, 189, 248, 0.24)'
		}
	});

	checkGitInstalled();

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
			classroomViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true
				}
			}
		)
	);

	const runtimeDeps = {
		apiService,
		gitService,
		classroomViewProvider
	};

	// Register commands
	const openClassroomCommand = vscode.commands.registerCommand(
		'auto-git.openClassroom',
		() => {
			vscode.commands.executeCommand('autoGitClassroom.mainView.focus');
		}
	);

	const inspectStateCmd = vscode.commands.registerCommand('auto-git.inspectGlobalState', () => {
		const keys = context.globalState.keys();
		console.log("=== TẤT CẢ KEYS TRONG GLOBAL STATE ===");

		keys.forEach(key => {
			const value = context.globalState.get(key);
			console.log(`Key: ${key} | Value:`, value);
		});

		vscode.window.showInformationMessage("Đã in globalState ra Debug Console!");
	});


	const logoutCommand = vscode.commands.registerCommand(
		'auto-git.logout',
		async () => {
			await context.globalState.update('jwt_token', undefined);
			await context.globalState.update('user_data', undefined);
			await context.globalState.update('current_class', undefined);
			apiService.setToken(null);
			vscode.window.showInformationMessage('Đã đăng xuất và xóa dữ liệu');
		}
	);

	const createCodeCommentCommand = vscode.commands.registerCommand(
		'auto-git.createCodeCommentFromSelection',
		async () => {
			if (!isTeacherRole(context)) {
				vscode.window.showWarningMessage('Chỉ giáo viên mới có thể tạo comment trên code.');
				return;
			}

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
				placeHolder: 'Ví dụ: Đoạn này cần xử lý null'
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

	const runCodeCommand = vscode.commands.registerCommand('codingrooms.runCode', async () => {
		const userData = context.globalState.get<{ userId: string }>('user_data');

		if (!userData || !userData.userId) {
			vscode.window.showErrorMessage('Vui lòng đăng nhập để thực hiện lệnh Run!');
			return;
		}

		await handleRunCode(
			runtimeDeps.apiService,
			userData.userId,
			context
		);
	});

	const submitCodeCommand = vscode.commands.registerCommand('codingrooms.submitCode', async () => {
		const userData = context.globalState.get<{ userId: string }>('user_data');

		if (!userData || !userData.userId) {
			vscode.window.showErrorMessage('Vui lòng đăng nhập để nộp bài!');
			return;
		}

		await handleSubmitCode(
			runtimeDeps.apiService,
			userData.userId,
			context
		);
	});

	context.subscriptions.push(
		inspectStateCmd,
		openClassroomCommand,
		logoutCommand,
		createCodeCommentCommand,
		resolveCodeCommentCommand,
		codelensProviderRegistration,
		selectionChangeListener,
		activeEditorChangeListener,
		commentDecorationType,
		rangeHighlightDecorationType,
		runCodeCommand,
		submitCodeCommand
	);

	await restoreRuntimeState(context, runtimeDeps);
	await closeAllOpenEditors();
	await tryOpenPendingNotificationFile(context);
	suppressCommentAutoLoad = false;

	const initialEditor = vscode.window.activeTextEditor;
	notifyCurrentFileCommentContext(context, initialEditor);
	await loadAndRenderCommentsForEditor(
		context,
		initialEditor,
		commentDecorationType,
		rangeHighlightDecorationType,
		'initialActivation'
	);

	// Listen for workspace folder changes to update UI
	vscode.workspace.onDidChangeWorkspaceFolders(async () => {
		console.log('[DEBUG] Workspace folders changed, restoring state...');
		await restoreRuntimeState(context, runtimeDeps);
		await tryOpenPendingNotificationFile(context);
		notifyCurrentFileCommentContext(context, vscode.window.activeTextEditor);
		await loadAndRenderCommentsForEditor(
			context,
			vscode.window.activeTextEditor,
			commentDecorationType,
			rangeHighlightDecorationType,
			'onDidChangeWorkspaceFolders'
		);
		notifyFrontendOfCurrentWorkspace(context, runtimeDeps);
	});
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Auto Git Classroom extension is now deactivated');
}
