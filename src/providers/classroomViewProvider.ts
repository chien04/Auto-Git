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
                await this._handleCreateClass(message.className);
                break;

            case 'joinClass':
                await this._handleJoinClass(message.studentName, message.classCode);
                break;
                
            case 'createAssignment':
                await this._handleCreateAssignment(message.classCode, message.title, message.description, message.deadline);
                break;
                
            case 'joinAssignment':
                await this._handleJoinAssignmentWithPrompt(message.assignmentCode);
                break;
                
            case 'viewAssignment':
                await this._handleViewAssignment(message.assignmentCode);
                break;
                
            case 'openTeacherAssignment':
                await this._handleOpenTeacherAssignment(message.assignmentCode);
                break;
                
            case 'openAssignmentFolder':
                await this._handleOpenAssignmentFolder(message.localPath);
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
                
            case 'getCurrentWorkspace':
                await this._handleGetCurrentWorkspace();
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
                
            case 'openChat':
                // Forward openChat message to webview
                this._postMessage({
                    type: 'openChat',
                    config: message.config
                });
                break;
        }
    }

    private async _handleGoogleLogin(role: string) {
        let server: http.Server | null = null;
        
        try {
            // Create a local HTTP server to receive OAuth callback
            server = http.createServer();
            const port = 3000; // Local callback port
            
            let loginResult: { success: boolean; error?: string } = { success: false };
            
            // Promise to wait for OAuth callback
            const codePromise = new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (server) {
                        server.close();
                    }
                    reject(new Error('OAuth timeout - không nhận được callback sau 5 phút'));
                }, 5 * 60 * 1000); // 5 minutes timeout

                server!.on('request', async (req, res) => {
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
                                
                                setTimeout(() => {
                                    if (server) {
                                        server.close(() => {
                                            console.log('[OAuth] Server closed successfully');
                                        });
                                    }
                                }, 1000);
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
                                
                                setTimeout(() => {
                                    if (server) {
                                        server.close(() => {
                                            console.log('[OAuth] Server closed after error');
                                        });
                                    }
                                }, 1000);
                                reject(error);
                            }
                        } else {
                            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end('<html><body><h1>Error: No authorization code</h1></body></html>');
                            if (server) {
                                server.close();
                            }
                            reject(new Error('No authorization code received'));
                        }
                    } catch (err) {
                        if (server) {
                            server.close();
                        }
                        reject(err);
                    }
                });

                server!.on('error', (err) => {
                    clearTimeout(timeout);
                    if (server) {
                        server.close();
                    }
                    reject(err);
                });
            });

            // Start local server with error handling
            await new Promise<void>((resolve, reject) => {
                server!.listen(port, 'localhost', () => {
                    console.log(`OAuth callback server listening on http://localhost:${port}`);
                    resolve();
                });
                server!.on('error', (err: any) => {
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[OAuth] Port ${port} is already in use.`);
                        reject(new Error(`Port ${port} đang được sử dụng. Vui lòng đóng extension rồi mở lại (Ctrl+Shift+P -> "Developer: Reload Window").`));
                    } else {
                        reject(err);
                    }
                });
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
            // Make sure server is closed on error
            if (server) {
                server.close(() => {
                    console.log('[OAuth] Server closed due to error');
                });
            }
            
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

    private async _handleCreateClass(className: string) {
        try {
            const response = await this.apiService.createClass(className);

            this._postMessage({
                command: 'createClassSuccess',
                data: response
            });

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

    private async _handleJoinClass(studentName: string, classCode: string) {
        try {
            const response = await this.apiService.joinClass(studentName, classCode);

            this._postMessage({
                command: 'joinClassSuccess',
                data: response
            });

            vscode.window.showInformationMessage(
                `Đã tham gia lớp! Bây giờ bạn có thể tham gia các bài tập.`
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

    private async _handleCreateAssignment(classCode: string, title: string, description: string, deadline: string) {
        try {
            // First, ask user to select a folder for the assignment
            const folderResult = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Chọn thư mục lưu bài tập',
                title: 'Chọn thư mục để clone repository bài tập'
            });

            if (!folderResult || folderResult.length === 0) {
                vscode.window.showWarningMessage('Đã hủy tạo bài tập (không chọn thư mục)');
                return;
            }

            const localPath = folderResult[0].fsPath;

            const response = await this.apiService.createAssignment(classCode, title, description, deadline);

            // Clone repository to localPath
            if (response.repoUrl && response.token) {
                vscode.window.showInformationMessage('Đang clone repository bài tập...');
                
                const folderName = `${classCode}-${response.assignmentCode}`;
                const clonePath = path.join(localPath, folderName);

                await this.gitService.cloneRepository({
                    repoUrl: response.repoUrl,
                    branch: 'teacher', // Teacher works on 'teacher' branch
                    token: response.token,
                    localPath: clonePath
                });

                // Enable auto-push for teacher
                await this.gitService.initializeWorkspace(clonePath, {
                    token: response.token,
                    repoUrl: response.repoUrl,
                    branch: 'teacher' // Teacher pushes to 'teacher' branch
                });
                this.gitService.enableAutoPush();

                // Save teacher's local path to database
                try {
                    console.log('[DEBUG] Attempting to save teacher local path to database...');
                    console.log('[DEBUG]   - assignmentCode:', response.assignmentCode);
                    console.log('[DEBUG]   - clonePath:', clonePath);
                    
                    const saveResult = await this.apiService.saveTeacherLocalPath(response.assignmentCode, clonePath);
                    
                    console.log('[DEBUG] ✅ Successfully saved teacher local path to database!');
                    console.log('[DEBUG]   - Response:', JSON.stringify(saveResult));
                } catch (error: any) {
                    console.error('[DEBUG] ❌ Failed to save local path to database:', error);
                    console.error('[DEBUG]   - Error message:', error.message);
                    console.error('[DEBUG]   - Error stack:', error.stack);
                    
                    vscode.window.showWarningMessage(`⚠️ Không thể lưu đường dẫn vào database: ${error.message}`);
                    // Continue even if database save fails
                }

                // Auto-setup workspace structure (students/ folder, .gitignore, etc.)
                try {
                    console.log('[DEBUG] Auto-setting up workspace structure...');
                    vscode.window.showInformationMessage('Đang thiết lập workspace...');
                    
                    await this.apiService.setupAssignmentWorkspace(response.assignmentCode);
                    
                    console.log('[DEBUG] ✅ Workspace setup completed!');
                    vscode.window.showInformationMessage('✅ Workspace đã sẵn sàng! Khi sinh viên join sẽ tự động tạo folder.');
                } catch (error: any) {
                    console.error('[DEBUG] ❌ Failed to setup workspace:', error);
                    vscode.window.showWarningMessage(`⚠️ Không thể setup workspace: ${error.message}`);
                    // Continue even if setup fails
                }

                // Save assignment info with credentials AND localPath
                const assignmentInfo = {
                    assignmentCode: response.assignmentCode,
                    repoUrl: response.repoUrl,
                    token: response.token,
                    role: 'teacher',
                    localPath: clonePath,
                    branch: 'teacher' // Store correct branch
                };
                
                await this._context.globalState.update(`assignment_${response.assignmentCode}`, assignmentInfo);
                
                // Also update current_class so auto-push can find the token
                await this._context.globalState.update('current_class', assignmentInfo);
                
                console.log('[DEBUG] Saved assignment info to globalState with GitHub token');

                this._postMessage({
                    command: 'createAssignmentSuccess',
                    data: { ...response, localPath: clonePath }
                });

                // Open folder
                const uri = vscode.Uri.file(clonePath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, false);
            } else {
                this._postMessage({
                    command: 'createAssignmentSuccess',
                    data: response
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
            this._postMessage({
                command: 'createAssignmentError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Lỗi tạo bài tập: ${error.message}`);
        }
    }

    private async _handleJoinAssignmentWithPrompt(assignmentCode: string) {
        // Prompt user to select folder
        const folderOptions = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Chọn thư mục để lưu bài tập'
        });

        if (!folderOptions || folderOptions.length === 0) {
            vscode.window.showErrorMessage('Vui lòng chọn thư mục để lưu bài tập');
            return;
        }

        const localPath = folderOptions[0].fsPath;
        await this._handleJoinAssignment(assignmentCode, localPath);
    }

    private async _handleJoinAssignment(assignmentCode: string, localPath: string) {
        try {
            // First, get assignment info to know the branch name
            const tempResponse = await this.apiService.joinAssignment(assignmentCode, '');
            
            // Calculate the actual clone path based on branch name
            const folderName = `${assignmentCode}-${tempResponse.branch.replace('student/', '')}`;
            const clonePath = path.join(localPath, folderName);
            
            console.log('[DEBUG] Calculated clone path:', clonePath);
            
            // Now join again with the correct path
            const response = await this.apiService.joinAssignment(assignmentCode, clonePath);

            // Save student assignment info
            const assignmentInfo = {
                assignmentCode: assignmentCode,
                repoUrl: response.repoUrl,
                branch: response.branch,
                token: response.token,
                role: 'student',
                deadline: response.deadline,
                localPath: clonePath
            };
            
            await this._context.globalState.update(`student_assignment_${assignmentCode}`, assignmentInfo);
            await this._context.globalState.update('current_class', assignmentInfo);
            
            console.log('[DEBUG] Saved assignment info with localPath:', clonePath);

            this._postMessage({
                type: 'assignmentJoined',
                data: response
            });

            vscode.window.showInformationMessage('Đang clone repository bài tập...');
            
            await this.gitService.cloneRepository({
                repoUrl: response.repoUrl,
                branch: response.branch,
                token: response.token,
                localPath: clonePath
            });

            console.log('[DEBUG] Clone completed at:', clonePath);

            // Set assignment info for deadline check
            this.gitService.setClassInfo(this.apiService, assignmentCode);

            // Enable auto-push
            this.gitService.enableAutoPush();

            // Send success message BEFORE opening folder (as new window will close current one)
            this._postMessage({
                type: 'assignmentJoinedSuccess',
                assignmentCode: assignmentCode
            });

            // Open cloned folder (this will open in a new window)
            const uri = vscode.Uri.file(clonePath);
            await vscode.commands.executeCommand('vscode.openFolder', uri, false);

            vscode.window.showInformationMessage(
                'Repository bài tập đã được clone! Auto-push đã được kích hoạt.'
            );
        } catch (error: any) {
            this._postMessage({
                type: 'joinAssignmentError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Lỗi tham gia bài tập: ${error.message}`);
        }
    }

    private async _handleViewAssignment(assignmentCode: string) {
        try {
            const students = await this.apiService.getAssignmentStudents(assignmentCode);
            this._postMessage({
                type: 'assignmentStudentsLoaded',
                students: students
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi tải danh sách sinh viên: ${error.message}`);
        }
    }

    private async _handleOpenTeacherAssignment(assignmentCode: string) {
        try {
            console.log('[DEBUG] Opening teacher assignment:', assignmentCode);
            
            // First, try to get local path from database (new method)
            let assignmentInfo = null;
            try {
                const dbResponse = await this.apiService.getTeacherLocalPath(assignmentCode);
                if (dbResponse.exists && dbResponse.localPath) {
                    console.log('[DEBUG] Found local path in database:', dbResponse.localPath);
                    
                    // Get assignment info from globalState for token and repoUrl
                    const storedInfo = this._context.globalState.get<any>(`assignment_${assignmentCode}`);
                    
                    assignmentInfo = {
                        assignmentCode: assignmentCode,
                        localPath: dbResponse.localPath,
                        repoUrl: storedInfo?.repoUrl,
                        token: storedInfo?.token,
                        role: 'teacher',
                        branch: 'teacher'
                    };
                }
            } catch (error: any) {
                console.log('[DEBUG] Failed to get path from database, falling back to globalState:', error.message);
            }
            
            // Fallback to globalState if database lookup failed
            if (!assignmentInfo) {
                assignmentInfo = this._context.globalState.get<any>(`assignment_${assignmentCode}`);
                console.log('[DEBUG] Assignment info from globalState:', assignmentInfo ? 'EXISTS' : 'NOT FOUND');
            }
            
            if (assignmentInfo) {
                console.log('[DEBUG]   - localPath:', assignmentInfo.localPath);
                console.log('[DEBUG]   - repoUrl:', assignmentInfo.repoUrl);
                console.log('[DEBUG]   - branch:', assignmentInfo.branch);
                console.log('[DEBUG]   - hasToken:', !!assignmentInfo.token);
            }
            
            if (assignmentInfo && assignmentInfo.localPath) {
                // Check if folder exists
                if (!fs.existsSync(assignmentInfo.localPath)) {
                    console.error('[DEBUG] ❌ Folder does not exist:', assignmentInfo.localPath);
                    vscode.window.showErrorMessage(`Thư mục không tồn tại: ${assignmentInfo.localPath}. Vui lòng tạo lại assignment.`);
                    return;
                }
                
                console.log('[DEBUG] ✅ Folder exists');
                
                // Check if we're already in this workspace
                const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                const normalizedTarget = assignmentInfo.localPath.toLowerCase().replace(/\\/g, '/');
                const normalizedCurrent = currentWorkspace?.toLowerCase().replace(/\\/g, '/');
                
                console.log('[DEBUG] Opening teacher assignment:');
                console.log('[DEBUG]   Target:', normalizedTarget);
                console.log('[DEBUG]   Current:', normalizedCurrent);
                
                if (normalizedCurrent === normalizedTarget) {
                    console.log('[DEBUG] ✅ Already in correct workspace');
                    vscode.window.showInformationMessage('Bạn đã đang ở workspace của bài tập này!');
                    return;
                }
                
                console.log('[DEBUG] ⚠️ Switching to workspace:', assignmentInfo.localPath);
                
                // Update current_class before opening workspace so it can be restored
                await this._context.globalState.update('current_class', assignmentInfo);
                console.log('[DEBUG] ✅ Updated current_class in globalState');
                
                // Auto-sync workspace when switching to it
                try {
                    console.log('[DEBUG] Auto-syncing workspace before opening...');
                    vscode.window.showInformationMessage('Đang đồng bộ code từ sinh viên...');
                    
                    await this.apiService.syncAssignmentWorkspace(assignmentCode);
                    
                    console.log('[DEBUG] ✅ Auto-sync completed!');
                    vscode.window.showInformationMessage('✅ Code đã được đồng bộ!');
                } catch (syncError: any) {
                    console.error('[DEBUG] Auto-sync failed:', syncError);
                    // Don't block opening workspace if sync fails
                    vscode.window.showWarningMessage(`Không thể đồng bộ code: ${syncError.message}`);
                }
                
                // Open the folder where assignment was cloned
                const uri = vscode.Uri.file(assignmentInfo.localPath);
                console.log('[DEBUG] Opening folder with URI:', uri.toString());
                await vscode.commands.executeCommand('vscode.openFolder', uri, false);
                console.log('[DEBUG] ✅ Folder open command executed');
            } else {
                console.error('[DEBUG] ❌ No assignment info or localPath');
                vscode.window.showWarningMessage('Không tìm thấy thông tin bài tập hoặc thư mục đã clone. Vui lòng tạo lại assignment.');
            }
        } catch (error: any) {
            console.error('[DEBUG] ❌ Error opening teacher assignment:', error);
            vscode.window.showErrorMessage(`Lỗi mở thư mục assignment: ${error.message}`);
        }
    }

    private async _handleCloneAssignment(assignmentCode: string, repoUrl: string, title: string) {
        try {
            // Prompt user to select folder
            const folderOptions = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Chọn thư mục để clone assignment repository'
            });

            if (!folderOptions || folderOptions.length === 0) {
                return;
            }

            const localPath = folderOptions[0].fsPath;
            
            // Get assignment info from storage (teacher created it, so should have token)
            const assignmentInfo = this._context.globalState.get(`assignment_${assignmentCode}`) as any;
            
            if (!assignmentInfo || !assignmentInfo.token) {
                vscode.window.showErrorMessage('Không tìm thấy thông tin xác thực cho assignment này');
                return;
            }

            // Clone repository
            const folderName = `${assignmentCode}-teacher`;
            const clonePath = path.join(localPath, folderName);

            vscode.window.showInformationMessage('Đang clone repository...');
            
            await this.gitService.cloneRepository({
                repoUrl: repoUrl,
                branch: 'main',
                token: assignmentInfo.token,
                localPath: clonePath
            });

            // Open cloned folder
            const uri = vscode.Uri.file(clonePath);
            await vscode.commands.executeCommand('vscode.openFolder', uri, false);

            vscode.window.showInformationMessage('Repository đã được clone thành công!');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi clone repository: ${error.message}`);
        }
    }

    private async _handleOpenAssignmentFolder(localPath: string) {
        try {
            // Kiểm tra workspace hiện tại
            const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            // Normalize paths để so sánh (lowercase và thay \\ thành /)
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
            const uri = vscode.Uri.file(localPath);
            await vscode.commands.executeCommand('vscode.openFolder', uri, false);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Lỗi mở thư mục bài tập: ${error.message}`);
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
            console.log('[Extension] _handleLoadMyClasses called');
            const result = await this.apiService.getMyClasses();
            console.log('[Extension] API result:', result);
            
            // Get user role to determine which classes to send
            const userData = this._context.globalState.get<any>('user_data');
            const role = userData?.role || 'STUDENT';
            console.log('[Extension] User role:', role);
            
            let classesToSend = [];
            if (role === 'TEACHER') {
                classesToSend = result.teacherClasses || [];
            } else {
                classesToSend = result.studentClasses || [];
            }
            
            console.log('[Extension] Sending classes:', classesToSend);
            console.log('[Extension] Number of classes:', classesToSend.length);
            
            this._postMessage({
                type: 'classesLoaded',
                classes: classesToSend
            });
            
            console.log('[Extension] Message posted to webview');
        } catch (error: any) {
            console.error('[Extension] Error loading classes:', error);
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
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; connect-src http://localhost:8080 ws://localhost:8080;">
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
    
    public notifyWorkspaceChanged(assignmentCode: string) {
        console.log('[ClassroomViewProvider] Notifying webview of workspace change:', assignmentCode);
        this._postMessage({
            type: 'currentWorkspaceInfo',
            assignmentCode: assignmentCode,
            role: 'student' // Will be updated from globalState if needed
        });
    }
    
    private async _handleGetCurrentWorkspace() {
        try {
            const currentClass = this._context.globalState.get<any>('current_class');
            if (currentClass && currentClass.assignmentCode) {
                this._postMessage({
                    type: 'currentWorkspaceInfo',
                    assignmentCode: currentClass.assignmentCode,
                    role: currentClass.role
                });
            }
        } catch (error) {
            console.error('[ClassroomViewProvider] Failed to get current workspace:', error);
        }
    }
}
