import React, { useState, useEffect } from 'react';
import { StudentSubmissionDTO } from '../../services/apiService';

interface AssignmentDetailProps {
  vscode: any;
  apiService: any;
  assignment: Assignment;
  onBack: () => void;
  isTeacher?: boolean;
}

interface Assignment {
  assignmentId: string;
  assignmentCode: string;
  title: string;
  description: string;
  deadline: string;
  studentCount: number;
  className?: string;
  classCode?: string;
  commitCount?: number;
  lastCommitAt?: string;
}

const AssignmentDetail: React.FC<AssignmentDetailProps> = ({ vscode, apiService, assignment, onBack, isTeacher = true }) => {
  const [submissions, setSubmissions] = useState<StudentSubmissionDTO[]>([]);
  const [loading, setLoading] = useState(true);

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

  const formatScore = (score: number | null) => {
    if (score === null || score === undefined) return 'Chưa chấm';
    return `${score}`; // Only show the number, not "/10"
  };

  const handleOpenWorkspace = () => {
    vscode.postMessage({
      type: 'openAssignment',  // ✅ Auto-detect teacher/student
      assignmentCode: assignment.assignmentCode
    });
  };

  return (
    <div className="bg-white text-gray-900 min-h-screen flex justify-center">
      <div className="w-full max-w-[420px] bg-white flex flex-col min-h-screen border-x border-gray-200">
        {/* Back Button (no border) */}
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

        {/* Main Content */}
        <main className="flex flex-col flex-1">
          {/* Assignment Info Section */}
          <div className="px-4 py-4">
            {/* Class Name with Workspace Button */}
            <div className="flex items-center justify-between mb-1">
              {assignment.className && (
                <h1 className="text-xl font-bold text-black">
                  {assignment.className}
                </h1>
              )}
              <button 
                onClick={handleOpenWorkspace}
                className="bg-[#135bec] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-800 transition-colors"
              >
                <span>💻</span>
                Workspace
              </button>
            </div>
            
            {/* Class Code */}
            {assignment.classCode && (
              <p className="text-sm text-gray-600 mb-3">
                Mã lớp: <span className="font-semibold">{assignment.classCode}</span>
              </p>
            )}
            
            {/* Assignment Title */}
            <h2 className="text-lg font-bold text-black mb-2">
              {assignment.title}
            </h2>
            
            {/* Description (without label) */}
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {assignment.description || 'Không có mô tả'}
            </p>
            
            {/* Deadline */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📅</span>
              <span>Deadline: {new Date(assignment.deadline).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          {/* Student Submissions Table */}
          <div className="mt-2">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-bold tracking-tight text-black">
                Danh sách nộp bài ({submissions.length} sinh viên)
              </h3>
              {isTeacher && (
                <button 
                  onClick={loadSubmissions}
                  className="text-[16px] text-gray-600 hover:text-black"
                  title="Tải lại danh sách"
                >
                  🔄
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-600">
                Đang tải...
              </div>
            ) : (
              <div className="w-full text-[12px]">
                {/* Table Header */}
                <div className="flex items-center px-4 py-2 border-b border-gray-200 bg-gray-50 font-bold text-gray-600 uppercase tracking-tighter">
                  <div className="w-2/5">Sinh viên</div>
                  <div className="w-[15%] text-center">Lần</div>
                  <div className="w-1/4 text-center">Nộp cuối</div>
                  <div className="w-[20%] text-right">Điểm</div>
                </div>

                {/* Table Body */}
                {submissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    Chưa có sinh viên nộp bài
                  </div>
                ) : (
                  submissions.map((submission, index) => (
                    <div 
                      key={submission.studentId || index}
                      className="flex items-center px-4 py-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer group"
                    >
                      <div className="w-2/5 font-semibold truncate pr-2 text-black">
                        {submission.studentName}
                      </div>
                      <div className="w-[15%] text-center text-gray-600">
                        {submission.commitCount || 0}
                      </div>
                      <div className="w-1/4 text-center text-gray-600">
                        {formatDate(submission.lastCommitAt)}
                      </div>
                      <div className="w-[20%] text-right font-medium text-black">
                        {formatScore(submission.score)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AssignmentDetail;
