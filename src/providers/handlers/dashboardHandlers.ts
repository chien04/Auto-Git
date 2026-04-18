import { ApiService } from '../../services/apiService';

export async function handleGetTeacherClassStatistics(
    apiService: ApiService,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const data = await apiService.getTeacherClassStatistics();
        postMessage({
            type: 'teacherStatsLoaded',
            stats: data
        });
    } catch (error: any) {
        postMessage({
            type: 'teacherStatsError',
            error: error.message
        });
    }
}

export async function handleGetStudentDashboard(
    apiService: ApiService,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const data = await apiService.getStudentDashboard();
        postMessage({
            type: 'studentDashboardLoaded',
            dashboard: data
        });
    } catch (error: any) {
        postMessage({
            type: 'studentDashboardError',
            error: error.message
        });
    }
}

export async function handleGetStudentActivity(
    apiService: ApiService,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const data = await apiService.getStudentActivity();
        postMessage({
            type: 'studentActivityLoaded',
            activity: data
        });
    } catch (error: any) {
        postMessage({
            type: 'studentActivityError',
            error: error.message
        });
    }
}
