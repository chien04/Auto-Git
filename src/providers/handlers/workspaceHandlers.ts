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



