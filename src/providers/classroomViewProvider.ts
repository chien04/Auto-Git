import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { ApiService } from '../services/apiService';
import { GitService } from '../services/gitService';

export class ClassroomViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'autoGitClassroom.mainView';
    private _view?: vscode.WebviewView;
    private apiService: ApiService;
    private gitService: GitService;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        apiService: ApiService,
        gitService: GitService
    ) {
        this.apiService = apiService;
        this.gitService = gitService;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this._handleMessage(data);
        });

        // Restore state if available - delay để đảm bảo webview đã load xong
        setTimeout(() => {
            this._restoreState();
        }, 100);
    }

    private async _handleMessage(message: any) {
        console.log('Extension received message:', message.type || message.command, message);
        switch (message.type || message.command) {
            case 'checkLoginStatus':
                await this._restoreState();
                break;

            case 'googleLogin':
                await this._handleGoogleLogin(message.role || 'STUDENT');
                break;
                
            case 'requestOtp':
                await this._handleRequestOTP(message.email);
                break;
                
            case 'verifyOtp':
                await this._handleVerifyOTP(message.email, message.otp, message.role || 'STUDENT');
                break;

            case 'logout':
                await this._handleLogout();
                break;

            case 'selectFolder':
                await this._handleSelectFolder();
                break;

            case 'createClass':
                await this._handleCreateClass(message.className, message.localPath, message.deadline);
                break;

            case 'joinClass':
                await this._handleJoinClass(message.studentName, message.classCode, message.localPath);
                break;
                
            case 'loadMyClasses':
                await this._handleLoadMyClasses();
                break;
                
            case 'loadStudents':
                await this._handleLoadStudents(message.classCode);
                break;
                
            case 'deleteClass':
                await this._handleDeleteClass(message.classCode, message.className);
                break;
                
            case 'leaveClass':
                await this._handleLeaveClass(message.classCode, message.className, message.branchName);
                break;
                
            case 'openWorkspace':
                await this._handleOpenWorkspace(message.classCode);
                break;

            case 'syncWorkspace':
                await this._handleSyncWorkspace(message.classCode);
                break;

            case 'removeStudent':
                await this._handleRemoveStudent(message.classCode, message.studentId, message.studentName);
                break;

            case 'openClassFolder':
                await this._handleOpenClassFolder(message.classCode);
                break;
                
            case 'loadCommits':
                await this._handleLoadCommits(message.classCode, message.branchName);
                break;
                
            case 'viewCode':
                await this._handleViewCode(message.classCode, message.branchName, message.commitSha);
                break;
                
            case 'copyToClipboard':
                await vscode.env.clipboard.writeText(message.text);
                vscode.window.showInformationMessage('Đã copy vào clipboard!');
                break;
                
            case 'openUrl':
                await vscode.env.openExternal(vscode.Uri.parse(message.url));
                break;
        }
    }

    private async _handleGoogleLogin(role: string) {
        try {
            // Create a local HTTP server to receive OAuth callback
            const server = http.createServer();
            const port = 3000; // Local callback port
            
            let loginResult: { success: boolean; error?: string } = { success: false };
            
            // Promise to wait for OAuth callback
            const codePromise = new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    server.close();
                    reject(new Error('OAuth timeout - không nhận được callback sau 5 phút'));
                }, 5 * 60 * 1000); // 5 minutes timeout

                server.on('request', async (req, res) => {
                    try {
                        const url = new URL(req.url!, `http://localhost:${port}`);
                        const code = url.searchParams.get('code');
                        
                        if (code) {
                            // Don't send response yet - wait for backend verification
                            clearTimeout(timeout);
                            
                            // Try to exchange code for token
                            try {
                                const loginResponse = await this.apiService.handleGoogleCallback(code, role);
                                
                                // Save token to workspace state
                                await this._context.globalState.update('jwt_token', loginResponse.token);
                                await this._context.globalState.update('user_data', {
                                    email: loginResponse.email,
                                    userId: loginResponse.userId,
                                    name: loginResponse.name,
                                    role: loginResponse.role
                                });

                                this.apiService.setToken(loginResponse.token);
                                
                                loginResult = { success: true };
                                
                                // Send success page
                                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                                res.end(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <meta charset="UTF-8">
                                        <title>Đăng nhập thành công</title>
                                        <style>
                                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f0f0; }
                                            .success { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                                            h1 { color: #28a745; font-size: 32px; }
                                            p { font-size: 18px; color: #666; }
                                            .icon { font-size: 64px; margin-bottom: 20px; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="success">
                                            <div class="icon">✓</div>
                                            <h1>Đăng nhập thành công!</h1>
                                            <p>Xin chào ${loginResponse.name}</p>
                                            <p>Bạn có thể đóng tab này và quay lại VSCode.</p>
                                            <p style="font-size: 14px; color: #999; margin-top: 30px;">Tự động đóng sau 3 giây...</p>
                                        </div>
                                        <script>setTimeout(() => window.close(), 3000);</script>
                                    </body>
                                    </html>
                                `);
                                
                                this._postMessage({
                                    type: 'loginSuccess',
                                    user: {
                                        email: loginResponse.email,
                                        userId: loginResponse.userId,
                                        name: loginResponse.name,
                                        role: loginResponse.role
                                    },
                                    token: loginResponse.token
                                });
                                
                                setTimeout(() => server.close(), 1000);
                                resolve(code);
                                
                            } catch (error: any) {
                                // Login failed - send error page
                                loginResult = { success: false, error: error.message };
                                
                                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                                res.end(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <meta charset="UTF-8">
                                        <title>Đăng nhập thất bại</title>
                                        <style>
                                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f0f0; }
                                            .error { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                                            h1 { color: #dc3545; font-size: 32px; }
                                            p { font-size: 18px; color: #666; }
                                            .icon { font-size: 64px; margin-bottom: 20px; }
                                            .message { background: #f8d7da; padding: 15px; border-radius: 5px; color: #721c24; margin-top: 20px; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="error">
                                            <div class="icon">✗</div>
                                            <h1>Đăng nhập thất bại!</h1>
                                            <div class="message">
                                                ${error.message}
                                            </div>
                                            <p style="font-size: 14px; color: #999; margin-top: 30px;">Tự động đóng sau 5 giây...</p>
                                        </div>
                                        <script>setTimeout(() => window.close(), 5000);</script>
                                    </body>
                                    </html>
                                `);
                                
                                setTimeout(() => server.close(), 1000);
                                reject(error);
                            }
                        } else {
                            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end('<html><body><h1>Error: No authorization code</h1></body></html>');
                            reject(new Error('No authorization code received'));
                        }
                    } catch (err) {
                        reject(err);
                    }
                });

                server.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

            // Start local server
            await new Promise<void>((resolve, reject) => {
                server.listen(port, 'localhost', () => {
                    console.log(`OAuth callback server listening on http://localhost:${port}`);
                    resolve();
                });
                server.on('error', reject);
            });

            // Get Google OAuth URL (backend will redirect to localhost:3000)
            const authUrl = await this.apiService.initiateGoogleLogin();
            
            // Show status message
            vscode.window.showInformationMessage('Đang mở trình duyệt để đăng nhập Google...');

            // Open browser for OAuth
            const uri = vscode.Uri.parse(authUrl);
            await vscode.env.openExternal(uri);

            // Wait for callback with code (this will resolve after backend verification)
            await codePromise;

            // If we reach here, login was successful (handled in callback)
            if (loginResult.success) {
                const userData = this._context.globalState.get<any>('user_data');
                vscode.window.showInformationMessage(`Đăng nhập thành công! Xin chào ${userData?.name}`);
            }
        } catch (error: any) {
            this._postMessage({
                type: 'loginError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Lỗi đăng nhập: ${error.message}`);
        }
    }
    
    private async _handleRequestOTP(email: string) {
        try {
            const response = await this.apiService.requestOTP(email);
            
            this._postMessage({
                command: 'otpRequested',
                message: response.message
            });
            
            vscode.window.showInformationMessage(response.message);
        } catch (error: any) {
            this._postMessage({
                command: 'otpRequestError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Lỗi gửi OTP: ${error.message}`);
        }
    }
    
    private async _handleVerifyOTP(email: string, otp: string, role: string) {
        try {
            const loginResponse = await this.apiService.verifyOTP(email, otp, role);
            
            // Save token to workspace state
            await this._context.globalState.update('jwt_token', loginResponse.token);
            await this._context.globalState.update('user_data', {
                email: loginResponse.email,
                userId: loginResponse.userId,
                name: loginResponse.name,
                role: loginResponse.role
            });
            
            // Set token in API service
            this.apiService.setToken(loginResponse.token);
            
            // Notify webview
            this._postMessage({
                type: 'loginSuccess',
                user: {
                    email: loginResponse.email,
                    userId: loginResponse.userId,
                    name: loginResponse.name,
                    role: loginResponse.role
                },
                token: loginResponse.token
            });
            
            vscode.window.showInformationMessage(`Đăng nhập thành công! Xin chào ${loginResponse.name}`);
        } catch (error: any) {
            this._postMessage({
                type: 'loginError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Mã OTP không đúng hoặc đã hết hạn`);
        }
    }

    private async _handleLogout() {
        await this._context.globalState.update('jwt_token', undefined);
        await this._context.globalState.update('user_data', undefined);
        this.apiService.setToken(null);
        
        // Notify webview to refresh
        this._postMessage({
            type: 'logout'
        });
        
        vscode.window.showInformationMessage('Đã đăng xuất');
    }

    private async _handleSelectFolder() {
        try {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Chọn thư mục lưu repository',
                title: 'Chọn thư mục cho lớp học'
            });

            if (folderUri && folderUri[0]) {
                this._postMessage({
                    type: 'folderSelected',
                    path: folderUri[0].fsPath
                });
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi chọn thư mục: ${error.message}`);
        }
    }

    private async _handleCreateClass(className: string, localPath: string, deadline?: string) {
        try {
            const response = await this.apiService.createClass(className, localPath, deadline);

            // Save class info with credentials
            await this._context.globalState.update('current_class', {
                classId: response.classId,
                classCode: response.classCode,
                className: response.className,
                repoUrl: response.repoUrl,
                token: response.token,
                branch: response.branch,
                role: 'teacher'
            });

            this._postMessage({
                command: 'createClassSuccess',
                data: response
            });

            // Backend already cloned repo to localPath
            // Get localPath from API
            const pathResponse = await this.apiService.getLocalPath(response.classCode);
            
            if (pathResponse.localPath) {
                // Initialize git service with teacher credentials
                await this.gitService.initializeWorkspace(pathResponse.localPath, {
                    token: response.token,
                    repoUrl: response.repoUrl,
                    branch: response.branch
                });
                
                // Enable auto-push for teacher
                this.gitService.enableAutoPush();
                
                // Open folder
                const uri = vscode.Uri.file(pathResponse.localPath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, false);
            }

            vscode.window.showInformationMessage(
                `Lớp học đã được tạo! Class Code: ${response.classCode}`,
                'Copy Class Code'
            ).then(selection => {
                if (selection === 'Copy Class Code') {
                    vscode.env.clipboard.writeText(response.classCode);
                    vscode.window.showInformationMessage('Đã copy class code!');
                }
            });
        } catch (error: any) {
            this._postMessage({
                command: 'createClassError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Lỗi tạo lớp: ${error.message}`);
        }
    }

    private async _handleJoinClass(studentName: string, classCode: string, localPath: string) {
        try {
            const response = await this.apiService.joinClass(studentName, classCode, localPath);

            // Save student info
            await this._context.globalState.update('current_class', {
                classCode: classCode,
                studentName: studentName,
                studentId: response.studentId,
                repoUrl: response.repoUrl,
                branch: response.branch,
                token: response.token,
                role: 'student',
                deadline: response.deadline
            });

            this._postMessage({
                command: 'joinClassSuccess',
                data: response
            });

            // Create subfolder in the selected path (className-classCode)
            const folderName = `${classCode}-student-${studentName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const clonePath = path.join(localPath, folderName);

            // Clone repository
            vscode.window.showInformationMessage('Đang clone repository...');
            
            await this.gitService.cloneRepository({
                repoUrl: response.repoUrl,
                branch: response.branch,
                token: response.token,
                localPath: clonePath
            });

            // Set class info for deadline check
            this.gitService.setClassInfo(this.apiService, classCode);

            // Enable auto-push
            this.gitService.enableAutoPush();

            // Open cloned folder in workspace
            const uri = vscode.Uri.file(clonePath);
            await vscode.commands.executeCommand('vscode.openFolder', uri, false);

            this._postMessage({
                command: 'cloneComplete'
            });

            vscode.window.showInformationMessage(
                'Repository đã được clone! Auto-push đã được kích hoạt.'
            );
        } catch (error: any) {
            this._postMessage({
                command: 'joinClassError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Lỗi tham gia lớp: ${error.message}`);
        }
    }

    private async _restoreState() {
        const token = this._context.globalState.get<string>('jwt_token');
        const userData = this._context.globalState.get<any>('user_data');

        if (token) {
            this.apiService.setToken(token);
        }

        if (userData && this._view) {
            this._postMessage({
                type: 'restoreState',
                user: userData,
                token: token
            });
        } else if (this._view) {
            // Không có user, gửi message để kết thúc loading
            this._postMessage({
                type: 'restoreState',
                user: null,
                token: null
            });
        }
    }

    private async _handleOpenWorkspace(classCode: string) {
        try {
            vscode.window.showInformationMessage('Đang tạo workspace...');
            
            // Call API to setup workspace
            const response = await this.apiService.setupWorkspace(classCode);
            
            // Open workspace file in VS Code
            const workspaceUri = vscode.Uri.file(response.workspaceFilePath);
            
            // Open workspace in new window
            await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, true);
            
            vscode.window.showInformationMessage(response.message);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi tạo workspace: ${error.message}`);
        }
    }

    private async _handleSyncWorkspace(classCode: string) {
        try {
            console.log('[Provider] Syncing workspace for class:', classCode);
            vscode.window.showInformationMessage('⏳ Đang đồng bộ code từ GitHub...');
            
            // Call API to sync workspace
            const response = await this.apiService.syncWorkspace(classCode);
            
            console.log('[Provider] Sync successful:', response);
            vscode.window.showInformationMessage(`✅ ${response.message}`);
        } catch (error: any) {
            console.error('[Provider] Sync failed:', error);
            vscode.window.showErrorMessage(`❌ Lỗi đồng bộ: ${error.message}`);
        }
    }

    private async _handleRemoveStudent(classCode: string, studentId: string, studentName: string) {
        try {
            await this.apiService.removeStudent(classCode, studentId);
            
            vscode.window.showInformationMessage(`✅ Đã xóa sinh viên ${studentName}`);
            
            // Reload student list
            this._postMessage({
                type: 'studentRemoved'
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`❌ Lỗi xóa sinh viên: ${error.message}`);
        }
    }

    private async _handleOpenClassFolder(classCode: string) {
        try {
            // Get local path from API
            const response = await this.apiService.getLocalPath(classCode);
            
            if (response.localPath) {
                // Open folder in current window
                const folderUri = vscode.Uri.file(response.localPath);
                await vscode.commands.executeCommand('vscode.openFolder', folderUri, false);
            } else {
                vscode.window.showWarningMessage('Chưa có thư mục local cho lớp học này');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi mở thư mục: ${error.message}`);
        }
    }

    private _postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    
    private async _handleLoadMyClasses() {
        try {
            const result = await this.apiService.getMyClasses();
            
            // Get user role to determine which classes to send
            const userData = this._context.globalState.get<any>('user_data');
            const role = userData?.role || 'STUDENT';
            
            if (role === 'TEACHER') {
                this._postMessage({
                    type: 'classesLoaded',
                    classes: result.teacherClasses
                });
            } else {
                this._postMessage({
                    type: 'classesLoaded',
                    classes: result.studentClasses
                });
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi tải danh sách lớp: ${error.message}`);
        }
    }
    
    private async _handleLoadStudents(classCode: string) {
        try {
            const students = await this.apiService.getStudents(classCode);
            
            this._postMessage({
                type: 'studentsLoaded',
                students: students
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi tải danh sách sinh viên: ${error.message}`);
        }
    }
    
    private async _handleDeleteClass(classCode: string, className?: string) {
        console.log('Extension received deleteClass message:', classCode);
        
        // Show confirmation dialog
        const classNameDisplay = className || classCode;
        const confirm = await vscode.window.showWarningMessage(
            `Bạn có chắc muốn xóa lớp "${classNameDisplay}"?\n\nRepository GitHub sẽ bị xóa vĩnh viễn!`,
            { modal: true },
            'Xóa',
            'Hủy'
        );
        
        if (confirm !== 'Xóa') {
            console.log('Delete cancelled by user');
            return;
        }
        
        try {
            console.log('Calling apiService.deleteClass...');
            await this.apiService.deleteClass(classCode);
            console.log('Delete class successful');
            
            this._postMessage({
                type: 'classDeleted'
            });
            
            vscode.window.showInformationMessage('Đã xóa lớp học thành công!');
        } catch (error: any) {
            console.error('Delete class error:', error);
            vscode.window.showErrorMessage(`Lỗi xóa lớp: ${error.message}`);
        }
    }
    
    private async _handleLeaveClass(classCode: string, className?: string, branchName?: string) {
        console.log('Extension received leaveClass message:', classCode);
        
        // Show confirmation dialog
        const classNameDisplay = className || classCode;
        const branchNameDisplay = branchName || 'branch của bạn';
        const confirm = await vscode.window.showWarningMessage(
            `Bạn có chắc muốn rời khỏi lớp "${classNameDisplay}"?\n\nBranch "${branchNameDisplay}" sẽ bị xóa vĩnh viễn!`,
            { modal: true },
            'Rời lớp',
            'Hủy'
        );
        
        if (confirm !== 'Rời lớp') {
            console.log('Leave cancelled by user');
            return;
        }
        
        try {
            console.log('Calling apiService.leaveClass...');
            await this.apiService.leaveClass(classCode);
            console.log('Leave class successful');
            
            this._postMessage({
                type: 'classLeft'
            });
            
            vscode.window.showInformationMessage('Đã rời khỏi lớp học!');
        } catch (error: any) {
            console.error('Leave class error:', error);
            vscode.window.showErrorMessage(`Lỗi rời lớp: ${error.message}`);
        }
    }

    private async _handleLoadCommits(classCode: string, branchName: string) {
        try {
            const response = await this.apiService.getCommits(classCode, branchName);
            
            this._postMessage({
                type: 'commitsLoaded',
                commits: response
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi tải commits: ${error.message}`);
        }
    }

    private async _handleViewCode(classCode: string, branchName: string, commitSha: string) {
        try {
            // Open GitHub commit URL in browser
            const response = await this.apiService.getCommitUrl(classCode, branchName, commitSha);
            await vscode.env.openExternal(vscode.Uri.parse(response.url));
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi xem code: ${error.message}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Load the compiled React bundle
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'webview.js')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; connect-src http://localhost:8080;">
                <title>Auto Submit</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public async handleAutoPush(classInfo?: any) {
        try {
            if (this.gitService.isAutoPushEnabled()) {
                console.log('[ClassroomViewProvider] Starting auto-push...');
                await this.gitService.autoPush();
                console.log('[ClassroomViewProvider] Auto-push completed successfully');
                
                // Update commit count after successful push
                console.log('[ClassroomViewProvider] ClassInfo received:', classInfo);
                
                if (classInfo?.classCode) {
                    console.log('[ClassroomViewProvider] Calling updateCommitCount for class:', classInfo.classCode);
                    try {
                        const result = await this.apiService.updateCommitCount(classInfo.classCode);
                        console.log('[ClassroomViewProvider] Commit count updated:', result);
                    } catch (error) {
                        console.error('[ClassroomViewProvider] Failed to update commit count (non-critical):', error);
                    }
                } else {
                    console.warn('[ClassroomViewProvider] Cannot update commit count - no classCode found');
                }
                
                this._postMessage({
                    command: 'pushSuccess'
                });
            }
        } catch (error: any) {
            console.error('[ClassroomViewProvider] Auto-push error:', error);
            this._postMessage({
                command: 'pushError',
                error: error.message
            });
            // Re-throw error so extension.ts can handle it
            throw error;
        }
    }
}
