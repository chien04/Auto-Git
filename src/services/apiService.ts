import axios, { AxiosInstance } from 'axios';

export interface LoginResponse {
    token: string;
    email: string;
    name: string;
    userId: string;
    role?: string;
}

export interface CreateClassResponse {
    classId: string;
    classCode: string;
    className: string;
}

export interface JoinClassResponse {
    studentId: string;
}

export interface CreateAssignmentResponse {
    assignmentId: string;
    assignmentCode: string;
    title: string;
    repoUrl: string;
    token: string;
    deadline?: string;
}

export interface JoinAssignmentResponse {
    repoUrl: string;
    branch: string;
    token: string;
    studentId: string;
    assignmentTitle: string;
    deadline?: string;
}

export interface StudentDashboard {
    totalCommits: number;
    lastCommitAt: string | null;
    totalClasses: number;
    activeClasses: number;
}

export interface TeacherDashboard {
    totalStudents: number;
    studentsSubmitted: number;
    studentsNotSubmitted: number;
    submittedPercentage: number;
    notSubmittedPercentage: number;
    averageCommitsPerStudent: number;
    totalClasses: number;
    activeClasses: number;
}

export interface CommitActivity {
    dailyCommits: { [date: string]: number };
}

export interface ClassStatistics {
    classId: number;
    className: string;
    classCode: string;
    totalStudents: number;
    studentsSubmitted: number;
    studentsNotSubmitted: number;
    submittedPercentage: number;
    notSubmittedPercentage: number;
    isActive: boolean;
}

export interface CreateCodeCommentRequest {
    assignmentCode: string;
    targetBranch: string;
    studentFilePath: string;
    filePath?: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    selectedText?: string;
    comment: string;
}

export interface CodeCommentResponse {
    id: number;
    assignmentId: number;
    studentId: number;
    targetBranch: string;
    studentFilePath: string;
    filePath?: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    selectedText?: string;
    content: string;
    authorId: number;
    authorName: string;
    status: 'OPEN' | 'RESOLVED' | 'DELETED';
    createdAt: string;
    updatedAt: string;
}

export interface ResolveCommentResponse extends CodeCommentResponse {}

export class ApiService {
    private api: AxiosInstance;
    private baseURL: string;
    private jwtToken: string | null = null;

    constructor(baseURL: string = 'http://localhost:8080/api') {
        this.baseURL = baseURL;
        this.api = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add request interceptor to include JWT token and log API calls
        this.api.interceptors.request.use(
            (config) => {
                if (this.jwtToken) {
                    config.headers.Authorization = `Bearer ${this.jwtToken}`;
                }

                // Log API call for debugging
                const method = (config.method || 'GET').toUpperCase();
                const url = config.url || '';
                const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

                console.log(`[API ${method}] ${fullUrl}`);

                // Log payload if exists
                if (config.data) {
                    console.log(`[Payload]`, config.data);
                }

                // Log query params if exists
                if (config.params) {
                    console.log(`[Params]`, config.params);
                }

                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
    }

    setToken(token: string | null) {
        this.jwtToken = token;
    }

    getToken(): string | null {
        return this.jwtToken;
    }

    /**
     * Initiate Google OAuth login
     * Returns the authorization URL for the user to login
     */
    async initiateGoogleLogin(): Promise<string> {
        try {
            const response = await this.api.get('/auth/google/url');
            return response.data.authUrl;
        } catch (error: any) {
            throw new Error(`Failed to initiate Google login: ${error.message}`);
        }
    }

    /**
     * Exchange authorization code for JWT token
     */
    async handleGoogleCallback(code: string, role: string): Promise<LoginResponse> {
        try {
            const response = await this.api.post('/auth/google/callback', { code, role });
            const data = response.data;
            this.setToken(data.token);
            return data;
        } catch (error: any) {
            throw new Error(`Failed to complete Google login: ${error.response?.data?.name || error.message}`);
        }
    }

    async createClass(className: string): Promise<CreateClassResponse> {
        try {
            const response = await this.api.post('/class/create', { className });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to create class: ${error.response?.data?.message || error.message}`);
        }
    }

    async joinClass(studentName: string, classCode: string): Promise<JoinClassResponse> {
        try {
            const response = await this.api.post('/class/join', {
                studentName,
                classCode
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to join class: ${error.response?.data?.message || error.message}`);
        }
    }

    async createAssignment(classCode: string, title: string, description: string, deadline?: string): Promise<CreateAssignmentResponse> {
        try {
            const response = await this.api.post('/assignment/create', {
                classCode,
                title,
                description,
                deadline: deadline || null
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to create assignment: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Teacher: Upload test cases ZIP file
     */
    async uploadTestCasesZip(assignmentCode: string, fileName: string, fileContent: string): Promise<any> {
        try {
            const response = await this.api.post('/test-cases/upload-zip', {
                assignmentCode,
                fileName,
                fileContent // base64 encoded
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to upload test cases ZIP: ${error.response?.data?.message || error.message}`);
        }
    }

    async joinAssignment(assignmentCode: string, localPath: string): Promise<JoinAssignmentResponse> {
        try {
            const response = await this.api.post('/assignment/join', {
                assignmentCode,
                localPath
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to join assignment: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Update commit count for student assignment (called after push)
     */
    async updateAssignmentCommitCount(assignmentCode: string): Promise<void> {
        try {
            console.log('[API] Updating commit count for assignment:', assignmentCode);
            await this.api.post(`/assignment/${assignmentCode}/update-commits`);
            console.log('[API] ✅ Commit count updated successfully');
        } catch (error: any) {
            console.error('[API] Failed to update commit count:', error);
            throw new Error(`Failed to update commit count: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get all assignments in a class
     */
    async getAssignments(classCode: string): Promise<any[]> {
        try {
            const response = await this.api.get(`/assignment/class/${classCode}`);
            console.log(`[DEBUG] getAssignments response for ${classCode}:`, JSON.stringify(response.data, null, 2));
            response.data.forEach((assignment: any) => {
                console.log(`[DEBUG] Assignment ${assignment.assignmentCode}: joined=${assignment.joined}, localPath=${assignment.localPath}`);
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get assignments: ${error.response?.data?.message || error.message}`);
        }
    }

    async getAssignmentStudents(assignmentCode: string): Promise<any[]> {
        try {
            const response = await this.api.get(`/assignment/${assignmentCode}/students`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get assignment students: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Delete an assignment
     */
    async deleteAssignment(assignmentCode: string): Promise<void> {
        try {
            await this.api.delete(`/assignment/${assignmentCode}`);
        } catch (error: any) {
            throw new Error(`Failed to delete assignment: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get class information
     */
    async getClassInfo(classCode: string): Promise<any> {
        try {
            const response = await this.api.get(`/class/${classCode}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get class info: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get student branches for a class (for teachers)
     */
    async getStudentBranches(classCode: string): Promise<any> {
        try {
            const response = await this.api.get(`/class/${classCode}/students`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get student branches: ${error.response?.data?.message || error.message}`);
        }
    }

    async requestOTP(email: string): Promise<{ success: boolean, message: string }> {
        try {
            const response = await this.api.post('/auth/otp/request', { email });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to request OTP: ${error.response?.data?.message || error.message}`);
        }
    }

    async verifyOTP(email: string, otp: string, role: string): Promise<LoginResponse> {
        try {
            const response = await this.api.post('/auth/otp/verify', { email, otp, role });
            const data = response.data;
            this.setToken(data.token);
            return data;
        } catch (error: any) {
            throw new Error(`Failed to verify OTP: ${error.response?.data?.name || error.message}`);
        }
    }

    /**
     * Get my classes (both as teacher and student)
     */
    async getMyClasses(): Promise<{ teacherClasses: any[], studentClasses: any[] }> {
        try {
            const response = await this.api.get('/class/my-classes');
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get classes: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get students in a class
     */
    async getStudents(classCode: string): Promise<any[]> {
        try {
            const response = await this.api.get(`/class/${classCode}/students`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get students: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Delete a class (Teacher)
     */
    async deleteClass(classCode: string): Promise<void> {
        console.log('apiService.deleteClass called with:', classCode);
        try {
            console.log('Making DELETE request to:', `/class/${classCode}`);
            const response = await this.api.delete(`/class/${classCode}`);
            console.log('Delete class response:', response);
        } catch (error: any) {
            console.error('Delete class API error:', error);
            throw new Error(`Failed to delete class: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Leave a class (Student)
     */
    async leaveClass(classCode: string): Promise<void> {
        console.log('apiService.leaveClass called with:', classCode);
        try {
            console.log('Making DELETE request to:', `/class/${classCode}/leave`);
            const response = await this.api.delete(`/class/${classCode}/leave`);
            console.log('Leave class response:', response);
        } catch (error: any) {
            console.error('Leave class API error:', error);
            throw new Error(`Failed to leave class: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get commits for a branch
     */
    async getCommits(classCode: string, branchName: string): Promise<any[]> {
        try {
            const encodedBranch = encodeURIComponent(branchName);
            const response = await this.api.get(`/class/${classCode}/commits?branch=${encodedBranch}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get commits: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get commit URL for viewing code
     */
    async getCommitUrl(classCode: string, branchName: string, commitSha: string): Promise<{ url: string }> {
        try {
            const encodedBranch = encodeURIComponent(branchName);
            const response = await this.api.get(`/class/${classCode}/commit/${commitSha}?branch=${encodedBranch}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get commit URL: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Setup workspace for class (Teacher only)
     */
    async setupWorkspace(classCode: string): Promise<{ workspaceFilePath: string; message: string }> {
        try {
            const response = await this.api.post(`/class/${classCode}/workspace/setup`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to setup workspace: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Check if workspace exists
     */
    async checkWorkspaceExists(classCode: string): Promise<boolean> {
        try {
            const response = await this.api.get(`/class/${classCode}/workspace/exists`);
            return response.data.exists;
        } catch (error: any) {
            return false;
        }
    }

    /**
     * Update workspace (add new students)
     */
    async updateWorkspace(classCode: string): Promise<{ message: string }> {
        try {
            const response = await this.api.post(`/class/${classCode}/workspace/update`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to update workspace: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Get local path for class
     */
    async getLocalPath(classCode: string): Promise<{ localPath: string; role: string }> {
        try {
            const response = await this.api.get(`/class/${classCode}/localPath`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get local path: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Sync workspace - fetch and pull latest code (Teacher only)
     */
    async syncWorkspace(classCode: string): Promise<{ message: string }> {
        try {
            console.log('[API] Syncing workspace for class:', classCode);
            console.log('[API] Request URL:', `${this.baseURL}/class/${classCode}/workspace/sync`);
            console.log('[API] Token:', this.jwtToken ? 'Present' : 'Missing');

            const response = await this.api.post(`/class/${classCode}/workspace/sync`);

            console.log('[API] Sync workspace response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('[API] Sync workspace error:', error);
            console.error('[API] Error response:', error.response?.data);
            throw new Error(`Failed to sync workspace: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Setup assignment workspace (Teacher only)
     */
    async setupAssignmentWorkspace(assignmentCode: string, localPath?: string): Promise<{ message: string, workspacePath: string }> {
        try {
            console.log('[API] Setting up assignment workspace:', assignmentCode);
            const response = await this.api.post(`/assignment/${assignmentCode}/workspace/setup`, {
                localPath: localPath || null
            });
            console.log('[API] Setup workspace response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('[API] Setup workspace error:', error);
            throw new Error(`Failed to setup workspace: ${error.response?.data?.error || error.message}`);
        }
    }

    async syncAssignmentWorkspace(assignmentCode: string, localPath?: string): Promise<{ message: string }> {
        try {
            console.log('[API] Syncing assignment workspace:', assignmentCode);
            const response = await this.api.post(`/assignment/${assignmentCode}/workspace/sync`, {
                localPath: localPath || null
            });
            console.log('[API] Sync workspace response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('[API] Sync workspace error:', error);
            throw new Error(`Failed to sync workspace: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Get assignment workspace path (Teacher only)
     */
    async getAssignmentWorkspacePath(assignmentCode: string): Promise<{ workspacePath: string, exists: boolean }> {
        try {
            const response = await this.api.get(`/assignment/${assignmentCode}/workspace/path`);
            return response.data;
        } catch (error: any) {
            console.error('[API] Get workspace path error:', error);
            throw new Error(`Failed to get workspace path: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Remove student from class (Teacher only)
     */
    async removeStudent(classCode: string, studentId: string): Promise<{ message: string }> {
        try {
            const response = await this.api.delete(`/class/${classCode}/student/${studentId}`);
            return response.data;
        } catch (error: any) {
            console.error('[API] Remove student error:', error);
            throw new Error(`Failed to remove student: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Check if deadline has passed for an assignment (Student)
     */
    async checkDeadline(assignmentCode: string): Promise<{
        hasDeadline: boolean;
        deadline?: string;
        canPush: boolean;
        message: string;
    }> {
        try {
            const response = await this.api.get(`/assignment/${assignmentCode}/deadline/check`);
            return response.data;
        } catch (error: any) {
            console.error('[API] Check deadline error:', error);
            throw new Error(`Failed to check deadline: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Update commit count for student after push
     */
    async updateCommitCount(assignmentCode: string): Promise<{ commitCount: number; message: string }> {
        try {
            console.log('[API] Calling updateCommitCount for assignment:', assignmentCode);
            console.log('[API] JWT Token exists:', !!this.jwtToken);

            const response = await this.api.post(`/assignment/${assignmentCode}/update-commits`);

            console.log('[API] Update commit count SUCCESS:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('[API] Update commit count ERROR:', error);
            console.error('[API] Error response:', error.response?.data);
            console.error('[API] Error status:', error.response?.status);
            // Don't throw - this is not critical
            return { commitCount: 0, message: 'Failed to update: ' + (error.response?.data?.error || error.message) };
        }
    }

    /**
     * Get dashboard data for student
     */
    async getStudentDashboard(): Promise<StudentDashboard> {
        const response = await this.api.get('/dashboard/student');
        return response.data;
    }

    /**
     * Get dashboard data for teacher
     */
    async getTeacherDashboard(): Promise<TeacherDashboard> {
        const response = await this.api.get('/dashboard/teacher');
        return response.data;
    }

    /**
     * Get commit activity heatmap for student
     */
    async getStudentActivity(): Promise<CommitActivity> {
        const response = await this.api.get('/dashboard/student/activity');
        return response.data;
    }

    /**
     * Get class statistics for teacher
     */
    async getTeacherClassStatistics(): Promise<ClassStatistics[]> {
        const response = await this.api.get('/dashboard/teacher/classes');
        return response.data;
    }

    /**
     * Get assignment submissions (list of students with their submission info)
     */
    async getAssignmentSubmissions(assignmentCode: string): Promise<StudentSubmissionDTO[]> {
        try {
            const response = await this.api.get(`/assignment/${assignmentCode}/submissions`);
            return response.data;
        } catch (error: any) {
            console.error('[API] Get assignment submissions ERROR:', error);
            throw new Error(`Failed to get submissions: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
 * Export assignment scores to Excel
 */
    async exportAssignmentExcel(assignmentId: string): Promise<ArrayBuffer> {
        try {
            const response = await this.api.get(`/assignment/export-excel/${parseInt(assignmentId, 10)}`, {
                responseType: 'arraybuffer',
                headers: {
                    Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[API] Export assignment excel ERROR:', error);
            throw new Error(`Failed to export excel: ${error.response?.data?.error || error.message}`);
        }
    }

    async createCodeComment(payload: CreateCodeCommentRequest): Promise<CodeCommentResponse> {
        try {
            const response = await this.api.post('/assignment/comments', payload);
            return response.data;
        } catch (error: any) {
            console.error('[API] Create code comment ERROR:', error);
            throw new Error(`Failed to create comment: ${error.response?.data?.error || error.message}`);
        }
    }

    async getCodeComments(assignmentCode: string, targetBranch: string, studentFilePath: string): Promise<CodeCommentResponse[]> {
        try {
            const response = await this.api.get('/assignment/comments', {
                params: {
                    assignmentCode,
                    targetBranch,
                    studentFilePath
                }
            });
            return response.data || [];
        } catch (error: any) {
            console.error('[API] Get code comments ERROR:', error);
            throw new Error(`Failed to get comments: ${error.response?.data?.error || error.message}`);
        }
    }

    async resolveCodeComment(commentId: number): Promise<ResolveCommentResponse> {
        try {
            const response = await this.api.patch(`/assignment/comments/${commentId}/resolve`, {});
            return response.data;
        } catch (error: any) {
            console.error('[API] Resolve code comment ERROR:', error);
            throw new Error(`Failed to resolve comment: ${error.response?.data?.error || error.message}`);
        }
    }

    // ===================== CHAT API =====================

    async getClassesWithMessages(): Promise<any[]> {
        const response = await this.api.get('/class/chat/classes-with-messages');
        return response.data || [];
    }

    async getRecentPrivateChats(): Promise<any[]> {
        const response = await this.api.get('/messages/recent-chats');
        return response.data || [];
    }

    async searchChatMembers(query?: string): Promise<any[]> {
        const url = query?.trim()
            ? `/class/chat/search-members?query=${encodeURIComponent(query)}`
            : '/class/chat/search-members';
        const response = await this.api.get(url);
        return response.data || [];
    }

    async getPrivateMessages(otherUserId: number): Promise<any[]> {
        const response = await this.api.get(`/messages/private/${otherUserId}`);
        return response.data || [];
    }

    async getClassMessages(classroomId: number): Promise<any[]> {
        const response = await this.api.get(`/messages/class/${classroomId}`);
        return response.data || [];
    }

    async markMessageAsRead(messageId: number): Promise<void> {
        await this.api.post(`/messages/${messageId}/read`, {});
    }

    // ===================== NOTIFICATION API =====================

    async getNotifications(): Promise<any[]> {
        const response = await this.api.get('/notifications');
        return response.data || [];
    }

    async markNotificationAsRead(notificationId: number): Promise<void> {
        await this.api.patch(`/notifications/${notificationId}/read`, {});
    }

    async deleteNotification(notificationId: number): Promise<void> {
        await this.api.delete(`/notifications/${notificationId}`);
    }

    async markAllNotificationsAsRead(): Promise<void> {
        await this.api.patch('/notifications/read-all', {});
    }
}

export interface StudentSubmissionDTO {
    studentId: number;
    studentName: string;
    studentCode: string;
    email: string;
    commitCount: number;  // Số lần nộp (Att.)
    lastCommitAt: string | null;  // Lần nộp cuối cùng
    score: number | null;  // Điểm (0-10)
}
