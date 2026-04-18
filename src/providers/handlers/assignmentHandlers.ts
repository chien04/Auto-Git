import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ApiService } from '../../services/apiService';
import { GitService } from '../../services/gitService';
import {
    ensureBaseDirectory,
    getRoomAbsolutePath,
    getRoomData,
    markLastOpen,
    removeRoom,
    sortAssignmentsByLastOpen,
    upsertRoom
} from '../../utils/localWorkspaceStore';

export interface AssignmentHandlerDeps {
    apiService: ApiService;
    gitService: GitService;
    context: vscode.ExtensionContext;
    postMessage: (message: any) => void;
    closeAllEditorsBeforeWorkspaceOpen: () => Promise<void>;
}

export async function handleCreateAssignment(
    deps: AssignmentHandlerDeps,
    classCode: string,
    title: string,
    description: string,
    deadline: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            vscode.window.showErrorMessage('Không tìm thấy thông tin user. Vui lòng đăng nhập lại.');
            return;
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            vscode.window.showWarningMessage('Cần chọn thư mục gốc để tiếp tục tạo bài tập.');
            return;
        }

        const response = await deps.apiService.createAssignment(classCode, title, description, deadline);

        if (response.repoUrl && response.token) {
            vscode.window.showInformationMessage('Đang clone repository bài tập...');

            const folderName = `${classCode}-${response.assignmentCode}-teacher`;
            const relativePath = path.join(classCode, folderName);
            const clonePath = path.join(baseDirectory, relativePath);

            await deps.gitService.cloneRepository({
                repoUrl: response.repoUrl,
                branch: 'teacher',
                token: response.token,
                localPath: clonePath
            });

            ensureStudentsIgnored(clonePath);

            await deps.gitService.initializeWorkspace(clonePath, {
                token: response.token,
                repoUrl: response.repoUrl,
                branch: 'teacher'
            });
            deps.gitService.enableAutoPush();

            upsertRoom(baseDirectory, userData.userId, response.assignmentCode, relativePath, response.repoUrl, 'teacher');

            const assignmentInfo = {
                assignmentCode: response.assignmentCode,
                repoUrl: response.repoUrl,
                token: response.token,
                role: 'teacher',
                branch: 'teacher'
            };

            await deps.context.globalState.update(`assignment_${response.assignmentCode}`, assignmentInfo);
            await deps.context.globalState.update('current_class', assignmentInfo);

            const { token: _token, ...safeData } = response;
            deps.postMessage({
                command: 'createAssignmentSuccess',
                data: safeData
            });
        } else {
            const { token: _token, ...safeData } = response;
            deps.postMessage({
                command: 'createAssignmentSuccess',
                data: safeData
            });
        }

        vscode.window.showInformationMessage(
            `Bài tập đã được tạo! Assignment Code: ${response.assignmentCode}`,
            'Copy Assignment Code'
        ).then(selection => {
            if (selection === 'Copy Assignment Code') {
                vscode.env.clipboard.writeText(response.assignmentCode);
                vscode.window.showInformationMessage('Đã copy assignment code!');
            }
        });
    } catch (error: any) {
        deps.postMessage({
            command: 'createAssignmentError',
            error: error.message
        });
        vscode.window.showErrorMessage(`Lỗi tạo bài tập: ${error.message}`);
    }
}

export async function handleUploadTestCasesZip(
    deps: AssignmentHandlerDeps,
    assignmentCode: string,
    fileName: string,
    fileContent: string
): Promise<void> {
    try {
        vscode.window.showInformationMessage('Đang upload file ZIP test cases...');

        const response = await deps.apiService.uploadTestCasesZip(assignmentCode, fileName, fileContent);
        deps.postMessage({
            command: 'uploadTestCasesSuccess',
            data: response
        });

        vscode.window.showInformationMessage('Test cases đã được upload thành công!');
        await openAssignmentFolderIfExists(deps, assignmentCode);
    } catch (error: any) {
        console.error('[DEBUG] Upload error:', error);
        deps.postMessage({
            command: 'uploadTestCasesError',
            error: error.message
        });
        vscode.window.showErrorMessage(`Lỗi upload test cases: ${error.message}`);
    }
}

export async function handleSkipTestCases(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    vscode.window.showInformationMessage('Bạn có thể upload test cases sau');
    await openAssignmentFolderIfExists(deps, assignmentCode);
}

export async function handleJoinAssignmentWithPrompt(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    const userData = deps.context.globalState.get<any>('user_data');
    if (!userData?.userId) {
        vscode.window.showErrorMessage('Không tìm thấy thông tin user. Vui lòng đăng nhập lại.');
        return;
    }

    const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
    if (!baseDirectory) {
        vscode.window.showErrorMessage('Vui lòng chọn thư mục gốc để lưu bài tập');
        return;
    }

    await handleJoinAssignment(deps, assignmentCode, baseDirectory);
}

export async function handleJoinAssignment(
    deps: AssignmentHandlerDeps,
    assignmentCode: string,
    localPath: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            throw new Error('Không tìm thấy user hiện tại');
        }

        const tempResponse = await deps.apiService.joinAssignment(assignmentCode, '');

        const folderName = `${assignmentCode}-${tempResponse.branch.replace('student/', '')}`;
        const relativePath = path.join('student', folderName);
        const clonePath = path.join(localPath, relativePath);

        console.log('[DEBUG] Calculated clone path:', clonePath);

        const response = await deps.apiService.joinAssignment(assignmentCode, '');

        upsertRoom(localPath, userData.userId, assignmentCode, relativePath, response.repoUrl, response.branch);

        const assignmentInfo = {
            assignmentCode,
            repoUrl: response.repoUrl,
            branch: response.branch,
            token: response.token,
            role: 'student',
            deadline: response.deadline
        };

        await deps.context.globalState.update(`student_assignment_${assignmentCode}`, assignmentInfo);
        await deps.context.globalState.update('current_class', assignmentInfo);

        const { token: _token, ...safeResponse } = response;
        deps.postMessage({
            type: 'assignmentJoined',
            data: safeResponse
        });

        vscode.window.showInformationMessage('Đang clone repository bài tập...');

        await deps.gitService.cloneRepository({
            repoUrl: response.repoUrl,
            branch: response.branch,
            token: response.token,
            localPath: clonePath
        });

        console.log('[DEBUG] Clone completed at:', clonePath);

        deps.gitService.setClassInfo(deps.apiService, assignmentCode);
        deps.gitService.enableAutoPush();

        deps.postMessage({
            type: 'assignmentJoinedSuccess',
            assignmentCode
        });

        const uri = vscode.Uri.file(clonePath);
        await deps.closeAllEditorsBeforeWorkspaceOpen();
        await vscode.commands.executeCommand('vscode.openFolder', uri, false);

        vscode.window.showInformationMessage(
            'Repository bài tập đã được clone! Auto-push đã được kích hoạt.'
        );
    } catch (error: any) {
        deps.postMessage({
            type: 'joinAssignmentError',
            error: error.message
        });
        vscode.window.showErrorMessage(`Lỗi tham gia bài tập: ${error.message}`);
    }
}

export async function handleViewAssignment(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const students = await deps.apiService.getAssignmentStudents(assignmentCode);
        deps.postMessage({
            type: 'assignmentStudentsLoaded',
            students
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Lỗi tải danh sách sinh viên: ${error.message}`);
    }
}

export async function handleOpenAssignment(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        const userRole = userData?.role || 'STUDENT';

        console.log('[DEBUG] Opening assignment:', assignmentCode, 'User role:', userRole);

        if (userRole === 'TEACHER') {
            await handleSyncTeacherWorkspaceBestEffort(deps, assignmentCode, userData);
            await handleOpenTeacherAssignment(deps, assignmentCode);
        } else {
            await handleOpenStudentAssignment(deps, assignmentCode);
        }
    } catch (error: any) {
        console.error('[DEBUG] Error opening assignment:', error);
        vscode.window.showErrorMessage(`Lỗi mở bài tập: ${error.message}`);
    }
}

export async function handleOpenStudentAssignment(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        console.log('[DEBUG] Opening student assignment:', assignmentCode);

        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            vscode.window.showWarningMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
            return;
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            vscode.window.showWarningMessage('Cần chọn thư mục gốc để mở bài tập.');
            return;
        }

        const roomData = getRoomData(baseDirectory, userData.userId, assignmentCode);
        if (!roomData.found) {
            vscode.window.showWarningMessage('Không tìm thấy bài tập trong .coding-rooms.json. Vui lòng join lại assignment.');
            return;
        }

        if (!roomData.fullPath || !roomData.room) {
            vscode.window.showErrorMessage(roomData.error || 'Không thể resolve đường dẫn từ .coding-rooms.json');
            return;
        }

        const localPath = roomData.fullPath;
        const storedInfo = deps.context.globalState.get<any>(`student_assignment_${assignmentCode}`) || {};
        const branchFromJson = roomData.room.branchName;

        if (!branchFromJson) {
            vscode.window.showWarningMessage('Thiếu branch trong .coding-rooms.json. Vui lòng join lại assignment.');
            return;
        }

        const assignmentInfo = {
            assignmentCode,
            localPath,
            repoUrl: storedInfo.repoUrl,
            branch: branchFromJson,
            token: storedInfo.token,
            role: 'student',
            deadline: storedInfo.deadline
        };

        if (!fs.existsSync(localPath)) {
            console.error('[DEBUG] Folder does not exist:', localPath);
            vscode.window.showErrorMessage(`Thư mục không tồn tại: ${localPath}. Vui lòng join lại assignment.`);
            return;
        }

        console.log('[DEBUG] Folder exists');

        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const normalizedTarget = localPath.toLowerCase().replace(/\\/g, '/');
        const normalizedCurrent = currentWorkspace?.toLowerCase().replace(/\\/g, '/');

        console.log('[DEBUG] Opening student assignment:');
        console.log('[DEBUG]   Target:', normalizedTarget);
        console.log('[DEBUG]   Current:', normalizedCurrent);

        if (normalizedCurrent === normalizedTarget) {
            console.log('[DEBUG] Already in correct workspace');
            vscode.window.showInformationMessage('Bạn đã đang ở workspace của bài tập này!');
            return;
        }

        console.log('[DEBUG] Switching to student workspace:', localPath);

        markLastOpen(baseDirectory, userData.userId, assignmentCode);

        await deps.context.globalState.update('current_class', assignmentInfo);
        console.log('[DEBUG] Updated current_class with STUDENT branch:', assignmentInfo.branch);

        const uri = vscode.Uri.file(localPath);
        console.log('[DEBUG] Opening folder with URI:', uri.toString());
        await deps.closeAllEditorsBeforeWorkspaceOpen();
        await vscode.commands.executeCommand('vscode.openFolder', uri, false);
        console.log('[DEBUG] Folder open command executed');
    } catch (error: any) {
        console.error('[DEBUG] Error opening student assignment:', error);
        vscode.window.showErrorMessage(`Lỗi mở bài tập: ${error.message}`);
    }
}

export async function handleOpenTeacherAssignment(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            vscode.window.showWarningMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
            return;
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            vscode.window.showWarningMessage('Cần chọn thư mục gốc để mở bài tập.');
            return;
        }

        const roomData = getRoomData(baseDirectory, userData.userId, assignmentCode);
        if (!roomData.found) {
            vscode.window.showWarningMessage('Không tìm thấy bài tập trong .coding-rooms.json. Vui lòng tạo lại assignment.');
            return;
        }

        if (!roomData.fullPath || !roomData.room) {
            vscode.window.showErrorMessage(roomData.error || 'Không thể resolve đường dẫn từ .coding-rooms.json');
            return;
        }

        const localPath = roomData.fullPath;
        if (!fs.existsSync(localPath)) {
            vscode.window.showErrorMessage(`Thư mục không tồn tại: ${localPath}. Vui lòng tạo lại assignment.`);
            return;
        }

        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const normalizedTarget = localPath.toLowerCase().replace(/\\/g, '/');
        const normalizedCurrent = currentWorkspace?.toLowerCase().replace(/\\/g, '/');

        if (normalizedCurrent === normalizedTarget) {
            vscode.window.showInformationMessage('Bạn đã đang ở workspace của bài tập này!');
            return;
        }

        markLastOpen(baseDirectory, userData.userId, assignmentCode);

        const storedInfo = deps.context.globalState.get<any>(`assignment_${assignmentCode}`) || {};
        const assignmentInfo = {
            assignmentCode,
            localPath,
            repoUrl: storedInfo.repoUrl,
            token: storedInfo.token,
            role: 'teacher',
            branch: roomData.room.branchName || 'teacher'
        };

        await deps.context.globalState.update('current_class', assignmentInfo);

        const uri = vscode.Uri.file(localPath);
        await deps.closeAllEditorsBeforeWorkspaceOpen();
        await vscode.commands.executeCommand('vscode.openFolder', uri, false);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Lỗi mở thư mục assignment: ${error.message}`);
    }
}

export async function handleOpenAssignmentFolder(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            vscode.window.showWarningMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
            return;
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            vscode.window.showWarningMessage('Cần chọn thư mục gốc để mở bài tập.');
            return;
        }

        const roomPath = getRoomAbsolutePath(baseDirectory, userData.userId, assignmentCode);
        if (!roomPath.found) {
            vscode.window.showWarningMessage('Không tìm thấy bài tập trong .coding-rooms.json.');
            return;
        }

        if (!roomPath.fullPath) {
            vscode.window.showErrorMessage(roomPath.error || 'Không thể resolve đường dẫn từ .coding-rooms.json');
            return;
        }

        const localPath = roomPath.fullPath;
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const normalizedTarget = localPath.toLowerCase().replace(/\\/g, '/');
        const normalizedCurrent = currentWorkspace?.toLowerCase().replace(/\\/g, '/');

        console.log('[DEBUG] Opening assignment folder:');
        console.log('[DEBUG]   Target:', normalizedTarget);
        console.log('[DEBUG]   Current:', normalizedCurrent);

        if (normalizedCurrent === normalizedTarget) {
            console.log('[DEBUG] ✅ Already in correct workspace');
            vscode.window.showInformationMessage('Bạn đã đang ở workspace của bài tập này!');
            return;
        }

        console.log('[DEBUG] ⚠️ Switching to workspace:', localPath);
        markLastOpen(baseDirectory, userData.userId, assignmentCode);
        const uri = vscode.Uri.file(localPath);
        await deps.closeAllEditorsBeforeWorkspaceOpen();
        await vscode.commands.executeCommand('vscode.openFolder', uri, false);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Lỗi mở thư mục bài tập: ${error.message}`);
    }
}

export async function handleGetAssignments(
    deps: AssignmentHandlerDeps,
    classCode: string
): Promise<void> {
    try {
        const data = await deps.apiService.getAssignments(classCode);

        const userData = deps.context.globalState.get<any>('user_data');
        if (userData?.userId) {
            const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
            if (baseDirectory) {
                const sorted = sortAssignmentsByLastOpen(data, baseDirectory, userData.userId);
                deps.postMessage({
                    type: 'assignmentsLoaded',
                    assignments: sorted
                });
                return;
            }
        }

        deps.postMessage({
            type: 'assignmentsLoaded',
            assignments: data
        });
    } catch (error: any) {
        deps.postMessage({
            type: 'assignmentsError',
            error: error.message
        });
    }
}

export async function handleExportAssignmentExcel(
    deps: AssignmentHandlerDeps,
    assignmentId: string,
    assignmentCode?: string,
    title?: string
): Promise<void> {
    try {
        const binary = await deps.apiService.exportAssignmentExcel(assignmentId);

        const safeCode = (assignmentCode || assignmentId).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        const safeTitle = (title || 'report').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        const defaultName = `${safeCode}-${safeTitle}.xlsx`;

        const saveUri = await vscode.window.showSaveDialog({
            saveLabel: 'Lưu file Excel',
            filters: {
                'Excel Files': ['xlsx']
            },
            defaultUri: vscode.Uri.file(defaultName)
        });

        if (!saveUri) {
            return;
        }

        const buffer = Buffer.isBuffer(binary) ? binary : Buffer.from(binary as ArrayBuffer);
        fs.writeFileSync(saveUri.fsPath, buffer);
        vscode.window.showInformationMessage(`Đã xuất Excel: ${saveUri.fsPath}`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Xuất Excel thất bại: ${error.message}`);
    }
}

export async function handleGetAssignmentSubmissions(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const data = await deps.apiService.getAssignmentSubmissions(assignmentCode);
        deps.postMessage({
            type: 'submissionsLoaded',
            submissions: data
        });
    } catch (error: any) {
        deps.postMessage({
            type: 'submissionsError',
            error: error.message
        });
    }
}

export async function handleSyncAssignmentWorkspace(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            throw new Error('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            throw new Error('Cần chọn thư mục gốc để đồng bộ workspace.');
        }

        const roomData = getRoomData(baseDirectory, userData.userId, assignmentCode);
        if (!roomData.found || !roomData.fullPath) {
            throw new Error('Không tìm thấy assignment trong .coding-rooms.json để đồng bộ.');
        }

        vscode.window.showInformationMessage('⏳ Đang đồng bộ code từ sinh viên...');
        await deps.apiService.syncAssignmentWorkspace(assignmentCode, roomData.fullPath);
        deps.postMessage({
            type: 'syncWorkspaceSuccess'
        });
        vscode.window.showInformationMessage('✅ Đã đồng bộ code mới nhất!');
    } catch (error: any) {
        deps.postMessage({
            type: 'syncWorkspaceError',
            error: error.message
        });
        vscode.window.showErrorMessage(`❌ Lỗi đồng bộ: ${error.message}`);
    }
}

export async function handleSetupAssignmentWorkspace(
    deps: AssignmentHandlerDeps,
    assignmentCode: string,
    title?: string
): Promise<void> {
    const assignmentTitle = title || assignmentCode;
    const confirmed = await vscode.window.showWarningMessage(
        `Setup workspace cho bài tập "${assignmentTitle}"?\n\nSẽ tạo worktrees cho tất cả sinh viên đã join.`,
        { modal: true },
        'Setup',
        'Hủy'
    );

    if (confirmed !== 'Setup') {
        return;
    }

    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            throw new Error('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            throw new Error('Cần chọn thư mục gốc để setup workspace.');
        }

        const roomData = getRoomData(baseDirectory, userData.userId, assignmentCode);
        if (!roomData.found || !roomData.fullPath) {
            throw new Error('Không tìm thấy assignment trong .coding-rooms.json để setup workspace.');
        }

        const result = await deps.apiService.setupAssignmentWorkspace(assignmentCode, roomData.fullPath);
        deps.postMessage({
            type: 'setupWorkspaceSuccess',
            data: result
        });
        vscode.window.showInformationMessage(`✅ ${result.message}`);
    } catch (error: any) {
        deps.postMessage({
            type: 'setupWorkspaceError',
            error: error.message
        });
        vscode.window.showErrorMessage(`❌ Lỗi setup: ${error.message}`);
    }
}

export async function handleSyncTeacherWorkspaceBestEffort(
    deps: AssignmentHandlerDeps,
    assignmentCode: string,
    userData: any
): Promise<void> {
    try {
        if (!userData?.userId) {
            return;
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            return;
        }

        const roomData = getRoomData(baseDirectory, userData.userId, assignmentCode);
        if (!roomData.found || !roomData.fullPath) {
            return;
        }

        await deps.apiService.syncAssignmentWorkspace(assignmentCode, roomData.fullPath);
    } catch (error: any) {
        console.warn('[DEBUG] Teacher auto-sync failed before open:', error?.message || error);
        vscode.window.showWarningMessage(`Không thể đồng bộ trước khi mở: ${error?.message || 'Unknown error'}`);
    }
}

export async function handleDeleteAssignment(
    deps: AssignmentHandlerDeps,
    assignmentCode: string,
    title?: string
): Promise<void> {
    const assignmentTitle = title || assignmentCode;
    const confirmed = await vscode.window.showWarningMessage(
        `Bạn có chắc muốn xóa bài tập "${assignmentTitle}"?`,
        { modal: true },
        'Xóa',
        'Hủy'
    );

    if (confirmed !== 'Xóa') {
        return;
    }

    try {
        await deps.apiService.deleteAssignment(assignmentCode);

        const userData = deps.context.globalState.get<any>('user_data');
        if (userData?.userId) {
            const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
            if (baseDirectory) {
                const removed = removeRoom(baseDirectory, userData.userId, assignmentCode);
                console.log(`[JSON] Removed assignment ${assignmentCode}: ${removed}`);
            }
        }

        deps.postMessage({
            type: 'assignmentDeleted'
        });
        vscode.window.showInformationMessage('✅ Đã xóa bài tập!');
    } catch (error: any) {
        deps.postMessage({
            type: 'deleteAssignmentError',
            error: error.message
        });
        vscode.window.showErrorMessage(`❌ Lỗi xóa bài tập: ${error.message}`);
    }
}

async function openAssignmentFolderIfExists(
    deps: AssignmentHandlerDeps,
    assignmentCode: string
): Promise<void> {
    try {
        const userData = deps.context.globalState.get<any>('user_data');
        if (!userData?.userId) {
            return;
        }

        const baseDirectory = await ensureBaseDirectory(deps.context, userData.userId);
        if (!baseDirectory) {
            return;
        }

        const roomPath = getRoomAbsolutePath(baseDirectory, userData.userId, assignmentCode);

        if (roomPath.found && roomPath.fullPath && fs.existsSync(roomPath.fullPath)) {
            const uri = vscode.Uri.file(roomPath.fullPath);
            await vscode.commands.executeCommand('vscode.openFolder', uri, false);
        }
    } catch (error: any) {
        console.error('[DEBUG] Failed to open assignment folder:', error);
    }
}

function ensureStudentsIgnored(repoPath: string): void {
    try {
        const gitignorePath = path.join(repoPath, '.gitignore');
        const ignoreEntry = 'students/';

        let content = '';
        if (fs.existsSync(gitignorePath)) {
            content = fs.readFileSync(gitignorePath, 'utf-8');
        }

        const lines = content
            .split(/\r?\n/)
            .map((line) => line.trim());

        if (!lines.includes(ignoreEntry)) {
            const normalizedContent = content.length > 0 && !content.endsWith('\n')
                ? `${content}\n`
                : content;
            fs.writeFileSync(gitignorePath, `${normalizedContent}${ignoreEntry}\n`, 'utf-8');
        }
    } catch (error: any) {
        console.warn('[DEBUG] Failed to ensure students/ in .gitignore:', error?.message || error);
    }
}
