import * as vscode from 'vscode';

export function notifyWorkspaceChanged(
    assignmentCode: string,
    postMessage: (message: any) => void
): void {
    console.log('[ClassroomViewProvider] Notifying webview of workspace change:', assignmentCode);
    postMessage({
        type: 'currentWorkspaceInfo',
        assignmentCode,
        role: 'student'
    });
}

export async function handleGetCurrentWorkspace(
    context: vscode.ExtensionContext,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const currentClass = context.globalState.get<any>('current_class');
        if (currentClass && currentClass.assignmentCode) {
            postMessage({
                type: 'currentWorkspaceInfo',
                assignmentCode: currentClass.assignmentCode,
                role: currentClass.role
            });
        }
    } catch (error) {
        console.error('[ClassroomViewProvider] Failed to get current workspace:', error);
    }
}
