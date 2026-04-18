import { ApiService } from '../../services/apiService';

export async function handleCreateCodeComment(
    apiService: ApiService,
    payload: any,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const created = await apiService.createCodeComment(payload);
        postMessage({
            type: 'codeCommentCreated',
            comment: created
        });

        const comments = await apiService.getCodeComments(
            payload.assignmentCode,
            payload.targetBranch,
            payload.studentFilePath
        );

        postMessage({
            type: 'codeCommentsLoaded',
            comments,
            context: {
                assignmentCode: payload.assignmentCode,
                targetBranch: payload.targetBranch,
                studentFilePath: payload.studentFilePath
            }
        });
    } catch (error: any) {
        postMessage({
            type: 'codeCommentError',
            error: error.message
        });
    }
}

export async function handleGetCodeComments(
    apiService: ApiService,
    assignmentCode: string,
    targetBranch: string,
    studentFilePath: string,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const comments = await apiService.getCodeComments(assignmentCode, targetBranch, studentFilePath);
        postMessage({
            type: 'codeCommentsLoaded',
            comments,
            context: {
                assignmentCode,
                targetBranch,
                studentFilePath
            }
        });
    } catch (error: any) {
        postMessage({
            type: 'codeCommentError',
            error: error.message
        });
    }
}

export async function handleResolveCodeComment(
    apiService: ApiService,
    commentId: number,
    assignmentCode: string,
    targetBranch: string,
    studentFilePath: string,
    postMessage: (message: any) => void
): Promise<void> {
    try {
        const resolved = await apiService.resolveCodeComment(commentId);
        postMessage({
            type: 'codeCommentResolved',
            comment: resolved
        });

        const comments = await apiService.getCodeComments(assignmentCode, targetBranch, studentFilePath);
        postMessage({
            type: 'codeCommentsLoaded',
            comments,
            context: {
                assignmentCode,
                targetBranch,
                studentFilePath
            }
        });
    } catch (error: any) {
        postMessage({
            type: 'codeCommentError',
            error: error.message
        });
    }
}
