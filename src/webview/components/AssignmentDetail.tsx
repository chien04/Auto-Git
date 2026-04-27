import React, { useState, useEffect } from 'react';
import { StudentSubmissionDTO } from '../../services/apiService';
import StudentResultView from './StudentResultView';
import 'katex/dist/katex.min.css';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';

const ReactMarkdown = require('react-markdown').default;
const remarkGfm = require('remark-gfm').default;
const remarkMath = require('remark-math').default;
const rehypeKatex = require('rehype-katex').default;

interface AssignmentDetailProps {
  vscode: any;
  apiService: any;
  assignment: Assignment;
  onBack: () => void;
  isTeacher?: boolean;
  user: any;
}

interface Assignment {
  assignmentId: string;
  assignmentCode: string;
  title: string;
  description: string;
  tasks?: AssignmentTask[];
  assignmentTasks?: AssignmentTask[];
  deadline: string;
  studentCount: number;
  className?: string;
  classCode?: string;
  commitCount?: number;
  lastCommitAt?: string;
}

interface AssignmentTask {
  orderNo?: number;
  taskName?: string;
  description?: string;
}

const AssignmentDetail: React.FC<AssignmentDetailProps> = ({ vscode, apiService, assignment, onBack, isTeacher = true, user }) => {
  const [submissions, setSubmissions] = useState<StudentSubmissionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState(1);
  const [viewingResultFor, setViewingResultFor] = useState<{ studentId?: number, studentName?: string } | null>(null);

  const normalizedTasks = React.useMemo(() => {
    const incomingTasks = (assignment.tasks && assignment.tasks.length > 0)
      ? assignment.tasks
      : (assignment.assignmentTasks && assignment.assignmentTasks.length > 0)
        ? assignment.assignmentTasks
        : [];

    if (incomingTasks.length === 0) {
      return [{
        id: 1,
        orderNo: 1,
        taskName: 'Task 1',
        description: assignment.description || ''
      }];
    }

    return incomingTasks.map((task, index) => ({
      id: index + 1,
      orderNo: task.orderNo || index + 1,
      taskName: (task.taskName && task.taskName.trim()) ? task.taskName.trim() : `Task ${index + 1}`,
      description: task.description || ''
    }));
  }, [assignment.tasks, assignment.assignmentTasks, assignment.description]);

  const activeTask = normalizedTasks.find((task) => task.id === activeTaskId) || normalizedTasks[0];

  useEffect(() => {
    loadSubmissions();
    // Scroll to top when viewing assignment detail
    window.scrollTo(0, 0);

    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'submissionsLoaded') {
        setSubmissions(message.submissions);
        setLoading(false);
      } else if (message.type === 'submissionsError') {
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [assignment.assignmentCode]);

  useEffect(() => {
    setActiveTaskId(1);
  }, [assignment.assignmentCode]);

  const loadSubmissions = () => {
    setLoading(true);
    vscode.postMessage({
      type: 'getAssignmentSubmissions',
      assignmentCode: assignment.assignmentCode
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `Tháng ${month}, ${day}`;
  };

  const handleTeacherViewResult = (student: StudentSubmissionDTO) => {
    setViewingResultFor({
      studentId: student.studentId,
      studentName: student.studentName
    });
  }

  const handleViewResult = () => {
    setViewingResultFor({
      studentName: 'Bạn'
    });
  }

  const handleExportExcel = () => {
    vscode.postMessage({
      type: 'exportAssignmentExcel',
      assignmentId: assignment.assignmentId,
      assignmentCode: assignment.assignmentCode,
      title: assignment.title
    });
  };

  const formatScore = (score: number | null) => {
    if (score === null || score === undefined) return 'Chưa chấm';
    return `${score}`; // Only show the number, not "/10"
  };

  const handleOpenWorkspace = () => {
    vscode.postMessage({
      type: 'openAssignment',
      assignmentCode: assignment.assignmentCode
    });
  };

  const markdownPreviewComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="mb-2 text-base font-bold tracking-tight text-[#111318]">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-2 mt-3 text-[15px] font-bold text-[#111318]">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-1.5 mt-2.5 text-sm font-semibold text-[#111318]">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-2.5 text-[13px] leading-6 text-gray-700">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-2.5 ml-5 list-disc space-y-1 text-[13px] text-gray-700">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-2.5 ml-5 list-decimal space-y-1 text-[13px] text-gray-700">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-[#111318]">{children}</strong>
    ),
    code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => {
      if (inline) {
        return (
          <code className="rounded bg-[#ecedfa] px-1.5 py-0.5 font-mono text-[0.9em] text-[#135bec]">
            {children}
          </code>
        );
      }

      return (
        <pre className="mb-3 overflow-x-auto rounded-lg bg-[#191b24] p-4 text-sm text-white">
          <code>{children}</code>
        </pre>
      );
    }
  };

  if (viewingResultFor) {
    return (
      <StudentResultView
        vscode={vscode}
        assignmentCode={assignment.assignmentCode}
        studentId={viewingResultFor.studentId}
        studentName={viewingResultFor.studentName}
        onBack={() => setViewingResultFor(null)}
      />
    );
  }

  return (
    <div className="bg-white text-gray-900 min-h-screen flex justify-center">
      <div className="w-full max-w-[420px] bg-white flex flex-col min-h-screen pb-5 shadow-[0_12px_30px_rgba(17,19,24,0.10)]">
        <div className="px-4 py-3">
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

        <main className="flex flex-col flex-1">
          <div className="px-4 py-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-[0_8px_28px_rgba(17,19,24,0.08)] border border-[#eef2f9]">
              <div className="flex items-center justify-between mb-1">
                {assignment.className && (
                  <h1 className="text-xl font-bold text-black">
                    {assignment.className}
                  </h1>
                )}
                <div className="flex items-center gap-2">
                  {/* Nút Kết quả hiển thị cho Sinh viên */}
                  {!isTeacher && (
                    <button
                      onClick={() => { handleViewResult() }}
                      className="bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Kết quả
                    </button>
                  )}
                  <button
                    onClick={handleOpenWorkspace}
                    className="bg-[#135bec] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-800 transition-colors"
                  >
                    {isTeacher ? 'Đồng bộ & mở' : 'Mở'}
                  </button>
                </div>
              </div>

              {assignment.classCode && (
                <p className="text-sm text-gray-600 mb-2.5">
                  Mã lớp: <span className="font-semibold">{assignment.classCode}</span>
                </p>
              )}

              <h2 className="text-lg font-bold text-black mb-3">
                {assignment.title}
              </h2>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Deadline: {new Date(assignment.deadline).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-start">
              {normalizedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setActiveTaskId(task.id)}
                  className={`pr-3 pl-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-tight whitespace-nowrap transition-colors ${task.id === activeTask?.id
                    ? 'bg-[#e8f0ff] text-[#135bec] border border-[#d6e4ff]'
                    : 'bg-[#f7f9fc] text-[#5a6478] border border-[#e7edf6] hover:bg-[#f1f5fb]'
                    }`}
                >
                  {task.taskName}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(17,19,24,0.08)] border border-[#eef2f9]">

              <div className="p-4 text-sm leading-relaxed markdown-preview">
                {(activeTask?.description || '').trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownPreviewComponents}>
                    {activeTask?.description || ''}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-700">Không có mô tả</p>
                )}
              </div>
            </div>
          </div>

          {/* {isTeacher && ( */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold tracking-tight text-black">
                Danh sách nộp bài ({submissions.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white text-gray-700 shadow-[0_4px_12px_rgba(17,19,24,0.14)] hover:bg-gray-50 transition-colors"
                  title="Xuất file Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </button>
                <button
                  onClick={loadSubmissions}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white text-gray-700 shadow-[0_4px_12px_rgba(17,19,24,0.14)] hover:bg-gray-50 transition-colors"
                  title="Tải lại danh sách"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-zinc-500 text-[13px]">
                Đang tải dữ liệu...
              </div>
            ) : (
              <div className="w-full overflow-hidden">
                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-[13px]">
                    Chưa có sinh viên nộp bài
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                          Họ và tên
                        </th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 text-right">
                          Điểm
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100/50">
                      {submissions.map((submission, index) => (
                        <tr key={submission.studentId || index}
                          className="hover:bg-zinc-50 transition-colors group cursor-pointer"
                          onClick={() => handleTeacherViewResult(submission)}
                        >
                          <td className="px-6 py-4">
                            <span className="text-[13px] font-bold text-black group-hover:underline cursor-pointer">
                              {submission.studentName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-[13px] font-bold text-black">
                              {formatScore(submission.score)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          {/* )} */}
        </main>
      </div>
    </div>
  );
};

export default AssignmentDetail;
