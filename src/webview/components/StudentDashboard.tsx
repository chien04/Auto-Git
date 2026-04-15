import React, { useState, useEffect } from 'react';
import StudentList from './StudentList';
import { StudentStatsCard } from './StudentStatsCard';
import { CommitHeatmap } from './CommitHeatmap';
import StudentForm from './StudentForm';
import AssignmentList from './AssignmentList';
import BottomNavigation from './BottomNavigation';
import NotificationView from './NotificationView';
import ChatView from './ChatView';
import ChatWindow from './ChatWindow';
import { MessageType } from '../services/websocketService';

interface StudentDashboardProps {
  vscode: any;
  user: any;
  apiService: any;
}

interface ClassItem {
  classId: string;
  className: string;
  classCode: string;
  assignmentCount?: number;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ vscode, user, apiService }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [viewAssignments, setViewAssignments] = useState(false);
  const [currentAssignmentCode, setCurrentAssignmentCode] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'notification' | 'settings'>('dashboard');
  const [isViewingAssignmentDetail, setIsViewingAssignmentDetail] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConfig, setChatConfig] = useState<{
    otherUserId?: number;
    otherUserName?: string;
    classroomId?: number;
    classroomName?: string;
    chatType: MessageType;
  } | null>(null);
  const isChatDetailOpen = activeTab === 'chat' && chatOpen && !!chatConfig;

  const handleTabChange = (tab: 'dashboard' | 'chat' | 'notification' | 'settings') => {
    setActiveTab(tab);
    if (tab !== 'dashboard') {
      setSelectedClass(null);
      setViewAssignments(false);
    }
    if (tab !== 'chat') {
      setChatOpen(false);
    }
  };

  const handleOpenChat = (config: {
    otherUserId?: number;
    otherUserName?: string;
    classroomId?: number;
    classroomName?: string;
    chatType: MessageType;
  }) => {
    setChatConfig(config);
    setChatOpen(true);
  };

  useEffect(() => {
    // Request current workspace info from extension
    vscode.postMessage({ type: 'getCurrentWorkspace' });
    
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'classesLoaded':
          setClasses(message.classes);
          break;
        case 'classJoined':
          vscode.postMessage({ type: 'loadMyClasses' });
          setShowJoinForm(false);
          break;
        case 'classLeft':
          vscode.postMessage({ type: 'loadMyClasses' });
          break;
        case 'currentWorkspaceInfo':
          if (message.assignmentCode) {
            setCurrentAssignmentCode(message.assignmentCode);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Load classes on mount
    vscode.postMessage({ type: 'loadMyClasses' });

    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleLeaveClass = (classItem: ClassItem) => {
    vscode.postMessage({ 
      type: 'leaveClass', 
      classCode: classItem.classCode,
      className: classItem.className
    });
  };

  const handleOpenRepo = (url: string) => {
    vscode.postMessage({ type: 'openUrl', url });
  };

  if (showJoinForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col min-h-screen max-w-[420px] w-full bg-white shadow-2xl">
          <StudentForm 
            vscode={vscode}
            user={user}
            onClose={() => {
              setShowJoinForm(false);
              vscode.postMessage({ type: 'loadMyClasses' });
            }}
          />
        </div>
      </div>
    );
  }

  if (selectedClass && viewAssignments) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col min-h-screen max-w-[420px] w-full bg-white shadow-2xl">
          {/* Header */}
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
              <span className="text-sm font-semibold text-[#111318]">{user?.name || 'Sinh viên'}</span>
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

          {/* Back Button and Class Info - Hidden when viewing assignment detail */}
          {!isViewingAssignmentDetail && (
            <>
              <div className="px-4 py-4">
                <button
                  onClick={() => {
                    setViewAssignments(false);
                    setSelectedClass(null);
                  }}
                  className="flex items-center gap-2 text-[#616f89] hover:text-[#111318] transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Quay lại
                </button>
              </div>

              <div className="px-4 py-5 border-b border-[#dbdfe6]">
                <h2 className="text-2xl font-bold tracking-tight text-[#111318] mb-1">{selectedClass.className}</h2>
                <p className="text-sm text-[#616f89]">Mã lớp: <strong className="font-mono font-bold">{selectedClass.classCode}</strong></p>
              </div>
            </>
          )}

          {/* Assignments */}
          <div className="flex-1 overflow-y-auto pb-24">
            <AssignmentList
              vscode={vscode}
              apiService={apiService}
              classCode={selectedClass.classCode}
              className={selectedClass.className}
              isTeacher={false}
              currentAssignmentCode={currentAssignmentCode}
              onViewChange={(isDetailView) => setIsViewingAssignmentDetail(isDetailView)}
            />
          </div>

          {/* Bottom Navigation */}
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </div>
    );
  }

  if (selectedClass) {
    return (
      <StudentList 
        vscode={vscode} 
        classItem={selectedClass}
        currentUser={user}
        userRole="STUDENT"
        onBack={() => setSelectedClass(null)}
      />
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
            <span className="text-sm font-semibold text-[#111318]">{user?.name || 'Sinh viên'}</span>
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
        ) : (
          <>
            {/* Page Heading */}
            <div className="pt-8 px-6 pb-6 border-b border-[#dbdfe6]">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black leading-tight tracking-tight text-[#111318]">Dashboard</h2>
                <p className="text-[#616f89] text-sm font-medium">Student Overview</p>
              </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col gap-8 pb-24 overflow-y-auto">
              {/* Join Class Button */}
              <section className="px-6 pt-6">
                <button
                  onClick={() => setShowJoinForm(true)}
                  className="w-full bg-[#135bec] text-white h-12 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tham gia lớp học
                </button>
              </section>

              {/* My Classes Section */}
              <section className="px-6">
                <div className="flex items-center justify-between pb-4">
                  <h3 className="text-lg font-bold leading-tight tracking-tight text-[#111318]">
                    Lớp học của tôi ({classes.length})
                  </h3>
                </div>

                {classes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#616f89] mb-6 text-sm">Bạn chưa tham gia lớp học nào</p>
                    <button
                      onClick={() => setShowJoinForm(true)}
                      className="px-8 py-3.5 bg-[#135bec] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      + Tham gia lớp học đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {classes.map((classItem) => (
                      <div
                        key={classItem.classId}
                        onClick={() => {
                          setSelectedClass(classItem);
                          setViewAssignments(true);
                        }}
                        className="group relative flex items-center justify-between p-4 bg-white border border-[#dbdfe6] rounded-xl hover:border-[#135bec] transition-colors cursor-pointer"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-[#616f89] uppercase tracking-widest">
                            {classItem.classCode}
                          </span>
                          <h4 className="font-bold text-base text-[#111318]">{classItem.className}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-[#111318]"></span>
                            <span className="text-xs text-[#616f89]">
                              {classItem.assignmentCount || 0} Bài tập
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveClass(classItem);
                          }}
                          className="p-2 text-[#dbdfe6] hover:text-red-600 transition-colors"
                          title="Rời lớp"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Activity Section */}
              {classes.length > 0 && (
                <section className="px-6">
                  <CommitHeatmap apiService={apiService} vscode={vscode} />
                </section>
              )}
            </main>

            {/* Footer */}
            <footer className="p-6 border-t border-[#dbdfe6] flex justify-center bg-gray-50/50">
              <span className="text-[10px] text-[#616f89] font-bold uppercase tracking-widest">
                AutoGit VS Code Extension v1.0
              </span>
            </footer>
          </>
        )}

        {/* Bottom Navigation */}
        {!isChatDetailOpen && (
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        )}

      </div>
    </div>
  );
};

export default StudentDashboard;
