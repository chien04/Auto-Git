import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface CloneOptions {
    repoUrl: string;
    branch: string;
    token: string;
    localPath: string;
}

export class GitService {
    private git: SimpleGit | null = null;
    private workspacePath: string | null = null;
    private autoPushEnabled: boolean = false;
    private token: string | null = null;
    private repoUrl: string | null = null;
    private branch: string | null = null;
    private classCode: string | null = null;
    private assignmentCode: string | null = null;
    private apiService: any = null;

    constructor() {}

    async cloneRepository(options: CloneOptions): Promise<void> {
        try {
            // Ensure local path exists
            if (!fs.existsSync(options.localPath)) {
                fs.mkdirSync(options.localPath, { recursive: true });
            }

            const authenticatedUrl = this.buildAuthenticatedUrl(options.repoUrl, options.token);

            const gitOptions: Partial<SimpleGitOptions> = {
                baseDir: options.localPath,
                binary: 'git',
                maxConcurrentProcesses: 6,
            };

            this.git = simpleGit(gitOptions);

            // Clone the repository (without specifying branch - will clone default branch)
            console.log(`Cloning repository to ${options.localPath}...`);
            await this.git.clone(authenticatedUrl, options.localPath);

            // Set working directory to cloned repo
            this.workspacePath = options.localPath;
            this.git = simpleGit(this.workspacePath);

            // Store credentials for future operations
            this.token = options.token;
            this.repoUrl = options.repoUrl;
            this.branch = options.branch;

            // Configure git user (use global config or defaults)
            await this.configureGit();

            // Check current branch
            const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
            console.log(`Current branch after clone: ${currentBranch.trim()}`);
            
            // If target branch is different from current, create/checkout it
            if (currentBranch.trim() !== options.branch) {
                console.log(`Need to switch to branch: ${options.branch}`);
                
                // Fetch all branches
                await this.git.fetch(['origin']);
                
                // Check if remote branch exists
                const branches = await this.git.branch(['-r']);
                const remoteBranchExists = branches.all.includes(`origin/${options.branch}`);
                
                if (remoteBranchExists) {
                    console.log(`Remote branch exists, checking out: ${options.branch}`);
                    // Checkout existing remote branch
                    await this.git.checkout(options.branch);
                } else {
                    console.log(`Remote branch doesn't exist, creating new branch: ${options.branch}`);
                    // Create new branch from current HEAD
                    await this.git.checkoutLocalBranch(options.branch);
                    
                    // Push to create remote tracking branch
                    await this.git.push(['--set-upstream', 'origin', options.branch]);
                    console.log(`Created and pushed new branch: ${options.branch}`);
                }
            }

            console.log(`Repository setup completed on branch: ${options.branch}`);
        } catch (error: any) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        }
    }

    /**
     * Initialize git in workspace
     */
    async initializeWorkspace(
        workspacePath: string,
        options?: { token?: string; repoUrl?: string; branch?: string }
    ): Promise<void> {
        this.workspacePath = workspacePath;
        this.git = simpleGit(workspacePath);

        // Store credentials if provided
        if (options) {
            if (options.token) this.token = options.token;
            if (options.repoUrl) this.repoUrl = options.repoUrl;
            if (options.branch) this.branch = options.branch;
        }

        // Configure git user
        await this.configureGit();

        // Set remote URL with token if available
        if (this.token && this.repoUrl) {
            try {
                const authenticatedUrl = this.buildAuthenticatedUrl(this.repoUrl, this.token);
                await this.git.remote(['set-url', 'origin', authenticatedUrl]);
                console.log('Remote URL updated with authentication token');
            } catch (error: any) {
                console.warn('Failed to set remote URL (permission denied, will use explicit URL for push):', error.message);
                // Don't throw - we can still push with explicit URL
            }
        }

        // Checkout correct branch if specified
        if (this.branch) {
            try {
                // Get current branch
                const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
                console.log(`Current branch: ${currentBranch.trim()}, Target branch: ${this.branch}`);
                
                if (currentBranch.trim() !== this.branch) {
                    console.log(`Switching to branch: ${this.branch}`);
                    
                    // Fetch latest from remote
                    await this.git.fetch(['origin']);
                    
                    // Check if local branch exists
                    const branches = await this.git.branchLocal();
                    const localBranchExists = branches.all.includes(this.branch);
                    
                    if (localBranchExists) {
                        // Checkout existing local branch
                        await this.git.checkout(this.branch);
                        console.log(`Checked out existing local branch: ${this.branch}`);
                    } else {
                        // Check if remote branch exists
                        const remoteBranches = await this.git.branch(['-r']);
                        const remoteBranchExists = remoteBranches.all.includes(`origin/${this.branch}`);
                        
                        if (remoteBranchExists) {
                            // Checkout remote branch
                            await this.git.checkout(this.branch);
                            console.log(`Checked out remote branch: ${this.branch}`);
                        } else {
                            // Create new branch from current HEAD
                            await this.git.checkoutLocalBranch(this.branch);
                            console.log(`Created new local branch: ${this.branch}`);
                            
                            // Push to create remote tracking branch
                            await this.git.push(['--set-upstream', 'origin', this.branch]);
                            console.log(`Pushed new branch to remote: ${this.branch}`);
                        }
                    }
                } else {
                    console.log(`Already on correct branch: ${this.branch}`);
                }
            } catch (error) {
                console.error(`Failed to checkout branch ${this.branch}:`, error);
                // Don't throw, let it continue with current branch
            }
        }
    }

    /**
     * Configure git user settings
     */
    private async configureGit(): Promise<void> {
        if (!this.git) return;

        try {
            // Try to get global git config
            const globalName = await this.git.raw(['config', '--global', 'user.name']).catch(() => '');
            const globalEmail = await this.git.raw(['config', '--global', 'user.email']).catch(() => '');

            // If not set globally, set local config
            if (!globalName.trim()) {
                await this.git.addConfig('user.name', 'VSCode Auto Git User', false);
            }
            if (!globalEmail.trim()) {
                await this.git.addConfig('user.email', 'autogit@vscode.local', false);
            }

            // Don't configure credential helper - use authenticated URL instead
            // credential-cache doesn't work on Windows
            
            // Remove any existing credential helper config
            try {
                await this.git.raw(['config', '--unset', 'credential.helper']);
                console.log('Removed credential helper config');
            } catch (e) {
                // Ignore if config doesn't exist
            }
            
            // Explicitly disable credential helper to prevent Git from using system defaults
            await this.git.addConfig('credential.helper', '', false);
            console.log('Disabled credential helper');
            
        } catch (error) {
            console.error('Failed to configure git:', error);
        }
    }

    /**
     * Build authenticated URL with token
     */
    private buildAuthenticatedUrl(repoUrl: string, token: string): string {
        // Remove .git suffix if present
        const cleanUrl = repoUrl.replace(/\.git$/, '');
        
        const match = cleanUrl.match(/https:\/\/github\.com\/(.+)/);
        
        if (!match) {
            throw new Error('Invalid GitHub repository URL');
        }

        // Build authenticated URL
        return `https://x-access-token:${token}@github.com/${match[1]}.git`;
    }

    /**
     * Set API service and assignment code for deadline check
     */
    setClassInfo(apiService: any, assignmentCode: string, classCode?: string): void {
        this.apiService = apiService;
        this.assignmentCode = assignmentCode;
        this.classCode = classCode || assignmentCode; // fallback to assignmentCode if classCode not provided
    }

    /**
     * Enable auto-push on save
     */
    enableAutoPush(): void {
        this.autoPushEnabled = true;
    }

    /**
     * Disable auto-push
     */
    disableAutoPush(): void {
        this.autoPushEnabled = false;
    }

    /**
     * Check if auto-push is enabled
     */
    isAutoPushEnabled(): boolean {
        return this.autoPushEnabled;
    }

    /**
     * Auto commit and push changes
     */
    async autoPush(filePath?: string): Promise<void> {
        if (!this.git || !this.workspacePath || !this.autoPushEnabled) {
            return;
        }

        try {
            // Check deadline before allowing push (Student only)
            if (this.apiService && this.assignmentCode) {
                try {
                    const deadlineCheck = await this.apiService.checkDeadline(this.assignmentCode);
                    if (!deadlineCheck.canPush) {
                        const deadlineStr = deadlineCheck.deadline 
                            ? new Date(deadlineCheck.deadline).toLocaleString('vi-VN')
                            : '';
                        throw new Error(`⏰ Đã hết hạn nộp bài! Deadline: ${deadlineStr}`);
                    }
                } catch (error: any) {
                    // If error message contains deadline info, throw it
                    if (error.message && error.message.includes('Deadline')) {
                        throw error;
                    }
                    // Otherwise, log error and continue (might be network issue)
                    console.warn('Could not check deadline:', error.message);
                }
            }

            // Check if there are any changes
            const status = await this.git.status();
            
            console.log('[DEBUG] Git status:', {
                filesCount: status.files.length,
                files: status.files.map(f => ({ path: f.path, status: f.working_dir })),
                isClean: status.isClean()
            });
            
            if (status.files.length === 0) {
                console.log('No changes to commit - repository is clean');
                return;
            }

            // Add all changes
            console.log('[DEBUG] Adding files to git...');
            await this.git.add('.');

            // Create commit message
            const timestamp = new Date().toISOString();
            const changedFiles = status.files.map(f => f.path).join(', ');
            const commitMessage = `Auto-commit: ${changedFiles} at ${timestamp}`;
            
            console.log('[DEBUG] Creating commit:', commitMessage);

            // Commit changes
            await this.git.commit(commitMessage);
            console.log('[DEBUG] Commit created successfully');

            // Push to remote
            console.log('[DEBUG] Push config:', {
                hasToken: !!this.token,
                tokenPrefix: this.token ? this.token.substring(0, 10) + '...' : 'null',
                tokenLength: this.token ? this.token.length : 0,
                tokenStartsWith: this.token ? this.token.substring(0, 4) : 'null',
                repoUrl: this.repoUrl,
                branch: this.branch
            });
            
            if (this.token && this.repoUrl && this.branch) {
                const authenticatedUrl = this.buildAuthenticatedUrl(this.repoUrl, this.token);
                console.log('[DEBUG] Authenticated URL:', authenticatedUrl.replace(this.token, '***TOKEN***'));
                
                // Try to set remote URL with token (might fail due to permission on Windows)
                let remoteUrlSet = false;
                try {
                    await this.git.remote(['set-url', 'origin', authenticatedUrl]);
                    console.log('[DEBUG] Remote URL updated successfully');
                    remoteUrlSet = true;
                } catch (remoteError: any) {
                    console.warn('[DEBUG] Could not set remote URL (permission denied), will push with explicit URL:', remoteError.message);
                    remoteUrlSet = false;
                }
                
                try {
                    // Try to push
                    console.log('[DEBUG] Attempting push to ' + (remoteUrlSet ? 'origin/' : '') + this.branch);
                    
                    if (remoteUrlSet) {
                        // Remote URL was set, use normal push
                        await this.git.push('origin', this.branch);
                    } else {
                        // Remote URL couldn't be set, use explicit authenticated URL
                        await this.git.push(authenticatedUrl, this.branch);
                    }
                    
                    console.log(`✅ Auto-pushed changes to ${this.branch}`);
                    
                    // Update commit count in backend after successful push
                    if (this.apiService && this.assignmentCode) {
                        try {
                            await this.apiService.updateAssignmentCommitCount(this.assignmentCode);
                            console.log('[DEBUG] ✅ Commit count updated in backend');
                        } catch (apiError) {
                            console.error('[DEBUG] Failed to update commit count:', apiError);
                            // Don't throw - push was successful, just log the error
                        }
                    }
                } catch (pushError: any) {
                    console.error('[DEBUG] Push error:', pushError.message);
                    // If push failed due to remote changes, pull and retry
                    if (pushError.message.includes('rejected') || pushError.message.includes('fetch first')) {
                        console.log('Push rejected, pulling remote changes first...');
                        
                        try {
                            // Pull with rebase to avoid merge commits
                            if (remoteUrlSet) {
                                await this.git.pull('origin', this.branch, {'--rebase': 'true'});
                            } else {
                                await this.git.pull(authenticatedUrl, this.branch, {'--rebase': 'true'});
                            }
                            console.log('Pulled remote changes successfully');
                            
                            // Retry push
                            if (remoteUrlSet) {
                                await this.git.push('origin', this.branch);
                            } else {
                                await this.git.push(authenticatedUrl, this.branch);
                            }
                            console.log(`Auto-pushed changes to ${this.branch} after pull`);
                            
                            // Update commit count in backend after successful push
                            if (this.apiService && this.assignmentCode) {
                                try {
                                    await this.apiService.updateAssignmentCommitCount(this.assignmentCode);
                                    console.log('[DEBUG] ✅ Commit count updated in backend after pull');
                                } catch (apiError) {
                                    console.error('[DEBUG] Failed to update commit count:', apiError);
                                }
                            }
                        } catch (pullError: any) {
                            console.error('Failed to pull and push:', pullError);
                            throw new Error(`Failed to sync with remote: ${pullError.message}`);
                        }
                    } else {
                        throw pushError;
                    }
                }
            }
        } catch (error: any) {
            console.error('Auto-push failed:', error);
            throw new Error(`Auto-push failed: ${error.message}`);
        }
    }

    /**
     * Manual commit and push
     */
    async commitAndPush(message: string): Promise<void> {
        if (!this.git || !this.workspacePath) {
            throw new Error('Git not initialized');
        }

        try {
            await this.git.add('.');
            await this.git.commit(message);

            if (this.token && this.repoUrl && this.branch) {
                const authenticatedUrl = this.buildAuthenticatedUrl(this.repoUrl, this.token);
                await this.git.remote(['set-url', 'origin', authenticatedUrl]);
                await this.git.push('origin', this.branch);
            }
        } catch (error: any) {
            throw new Error(`Commit and push failed: ${error.message}`);
        }
    }

    /**
     * Pull latest changes
     */
    async pull(): Promise<void> {
        if (!this.git) {
            throw new Error('Git not initialized');
        }

        try {
            await this.git.pull('origin', this.branch || 'main');
        } catch (error: any) {
            throw new Error(`Pull failed: ${error.message}`);
        }
    }

    /**
     * Get current status
     */
    async getStatus(): Promise<any> {
        if (!this.git) {
            throw new Error('Git not initialized');
        }

        return await this.git.status();
    }

    /**
     * Get workspace path
     */
    getWorkspacePath(): string | null {
        return this.workspacePath;
    }
}
