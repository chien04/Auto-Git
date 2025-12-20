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
    repoUrl: string;
    className: string;
    token: string;
    branch: string;
    deadline?: string;
}

export interface JoinClassResponse {
    repoUrl: string;
    branch: string;
    token: string;
    studentId: string;
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

        // Add request interceptor to include JWT token
        this.api.interceptors.request.use(
            (config) => {
                if (this.jwtToken) {
                    config.headers.Authorization = `Bearer ${this.jwtToken}`;
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

    /**
     * Teacher: Create a new class and repository
     */
    async createClass(className: string, localPath: string, deadline?: string): Promise<CreateClassResponse> {
        try {
            const response = await this.api.post('/class/create', { 
                className, 
                localPath,
                deadline: deadline || null
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to create class: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Student: Join a class using class code
     */
    async joinClass(studentName: string, classCode: string, localPath: string): Promise<JoinClassResponse> {
        try {
            const response = await this.api.post('/class/join', {
                studentName,
                classCode,
                localPath
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to join class: ${error.response?.data?.message || error.message}`);
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

    /**
     * Verify token validity
     */
    async verifyToken(): Promise<boolean> {
        try {
            await this.api.get('/auth/verify');
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Request OTP for email login
     */
    async requestOTP(email: string): Promise<{success: boolean, message: string}> {
        try {
            const response = await this.api.post('/auth/otp/request', { email });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to request OTP: ${error.response?.data?.message || error.message}`);
        }
    }
    
    /**
     * Verify OTP and get login token
     */
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
    async getMyClasses(): Promise<{teacherClasses: any[], studentClasses: any[]}> {
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
     * Check if deadline has passed for a class (Student)
     */
    async checkDeadline(classCode: string): Promise<{
        hasDeadline: boolean;
        deadline?: string;
        canPush: boolean;
        message: string;
    }> {
        try {
            const response = await this.api.get(`/class/${classCode}/deadline/check`);
            return response.data;
        } catch (error: any) {
            console.error('[API] Check deadline error:', error);
            throw new Error(`Failed to check deadline: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Update commit count for student after push
     */
    async updateCommitCount(classCode: string): Promise<{ commitCount: number; message: string }> {
        try {
            console.log('[API] Calling updateCommitCount for class:', classCode);
            console.log('[API] JWT Token exists:', !!this.jwtToken);
            
            const response = await this.api.post(`/class/${classCode}/student/update-commits`);
            
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
}
