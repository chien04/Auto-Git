import React, { useState, useEffect } from 'react';
import StudentList from './StudentList';
import { TeacherStatsCard } from './TeacherStatsCard';
import { ClassDetailStats } from './ClassDetailStats';
import TeacherForm from './TeacherForm';
import CreateAssignmentForm from './CreateAssignmentForm';
import AssignmentList from './AssignmentList';
import BottomNavigation from './BottomNavigation';
import ChatView from './ChatView';
import NotificationView from './NotificationView';
import ChatWindow from './ChatWindow';
import { MessageType } from '../services/websocketService';

interface TeacherDashboardProps {
  vscode: any;
  user: any;
  apiService: any;
}

interface ClassItem {
  classId: string;
  className: string;
  classCode: string;
  studentCount: number;
  assignmentCount?: number;
}

interface Student {
  studentId: string;
  studentName: string;
  branchName: string;
  commitCount: number;
  lastCommitAt: string | null;
  joinedAt: string;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ vscode, user, apiService }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateAssignmentForm, setShowCreateAssignmentForm] = useState(false);
  const [viewStudentList, setViewStudentList] = useState(false);
  const [classStats, setClassStats] = useState<{totalStudents: number, studentsSubmitted: number, studentsNotSubmitted: number, submittedPercentage: number, notSubmittedPercentage: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'notification' | 'settings'>('dashboard');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConfig, setChatConfig] = useState<{
    otherUserId?: number;
    otherUserName?: string;
    classroomId?: number;
    classroomName?: string;
    chatType: MessageType;
  } | null>(null);
  const [isViewingAssignmentDetail, setIsViewingAssignmentDetail] = useState(false);
  const isChatDetailOpen = activeTab === 'chat' && chatOpen && !!chatConfig;

  useEffect(() => {
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'classesLoaded':
          setClasses(message.classes);
          break;
        case 'studentsLoaded':
          setStudents(message.students);
          // Calculate stats for this class
          const total = message.students.length;
          const submitted = message.students.filter((s: Student) => (s.commitCount || 0) > 1).length;
          const notSubmitted = total - submitted;
          setClassStats({
            totalStudents: total,
            studentsSubmitted: submitted,
            studentsNotSubmitted: notSubmitted,
            submittedPercentage: total > 0 ? Math.round((submitted * 100 / total) * 10) / 10 : 0,
            notSubmittedPercentage: total > 0 ? Math.round((notSubmitted * 100 / total) * 10) / 10 : 0
          });
          break;
        case 'classCreated':
          vscode.postMessage({ type: 'loadMyClasses' });
          setShowCreateForm(false);
          break;
        case 'assignmentCreated':
          // Reload assignments for current class
          if (selectedClass) {
            setSelectedClass({...selectedClass});
          }
          setShowCreateAssignmentForm(false);
          break;
        case 'classDeleted':
          vscode.postMessage({ type: 'loadMyClasses' });
          setSelectedClass(null);
          setStudents([]);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Load classes on mount
    vscode.postMessage({ type: 'loadMyClasses' });

    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleViewStudents = (classItem: ClassItem) => {
    setSelectedClass(classItem);
    setViewStudentList(false);
    setShowCreateAssignmentForm(false);
    vscode.postMessage({ type: 'loadStudents', classCode: classItem.classCode });
  };

  const handleSyncWorkspace = (classCode: string) => {
    vscode.postMessage({ type: 'syncWorkspace', classCode });
  };

  const handleDeleteClass = (classItem: ClassItem) => {
    vscode.postMessage({ 
      type: 'deleteClass', 
      classCode: classItem.classCode,
      className: classItem.className 
    });
  };

  const handleOpenChat = (config: any) => {
    setChatConfig(config);
    setChatOpen(true);
  };

  const handleTabChange = (tab: 'dashboard' | 'chat' | 'notification' | 'settings') => {
    setActiveTab(tab);
    if (tab !== 'dashboard') {
      setSelectedClass(null);
      setViewStudentList(false);
      setShowCreateAssignmentForm(false);
    }
    if (tab === 'chat') {
      // Show chat view
      setChatOpen(false); // Reset individual chat
    } else {
      setChatOpen(false);
    }
  };

  if (showCreateForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col min-h-screen max-w-[420px] w-full bg-white">
          <TeacherForm 
            vscode={vscode}
            user={user}
            onClose={() => {
              setShowCreateForm(false);
              vscode.postMessage({ type: 'loadMyClasses' });
            }} 
          />
        </div>
      </div>
    );
  }

  if (selectedClass && viewStudentList) {
    return (
      <StudentList 
        vscode={vscode} 
        classItem={selectedClass}
        currentUser={user}
        userRole="TEACHER"
        onBack={() => {
          setViewStudentList(false);
          setSelectedClass(null);
        }}
      />
    );
  }

  if (selectedClass && showCreateAssignmentForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col min-h-screen max-w-[420px] w-full bg-white shadow-2xl">
          <CreateAssignmentForm
            vscode={vscode}
            user={user}
            classCode={selectedClass.classCode}
            onClose={() => setShowCreateAssignmentForm(false)}
          />
        </div>
      </div>
    );
  }

  if (selectedClass) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex flex-col min-h-screen max-w-[420px] w-full bg-white shadow-2xl">
        {/* Header matching main dashboard */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-[#dbdfe6]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#135bec] flex items-center justify-center rounded">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 48 48">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-[#111318]">AutoGit</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#111318]">{user?.name || 'Giáo viên'}</span>
            <div className="w-px h-4 bg-[#dbdfe6]"></div>
            <button 
              onClick={() => vscode.postMessage({ type: 'logout' })}
              className="flex items-center justify-center p-1.5 rounded-full text-[#616f89] hover:text-red-600 hover:bg-gray-100 transition-colors" 
              title="Đăng xuất"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {!isViewingAssignmentDetail && (
          <>
            {/* Back Button */}
            <div className="px-4 py-4">
              <button 
                onClick={() => setSelectedClass(null)} 
                className="flex items-center gap-2 text-[#616f89] hover:text-[#111318] transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Quay lại
              </button>
            </div>
            
            {/* Class Header */}
            <div className="px-4 py-5 border-b border-[#dbdfe6]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#111318] mb-1">{selectedClass.className}</h2>
                  <p className="text-sm text-[#616f89]">Mã lớp: <strong className="font-mono font-bold">{selectedClass.classCode}</strong></p>
                </div>
                <button 
                  onClick={() => handleDeleteClass(selectedClass)}
                  className="text-[#dbdfe6] hover:text-red-500 transition-colors p-2"
                  title="Xóa lớp"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <button 
                onClick={() => setShowCreateAssignmentForm(true)}
                className="w-full bg-[#135bec] text-white py-3 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tạo bài tập mới
              </button>
            </div>
          </>
        )}

        {/* Assignments Section */}
        <div className="flex-1 overflow-y-auto pb-24">
          <AssignmentList
            vscode={vscode}
            apiService={apiService}
            classCode={selectedClass.classCode}
            className={selectedClass.className}
            isTeacher={true}
            onViewChange={(isDetailView) => setIsViewingAssignmentDetail(isDetailView)}
          />

          {/* Student List */}
          {!isViewingAssignmentDetail && (
            <div className="px-4 py-6 border-t border-[#dbdfe6]">
              <h3 className="text-lg font-bold tracking-tight text-[#111318] mb-4">
                Danh sách sinh viên
              </h3>
              {students.length === 0 ? (
                <p className="text-sm text-[#616f89] text-center py-8">Chưa có sinh viên nào tham gia</p>
              ) : (
                <div className="space-y-3">
                  {students.map((student) => (
                    <div key={student.studentId} className="p-4 rounded-lg border border-[#dbdfe6] bg-white">
                      <div className="font-semibold text-[#111318] text-sm mb-1">{student.studentName}</div>
                      <div className="text-xs text-[#616f89]">
                        Tham gia: {new Date(student.joinedAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        {!showCreateAssignmentForm && (
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col min-h-screen max-w-[420px] w-full bg-white shadow-2xl">
      {/* Header */}
      {!isChatDetailOpen && (
      <header className="flex items-center justify-between px-4 py-4 border-b border-[#dbdfe6]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#135bec] flex items-center justify-center rounded">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 48 48">
              <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#111318]">AutoGit</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#111318]">{user?.name || 'Giáo viên'}</span>
          <div className="w-px h-4 bg-[#dbdfe6]"></div>
          <button 
            onClick={() => vscode.postMessage({ type: 'logout' })}
            className="flex items-center justify-center p-1.5 rounded-full text-[#616f89] hover:text-red-600 hover:bg-gray-100 transition-colors" 
            title="Đăng xuất"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>
      )}

      {/* Conditional Content Based on Active Tab */}
      {activeTab === 'chat' ? (
        chatOpen && chatConfig ? (
          <ChatWindow
            vscode={vscode}
            currentUserId={parseInt(user.userId)}
            currentUserName={user.name}
            otherUserId={chatConfig.otherUserId}
            otherUserName={chatConfig.otherUserName}
            classroomId={chatConfig.classroomId}
            classroomName={chatConfig.classroomName}
            chatType={chatConfig.chatType}
            onClose={() => setChatOpen(false)}
            fullScreen={true}
          />
        ) : (
          <ChatView
            vscode={vscode}
            currentUser={user}
            onOpenChat={handleOpenChat}
            onChatClosed={() => setChatOpen(false)}
          />
        )
      ) : activeTab === 'notification' ? (
        <NotificationView vscode={vscode} />
      ) : activeTab === 'dashboard' ? (
        <>

      {/* Create Button */}
      <div className="px-4 pb-2 pt-10">
        <button 
          onClick={() => setShowCreateForm(true)} 
          className="w-full bg-[#135bec] text-white py-4 rounded-lg font-bold text-sm tracking-wide shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          TẠO LỚP MỚI
        </button>
      </div>

      {/* Classes Title */}
      <div className="px-4 pt-8 pb-3">
        <h2 className="text-xl font-bold tracking-tight text-[#111318]">Lớp học của tôi</h2>
      </div>

      {/* Stats Section */}
      <section className="px-4 pb-4">
        <div className="flex items-center gap-4 text-xs uppercase tracking-wider font-bold text-[#616f89]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#111318] text-sm">{classes.length}</span> CLASSES
          </div>
          <div className="w-px h-3 bg-[#dbdfe6]"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#111318] text-sm">
              {classes.reduce((sum, c) => sum + (c.assignmentCount || 0), 0)}
            </span> ASSIGNMENTS
          </div>
        </div>
      </section>

          {/* Classes List */}
          <main className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
            {classes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#616f89] mb-6 text-sm">Bạn chưa tạo lớp học nào</p>
                <button 
                  onClick={() => setShowCreateForm(true)} 
                  className="px-8 py-3.5 bg-[#135bec] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  + Tạo lớp học đầu tiên
                </button>
              </div>
            ) : (
              classes.map((classItem) => (
                <div
                  key={classItem.classId}
                  onClick={() => handleViewStudents(classItem)}
                  className="group relative p-5 rounded-lg border-2 border-[#dbdfe6] bg-white hover:border-[#135bec] transition-all cursor-pointer"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClass(classItem);
                    }}
                    className="absolute top-4 right-4 text-[#dbdfe6] hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <div className="pr-6">
                    <h3 className="text-lg font-bold leading-tight mb-1 text-[#111318]">{classItem.className}</h3>
                    <p className="text-xs font-mono font-bold text-[#616f89] mb-5">{classItem.classCode}</p>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#111318]">
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {classItem.assignmentCount || 0}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#111318]">
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {classItem.studentCount}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </main>

      {/* Footer */}
      <footer className="p-6 border-t border-[#dbdfe6] flex justify-center bg-gray-50/50">
        <span className="text-[10px] text-[#616f89] font-bold uppercase tracking-widest">
          AutoGit VS Code Extension v1.0
        </span>
      </footer>
        </>
      ) : null}

      {/* Bottom Navigation */}
      {!isChatDetailOpen && (
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#fafafa',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    color: '#000',
    letterSpacing: '-0.5px',
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  classList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  classCard: {
    backgroundColor: '#fff',
    border: '1px solid #dbdbdb',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    transition: 'all 0.15s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
    flex: 1,
    color: '#262626',
    letterSpacing: '-0.2px',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
  },
  cardBody: {
    marginTop: '12px',
  },
  cardInfo: {
    fontSize: '13px',
    margin: '8px 0',
    color: '#8e8e8e',
    fontWeight: '400',
  },
  cardInfoExpired: {
    fontSize: '13px',
    margin: '8px 0',
    color: '#dc3545',
    fontWeight: '700',
  },
  cardButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
  },
  chatGroupButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#0095f6',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  viewButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '80px 20px',
  },
  emptyText: {
    fontSize: '15px',
    color: '#8e8e8e',
    marginBottom: '24px',
    fontWeight: '400',
  },
  createButtonLarge: {
    padding: '14px 32px',
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#262626',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    cursor: 'pointer',
    marginBottom: '24px',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  classHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  className: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#000',
    letterSpacing: '-0.5px',
  },
  classCode: {
    fontSize: '14px',
    color: '#8e8e8e',
    margin: 0,
    fontWeight: '400',
  },
  deleteButton: {
    padding: '12px 24px',
    backgroundColor: '#fff',
    color: '#262626',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  classActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  workspaceButton: {
    padding: '12px 24px',
    backgroundColor: '#0066FF',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  syncButton: {
    padding: '12px 24px',
    backgroundColor: '#10B981',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    outline: 'none',
    marginLeft: '12px',
  },
  studentList: {
    marginTop: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#262626',
    letterSpacing: '-0.3px',
  },
  table: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  studentCard: {
    backgroundColor: '#fff',
    border: '1px solid #dbdbdb',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#262626',
  },
  studentDetail: {
    fontSize: '13px',
    color: '#8e8e8e',
    marginBottom: '4px',
    fontWeight: '400',
  },
};

export default TeacherDashboard;
