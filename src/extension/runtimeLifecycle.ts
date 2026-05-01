import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import { ApiService } from '../services/apiService';
import { GitService } from '../services/gitService';
import { ClassroomViewProvider } from '../providers/classroomViewProvider';

export interface RuntimeLifecycleDeps {
    apiService: ApiService;
    gitService: GitService;
    classroomViewProvider: ClassroomViewProvider;
}

export function notifyFrontendOfCurrentWorkspace(
    context: vscode.ExtensionContext,
    deps: RuntimeLifecycleDeps
): void {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const folderName = workspaceFolders[0].uri.fsPath.split(/[\\/]/).pop() || '';
        const assignmentCode = folderName.split('-')[0];

        console.log('[DEBUG] Notifying frontend of current workspace:', assignmentCode);
        deps.classroomViewProvider.notifyWorkspaceChanged(assignmentCode);
    } catch (error) {
        console.error('[DEBUG] Error notifying frontend:', error);
    }
}

export async function tryOpenPendingNotificationFile(context: vscode.ExtensionContext): Promise<void> {
    try {
        const pending = context.globalState.get<any>('pending_notification_open_file');
        if (!pending?.assignmentCode || !pending?.studentFilePath) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const classInfo = context.globalState.get<any>('current_class') || {};
        if (!workspaceRoot || String(classInfo.assignmentCode || '') !== String(pending.assignmentCode)) {
            return;
        }

        const normalizedStudentFile = String(pending.studentFilePath).replace(/\\/g, '/');
        const candidates = [path.join(workspaceRoot, normalizedStudentFile)];

        if (classInfo.branch) {
            candidates.push(path.join(workspaceRoot, 'students', String(classInfo.branch), normalizedStudentFile));
        }

        const targetPath = candidates.find((candidate) => fs.existsSync(candidate));
        if (!targetPath) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(targetPath);
        await vscode.window.showTextDocument(document, { preview: false });
        await context.globalState.update('pending_notification_open_file', undefined);
    } catch (error: any) {
        console.error('[Notification] Failed to open pending commented file:', error?.message || error);
    }
}

export async function restoreGitServiceState(
    context: vscode.ExtensionContext,
    deps: RuntimeLifecycleDeps
): Promise<void> {
    try {
        const token = context.globalState.get<string>('jwt_token');

        if (token) {
            deps.apiService.setToken(token);
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const folderName = workspacePath.split(/[\\/]/).pop() || '';
            console.log('Workspace folder name:', folderName);

            const git = simpleGit(workspacePath);
            try {
                await git.status();

                const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
                const currentGitBranch = currentBranch.trim();
                console.log('Current git branch:', currentGitBranch);

                const remotes = await git.getRemotes(true);
                const originRemote = remotes.find((r: any) => r.name === 'origin');

                if (originRemote && originRemote.refs.fetch) {
                    const repoUrl = originRemote.refs.fetch.replace(/\.git$/, '').replace(/^.*@github\.com[:/]/, 'https://github.com/');
                    console.log('Repository URL:', repoUrl);

                    const folderParts = folderName.split('-');
                    let assignmentCode = folderParts[0] || '';
                    let role = 'student';
                    let branch = currentGitBranch;
                    let savedToken: string | undefined;

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

                    if (!savedInfo?.branch && role === 'student' && expectedStudentBranchFromFolder) {
                        branch = expectedStudentBranchFromFolder;
                    }

                    const roleSpecificKey = role === 'teacher'
                        ? `assignment_${assignmentCode}`
                        : `student_assignment_${assignmentCode}`;
                    const roleSpecificInfo = context.globalState.get<any>(roleSpecificKey) || {};

                    savedToken = savedInfo?.token || roleSpecificInfo?.token;
                    const savedDeadline = savedInfo?.deadline || roleSpecificInfo?.deadline;
                    const savedBranch = savedInfo?.branch || roleSpecificInfo?.branch;

                    if (savedBranch && !savedInfo?.branch) {
                        branch = savedBranch;
                    }
                    console.log('Final detected:', {
                        assignmentCode,
                        role,
                        branch,
                        branchSource: savedInfo?.branch
                            ? 'current_class'
                            : savedBranch
                                ? roleSpecificKey
                                : (expectedStudentBranchFromFolder ? 'workspace_folder' : 'git_current_branch')
                    });
                    console.log('[DEBUG] Final token for git service:', savedToken ? 'EXISTS (length: ' + savedToken.length + ')' : 'NULL');

                    if (savedToken) {
                        console.log('[DEBUG] Initializing git service with token...');

                        if (branch !== currentGitBranch) {
                            console.log(`Branch mismatch! Git: ${currentGitBranch}, Saved: ${branch}`);
                            console.log(`Checking out to correct branch: ${branch}`);

                            try {
                                const localBranches = await git.branchLocal();
                                const branchExists = localBranches.all.includes(branch);

                                if (branchExists) {
                                    await git.checkout(branch);
                                    console.log(`Checked out to existing local branch: ${branch}`);
                                } else {
                                    await git.fetch(['origin']);
                                    const remoteBranches = await git.branch(['-r']);
                                    const remoteBranchExists = remoteBranches.all.includes(`origin/${branch}`);

                                    if (remoteBranchExists) {
                                        await git.checkout(branch);
                                        console.log(`Checked out to remote branch: ${branch}`);
                                    } else {
                                        console.error(`Branch ${branch} not found locally or remotely!`);
                                        vscode.window.showErrorMessage(`Không tìm thấy branch: ${branch}`);
                                    }
                                }
                            } catch (checkoutError) {
                                console.error('Failed to checkout branch:', checkoutError);
                                vscode.window.showErrorMessage(`Lỗi chuyển branch: ${checkoutError}`);
                            }
                        } else {
                            console.log(`Already on correct branch: ${branch}`);
                        }

                        const currentInfo = {
                            assignmentCode: assignmentCode,
                            repoUrl: repoUrl,
                            branch: branch,
                            token: savedToken,
                            role: role,
                            deadline: savedDeadline
                        };

                        await context.globalState.update('current_class', currentInfo);
                        console.log('[DEBUG] Updated current_class in globalState');

                        console.log('[DEBUG] Calling gitService.initializeWorkspace with:', {
                            workspacePath,
                            hasToken: !!savedToken,
                            repoUrl,
                            branch
                        });
                        await deps.gitService.initializeWorkspace(workspacePath, {
                            token: savedToken,
                            repoUrl: repoUrl,
                            branch: branch
                        });

                        if (role === 'student' && assignmentCode) {
                            deps.gitService.setClassInfo(deps.apiService, assignmentCode);
                        }

                        deps.gitService.enableAutoPush();

                        console.log(`Git service restored: role=${role}, branch=${branch}, assignmentCode=${assignmentCode}, token exists: ${!!savedToken}`);
                    } else {
                        console.warn(`No GitHub token found for ${roleSpecificKey}, auto-push disabled`);
                        await deps.gitService.initializeWorkspace(workspacePath);
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

export async function checkGitInstalled(): Promise<void> {
    const git = simpleGit();
    try {
        await git.version();
        console.log('Git is installed');
    } catch (error) {
        vscode.window.showErrorMessage(
            'Git chưa được cài đặt! Extension cần Git để hoạt động.',
            'Hướng dẫn cài đặt'
        ).then(selection => {
            if (selection === 'Hướng dẫn cài đặt') {
                vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/downloads'));
            }
        });
    }
}
