import React, { useState, useEffect } from 'react';
import AssignmentDetail from './AssignmentDetail';

interface AssignmentListProps {
  vscode: any;
  apiService: any;
  classCode: string;
  isTeacher: boolean;
  currentAssignmentCode?: string; // Assignment code of currently opened workspace
  onViewChange?: (isDetailView: boolean) => void; // Notify parent when view changes
  className?: string;
}

interface Assignment {
  assignmentId: string;
  assignmentCode: string;
  title: string;
  description: string;
  repoUrl: string;
  deadline: string;
  studentCount: number;
  createdAt: string;
  joined?: boolean;
  commitCount?: number;
  lastCommitAt?: string;
  localPath?: string;
  className?: string;
  classCode?: string;
}

const AssignmentList: React.FC<AssignmentListProps> = ({ vscode, apiService, classCode, isTeacher, currentAssignmentCode, onViewChange, className }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAssignmentCode, setActiveAssignmentCode] = useState<string | undefined>(currentAssignmentCode);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    setActiveAssignmentCode(currentAssignmentCode);
  }, [currentAssignmentCode]);

  // Notify parent when view changes
  useEffect(() => {
    if (onViewChange) {
      onViewChange(!!selectedAssignment);
    }
  }, [selectedAssignment, onViewChange]);

  useEffect(() => {
    loadAssignments();
    // Request current workspace info when component mounts
    vscode.postMessage({ type: 'getCurrentWorkspace' });

    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'assignmentJoinedSuccess') {
        loadAssignments();
      } else if (message.type === 'currentWorkspaceInfo') {
        setActiveAssignmentCode(message.assignmentCode);
      } else if (message.type === 'assignmentsLoaded') {
        setAssignments(message.assignments);
        setLoading(false);
      } else if (message.type === 'assignmentsError') {
        setLoading(false);
      } else if (message.type === 'assignmentDeleted') {
        loadAssignments();
      } else if (message.type === 'setupWorkspaceSuccess') {
        if (message.data && message.data.workspacePath) {
          vscode.postMessage({ type: 'openFolder', path: message.data.workspacePath });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [classCode]);

  const loadAssignments = () => {
    setLoading(true);
    vscode.postMessage({ 
      type: 'getAssignments', 
      classCode: classCode 
    });
  };

  const handleJoinAssignment = (assignment: Assignment) => {
    vscode.postMessage({ 
      type: 'joinAssignment', 
      assignmentCode: assignment.assignmentCode,
      title: assignment.title 
    });
  };

  const handleViewAssignmentFolder = (assignment: Assignment) => {
    if (assignment.localPath) {
      vscode.postMessage({ 
        type: 'openAssignmentFolder', 
        localPath: assignment.localPath 
      });
    }
  };

  const handleViewAssignment = (assignment: Assignment) => {
    vscode.postMessage({ 
      type: 'viewAssignment', 
      assignmentCode: assignment.assignmentCode 
    });
  };

  const handleOpenTeacherAssignment = (assignment: Assignment) => {
    vscode.postMessage({ 
      type: 'openTeacherAssignment', 
      assignmentCode: assignment.assignmentCode
    });
  };

  const handleSyncWorkspace = (assignment: Assignment, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Check if this is the currently opened workspace
    if (activeAssignmentCode && activeAssignmentCode !== assignment.assignmentCode) {
      alert('⚠️ Chỉ có thể sync bài tập hiện tại đang mở!\n\nVui lòng click vào bài tập để chuyển workspace trước.');
      return;
    }
    
    vscode.postMessage({ 
      type: 'syncAssignmentWorkspace', 
      assignmentCode: assignment.assignmentCode 
    });
  };

  const handleSetupWorkspace = (assignment: Assignment, event: React.MouseEvent) => {
    event.stopPropagation();
    // Send message to provider which will show VS Code confirmation dialog
    vscode.postMessage({ 
      type: 'setupAssignmentWorkspace', 
      assignmentCode: assignment.assignmentCode,
      title: assignment.title
    });
  };

  const handleDeleteAssignment = (assignment: Assignment) => {
    // Send message to provider which will show VS Code confirmation dialog
    vscode.postMessage({ 
      type: 'deleteAssignment', 
      assignmentCode: assignment.assignmentCode,
      title: assignment.title
    });
  };

  const formatDeadline = (deadline: string) => {
    if (!deadline) return 'Không có deadline';
    return new Date(deadline).toLocaleString('vi-VN');
  };

  const formatLastCommit = (lastCommitAt: string) => {
    if (!lastCommitAt) return 'Chưa có commit';
    return new Date(lastCommitAt).toLocaleString('vi-VN');
  };

  // Show detail view for both teacher and student
  if (selectedAssignment) {
    return (
      <AssignmentDetail
        vscode={vscode}
        apiService={apiService}
        assignment={{
          ...selectedAssignment,
          className: className,
          classCode: classCode
        }}
        onBack={() => setSelectedAssignment(null)}
        isTeacher={isTeacher}
      />
    );
  }

  if (loading) {
    return <div className="text-center p-10 text-[#616f89]">Đang tải bài tập...</div>;
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 px-5">
        <p className="text-[#616f89] mb-2">Chưa có bài tập nào</p>
        {isTeacher && <p className="text-xs text-[#616f89]">Nhấn "Tạo bài tập" để thêm bài tập mới</p>}
      </div>
    );
  }

  return (
    <section className="py-4">
      <div className="px-5 flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight text-[#111318]">
          Danh sách bài tập ({assignments.length})
        </h2>
      </div>

      {/* Assignment Cards List */}
      <div className="px-5 space-y-4">
        {assignments.map((assignment) => {
          const isCurrentAssignment = assignment.assignmentCode === activeAssignmentCode;
          
          return (
            <div
              key={assignment.assignmentId}
              className={`group relative border rounded-xl p-4 transition-all cursor-pointer ${
                isCurrentAssignment
                  ? 'border-[#135bec] bg-[#135bec]/5'
                  : 'border-[#dbdfe6] hover:border-[#135bec]'
              }`}
              onClick={() => {
                if (isTeacher) {
                  // Teacher: Navigate to detail view
                  setSelectedAssignment(assignment);
                } else if (assignment.joined) {
                  // Student: Navigate to detail view if joined
                  setSelectedAssignment(assignment);
                } else {
                  // Student: Join assignment if not joined
                  handleJoinAssignment(assignment);
                }
              }}
            >
              {/* Delete Button */}
              {isTeacher && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAssignment(assignment);
                  }}
                  className="absolute top-4 right-4 text-[#dbdfe6] hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              <div className="flex flex-col gap-2">
                {/* Title only */}
                <div className="pr-6">
                  <h3 className="text-lg font-bold leading-tight text-[#111318] group-hover:underline mb-1">
                    {assignment.title}
                  </h3>
                </div>

                {/* Description */}
                {assignment.description && (
                  <p className="text-[#616f89] text-sm leading-relaxed">
                    {assignment.description}
                  </p>
                )}

                {/* Info Section */}
                <div className="flex flex-col gap-1.5 mt-2">
                  {/* Deadline */}
                  <div className="flex items-center gap-1.5 text-[#616f89]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs font-medium">
                      Deadline: {formatDeadline(assignment.deadline)}
                    </p>
                  </div>

                  {/* Student Info */}
                  {!isTeacher && assignment.joined && (
                    <>
                      <div className="flex items-center gap-1.5 text-[#616f89]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-xs font-medium">
                          Số lần nộp: {assignment.commitCount || 0}
                        </p>
                      </div>
                      {assignment.lastCommitAt && (
                        <div className="flex items-center gap-1.5 text-[#616f89]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs font-medium">
                            Lần nộp gần nhất: {formatLastCommit(assignment.lastCommitAt)}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Teacher Workspace Controls */}
                  {isTeacher && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-[#dbdfe6]">
                      <button
                        onClick={(e) => handleSyncWorkspace(assignment, e)}
                        disabled={!!(activeAssignmentCode && activeAssignmentCode !== assignment.assignmentCode)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity ${
                          activeAssignmentCode && activeAssignmentCode !== assignment.assignmentCode
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-[#135bec] text-white hover:opacity-90'
                        }`}
                        title={
                          activeAssignmentCode && activeAssignmentCode !== assignment.assignmentCode
                            ? 'Chỉ sync được bài tập đang mở'
                            : 'Đồng bộ code mới nhất từ tất cả sinh viên'
                        }
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync Code
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AssignmentList;
