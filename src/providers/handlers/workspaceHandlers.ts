import * as vscode from 'vscode';
import { ApiService } from '../../services/apiService';

export async function handleSelectFolder(
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Chọn thư mục lưu repository',
            title: 'Chọn thư mục cho lớp học'
        });

        if (folderUri && folderUri[0]) {
            postMessage({
                type: 'folderSelected',
                path: folderUri[0].fsPath
            });
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Lỗi chọn thư mục: ${error.message}`);
    }
}

export async function handleOpenWorkspace(
    apiService: ApiService,
    classCode: string,
    closeAllEditorsBeforeWorkspaceOpen: () => Promise<void>
): Promise<void> {
    try {
        vscode.window.showInformationMessage('Đang tạo workspace...');

        const response = await apiService.setupWorkspace(classCode);
        const workspaceUri = vscode.Uri.file(response.workspaceFilePath);

        await closeAllEditorsBeforeWorkspaceOpen();
        await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, true);

        vscode.window.showInformationMessage(response.message);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Lỗi tạo workspace: ${error.message}`);
    }
}

export async function handleSyncWorkspace(
    apiService: ApiService,
    classCode: string
): Promise<void> {
    try {
        console.log('[Provider] Syncing workspace for class:', classCode);
        vscode.window.showInformationMessage('⏳ Đang đồng bộ code từ GitHub...');

        const response = await apiService.syncWorkspace(classCode);

        console.log('[Provider] Sync successful:', response);
        vscode.window.showInformationMessage(`✅ ${response.message}`);
    } catch (error: any) {
        console.error('[Provider] Sync failed:', error);
        vscode.window.showErrorMessage(`❌ Lỗi đồng bộ: ${error.message}`);
    }
}

export async function handleOpenClassFolder(
    apiService: ApiService,
    classCode: string,
    closeAllEditorsBeforeWorkspaceOpen: () => Promise<void>
): Promise<void> {
    try {
        const response = await apiService.getLocalPath(classCode);

        if (response.localPath) {
            const folderUri = vscode.Uri.file(response.localPath);
            await closeAllEditorsBeforeWorkspaceOpen();
            await vscode.commands.executeCommand('vscode.openFolder', folderUri, false);
        } else {
            vscode.window.showWarningMessage('Chưa có thư mục local cho lớp học này');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Lỗi mở thư mục: ${error.message}`);
    }
}
