import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Code2, ChevronDown } from 'lucide-react';

interface TaskDTO {
    resultId: number;
    orderNo?: number | null;
    language: string;
    score: number;
    pass: number;
    total: number;
    status: string;
    errorMessage?: string | null;
    commitHash: string;
    sourceCode: string;
}

interface TaskWithHistoryDTO {
    taskId: number;
    taskOrderNo: number;
    taskName: string;
    bestScore: number; // Double trong Java map sang number trong JS
    maxScore: number;
    history: TaskDTO[] | null;
}

interface TaskResultResponse {
    totalScore: number;
    maxTotalScore: number;
    tasks: TaskWithHistoryDTO[];
}

interface StudentResultViewProps {
    vscode: any;
    assignmentCode: string;
    studentId?: number;
    studentName?: string;
    onBack: () => void;
}

const StudentResultView: React.FC<StudentResultViewProps> = ({
    vscode,
    assignmentCode,
    studentId,
    studentName,
    onBack,
}) => {
    const [data, setData] = useState<TaskResultResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);

        vscode.postMessage({
            type: 'viewResult',
            studentId,
            assignmentCode
        });

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'viewTaskResultSuccess') {
                setData(message.data);
                if (message.data?.tasks?.length > 0) {
                    setExpandedTaskId(message.data.tasks[0].taskId);
                }
                setLoading(false);
            } else if (message.type === 'viewTaskResultError') {
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [assignmentCode, studentId]);

    const handleViewSourceCode = (task: TaskWithHistoryDTO, record: TaskDTO, e: React.MouseEvent) => {
        e.stopPropagation();

        vscode.postMessage({
            type: 'viewStudentCode',
            sourceCode: record.sourceCode,
            language: record.language,
            taskName: task.taskName
        });
    };

    const toggleTask = (taskId: number) => {
        setExpandedTaskId(prev => prev === taskId ? null : taskId);
    };

    if (loading) {
        return (
            <div className="bg-white text-gray-900 min-h-screen flex justify-center">
                <div className="w-full max-w-[420px] bg-white flex flex-col min-h-screen items-center justify-center shadow-[0_12px_30px_rgba(17,19,24,0.10)]">
                    <span className="text-sm font-medium text-gray-500">Đang tải kết quả...</span>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-white text-gray-900 min-h-screen flex justify-center">
                <div className="w-full max-w-[420px] bg-white flex flex-col min-h-screen pb-5 shadow-[0_12px_30px_rgba(17,19,24,0.10)]">
                    <div className="px-4 py-3 bg-white sticky top-0 z-10 border-b border-gray-50">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors text-sm font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Quay lại
                        </button>
                    </div>
                    <div className="flex flex-1 items-center justify-center px-6 text-center">
                        <p className="text-sm font-medium text-gray-500">Không có dữ liệu kết quả để hiển thị.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white text-gray-900 min-h-screen flex justify-center">
            <div className="w-full max-w-[420px] bg-white flex flex-col min-h-screen pb-5 shadow-[0_12px_30px_rgba(17,19,24,0.10)]">

                {/* Header Navbar */}
                <div className="px-4 py-3 bg-white sticky top-0 z-10 border-b border-gray-50">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Quay lại
                    </button>
                </div>

                <main className="flex flex-col flex-1 px-4 py-4 space-y-5">

                    {/* Thẻ Tổng điểm */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_8px_28px_rgba(17,19,24,0.08)] border border-[#eef2f9] text-center">
                        <p className="text-sm font-medium text-gray-500 mb-2">
                            {studentName ? `Kết quả của: ${studentName}` : 'Tổng điểm đánh giá'}
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <h1 className="text-5xl font-bold text-black">{data.totalScore}</h1>
                            <span className="text-lg font-medium text-gray-400">/ {data.maxTotalScore}</span>
                        </div>
                    </div>

                    {/* Danh sách Task Accordion */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-black px-1">Chi tiết bài nộp</h3>

                        {data.tasks.map((task) => {
                            const isExpanded = expandedTaskId === task.taskId;
                            const isPerfect = task.bestScore === task.maxScore;

                            // Sắp xếp lịch sử giảm dần theo resultId
                            const sortedHistory = [...(task.history || [])].sort((a, b) => b.resultId - a.resultId);
                            const totalAttempts = sortedHistory.length;

                            return (
                                <div key={task.taskId} className="bg-white rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(17,19,24,0.06)] border border-[#eef2f9] transition-all">

                                    {/* Task Header (Có thể click để mở rộng) */}
                                    <div
                                        onClick={() => toggleTask(task.taskId)}
                                        className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50/80 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <h4 className="text-[15px] font-bold text-gray-900 mb-0.5">
                                                Task {task.taskOrderNo}: {task.taskName}
                                            </h4>
                                            <p className="text-[11px] font-medium text-gray-500">
                                                {totalAttempts > 0 ? `Đã nộp ${totalAttempts} lần` : 'Chưa nộp bài'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-base font-bold ${isPerfect ? 'text-green-600' : (task.bestScore > 0 ? 'text-orange-500' : 'text-gray-400')}`}>
                                                {task.bestScore}/{task.maxScore}
                                            </span>
                                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Task History Details (Phần xổ xuống) */}
                                    {isExpanded && (
                                        <div className="bg-zinc-50/80 border-t border-zinc-100 divide-y divide-zinc-200/60">
                                            {totalAttempts > 0 ? (
                                                sortedHistory.map((record) => {
                                                    const isRecordPerfect = record.pass === record.total && record.total > 0;

                                                    return (
                                                        <div key={record.resultId} className="p-4 hover:bg-zinc-100/50 transition-colors">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    {/* Chỉ hiển thị ngôn ngữ */}
                                                                    <span className="px-1.5 py-0.5 rounded-md bg-gray-200 text-[10px] font-bold uppercase text-gray-600 tracking-wider">
                                                                        Ngôn ngữ: {record.language}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-[14px] font-bold ${isRecordPerfect ? 'text-green-600' : 'text-gray-900'}`}>
                                                                    {record.score}/{task.maxScore}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center justify-between mt-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    {isRecordPerfect ? (
                                                                        <CheckCircle2 className="text-green-500" size={16} />
                                                                    ) : (
                                                                        <AlertCircle className="text-red-500" size={16} />
                                                                    )}
                                                                    <span className={`text-xs font-medium ${isRecordPerfect ? 'text-gray-700' : 'text-red-600'}`}>
                                                                        Vượt qua {record.pass}/{record.total} test
                                                                    </span>
                                                                </div>

                                                                {/* Nút Xem mã nguồn của LẦN NỘP này */}
                                                                <button
                                                                    onClick={(e) => handleViewSourceCode(task, record, e)}
                                                                    className="flex items-center gap-1.5 bg-white text-[#135bec] border border-[#d6e4ff] px-2.5 py-1.5 rounded-md text-[11px] font-bold hover:bg-[#edf3ff] transition-colors shadow-sm"
                                                                >
                                                                    <Code2 size={14} strokeWidth={2.5} /> Xem code
                                                                </button>
                                                            </div>
                                                            {record.errorMessage && (
                                                                <div className="mt-2 text-[11px] text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono overflow-x-auto">
                                                                    {record.errorMessage}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="p-6 text-center text-sm font-medium text-gray-500">
                                                    Chưa có lịch sử nộp bài cho task này.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentResultView;