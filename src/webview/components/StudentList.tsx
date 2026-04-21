import React, { useState, useEffect } from 'react';

interface StudentListProps {
  vscode: any;
  classItem: any;
  currentUser: any;
  onBack: () => void;
  userRole?: 'TEACHER' | 'STUDENT';
}

interface Student {
  studentId: string;
  userId: string;
  studentName: string;
  branchName: string;
  commitCount: number;
  lastCommitAt: string | null;
  joinedAt: string;
}

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

const StudentList: React.FC<StudentListProps> = ({ vscode, classItem, currentUser, onBack, userRole = 'STUDENT' }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);

  console.log('StudentList mounted with currentUser:', currentUser);
  console.log('currentUser keys:', Object.keys(currentUser || {}));

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'studentsLoaded':
          const sortedStudents = message.students.sort((a: Student, b: Student) => 
            a.studentName.localeCompare(b.studentName, 'vi')
          );
          setStudents(sortedStudents);
          break;
        case 'commitsLoaded':
          setCommits(message.commits || []);
          break;
        case 'studentRemoved':
          // Reload students after removal
          vscode.postMessage({ type: 'loadStudents', classCode: classItem.classCode });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Load students
    vscode.postMessage({ type: 'loadStudents', classCode: classItem.classCode });

    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, classItem]);

  const handleViewCommits = (student: Student) => {
    console.log('handleViewCommits called:', {
      userRole,
      studentName: student.studentName,
      isCurrentUser: isCurrentUser(student)
    });
    
    // Nếu là sinh viên, chỉ cho phép xem commit của chính mình
    if (userRole === 'STUDENT' && !isCurrentUser(student)) {
      console.log('Blocked: Student trying to view other student commits');
      return; // Không làm gì cả
    }
    
    console.log('Loading commits for:', student.studentName);
    setSelectedStudent(student);
    vscode.postMessage({ 
      type: 'loadCommits', 
      classCode: classItem.classCode,
      branchName: student.branchName 
    });
  };

  const handleViewCode = (commitSha: string) => {
    vscode.postMessage({ 
      type: 'viewCode', 
      classCode: classItem.classCode,
      branchName: selectedStudent?.branchName,
      commitSha
    });
  };

  const isCurrentUser = (student: Student) => {
    // So sánh userId (chuyển cả 2 về string để tránh lỗi number vs string)
    const match = String(student.userId) === String(currentUser.userId);
    console.log('Checking isCurrentUser:', {
      studentUserId: student.userId,
      currentUserId: currentUser.userId,
      studentName: student.studentName,
      currentUserName: currentUser.name,
      match
    });
    return match;
  };

  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-[#fafafa] p-6">
        <button onClick={() => setSelectedStudent(null)} className="mb-4 border-none bg-transparent p-2 text-2xl text-[#262626] outline-none transition-colors">
          ←
        </button>
        
        <div className="mb-6">
          <div>
            <h2 className="mb-2 text-[28px] font-bold tracking-[-0.5px] text-black">Lịch sử commit - {selectedStudent.studentName}</h2>
            <p className="text-sm text-[#8e8e8e]">Branch: {selectedStudent.branchName}</p>
          </div>
        </div>

        {commits.length === 0 ? (
          <div className="rounded-2xl border border-[#dbdbdb] bg-white px-5 py-[60px] text-center">
            <p className="text-base text-[#8e8e8e]">Chưa có commit nào</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {commits
              .filter(commit => !commit.message.toLowerCase().includes('initial commit'))
              .map((commit) => (
              <div key={commit.sha} className="rounded-xl border border-[#dbdbdb] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <div className="mb-2 flex items-start justify-between">
                  <span>
                    {new Date(commit.date).toLocaleString('vi-VN')}
                  </span>
                  <button
                    onClick={() => handleViewCode(commit.sha)}
                    className="cursor-pointer rounded-lg border-none bg-[#0095f6] px-4 py-1.5 text-[13px] font-semibold text-white outline-none transition-all"
                  >
                    Xem code
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] p-6">
      <button onClick={onBack} className="mb-4 border-none bg-transparent p-2 text-2xl text-[#262626] outline-none transition-colors">
        ←
      </button>
      
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-2 text-[28px] font-bold tracking-[-0.5px] text-black">{classItem.className}</h2>
          <p className="text-sm text-[#8e8e8e]">Mã lớp: {classItem.classCode}</p>
        </div>
        <button
          onClick={() => {
            vscode.postMessage({
              type: 'openChat',
              config: {
                classroomId: parseInt(classItem.classId),
                classroomName: classItem.className,
                chatType: 'CLASS_GROUP'
              }
            });
          }}
          className="whitespace-nowrap rounded-xl border-none bg-[#0095f6] px-6 py-3 text-sm font-semibold text-white outline-none transition-all"
        >
          💬 Chat nhóm
        </button>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-[#dbdbdb] bg-white px-5 py-[60px] text-center">
          <p className="text-base text-[#8e8e8e]">Chưa có sinh viên nào trong lớp</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {students.map((student) => {
            const isCurrent = isCurrentUser(student);
            const isClickable = userRole === 'TEACHER' || isCurrent;
            return (
            <div 
              key={student.studentId} 
              className={`rounded-xl border-2 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all ease-in-out ${isCurrent ? 'border-[#0095f6] bg-[#f0f8ff] shadow-[0_2px_8px_rgba(0,149,246,0.15)]' : 'border-[#dbdbdb] bg-white'} ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${(userRole === 'STUDENT' && !isCurrent) ? 'opacity-60' : 'opacity-100'}`}
              onClick={() => handleViewCommits(student)}
            >
              <h3 className={`mb-2 flex flex-wrap items-center gap-1.5 text-base font-semibold ${isCurrent ? 'text-[#0095f6] font-bold' : 'text-[#262626]'}`}>
                {student.studentName}
              </h3>
              {userRole === 'TEACHER' && (
                <>
                  <div className="text-[13px]">
                    <p className="my-1.5 text-[#262626]">
                      <span className="font-medium text-[#8e8e8e]">Branch:</span> {student.branchName}
                    </p>
                    <p className="my-1.5 text-[#262626]">
                      <span className="font-medium text-[#8e8e8e]">Commits:</span> {student.commitCount}
                    </p>
                    {student.lastCommitAt && (
                      <p className="my-1.5 text-[#262626]">
                        <span className="font-medium text-[#8e8e8e]">Commit cuối:</span>{' '}
                        {new Date(student.lastCommitAt).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        vscode.postMessage({
                          type: 'openChat',
                          config: {
                            otherUserId: parseInt(student.userId),
                            otherUserName: student.studentName,
                            chatType: 'PRIVATE'
                          }
                        });
                      }}
                      className="flex-1 cursor-pointer rounded-[10px] border-none bg-[#0095f6] p-2.5 text-[13px] font-semibold text-white outline-none transition-all"
                    >
                      💬 Chat
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Send message to provider which will show VS Code confirmation dialog
                        vscode.postMessage({
                          type: 'removeStudent',
                          classCode: classItem.classCode,
                          studentId: student.studentId,
                          studentName: student.studentName
                        });
                      }}
                      className="flex-1 cursor-pointer rounded-[10px] border border-[#ed4956] bg-white p-2.5 text-[13px] font-semibold text-[#ed4956] outline-none transition-all"
                    >
                      Xóa
                    </button>
                  </div>
                </>
              )}
              {userRole === 'STUDENT' && !isCurrent && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    vscode.postMessage({
                      type: 'openChat',
                      config: {
                        otherUserId: parseInt(student.userId),
                        otherUserName: student.studentName,
                        chatType: 'PRIVATE'
                      }
                    });
                  }}
                  className="mt-3 w-full cursor-pointer rounded-[10px] border-none bg-[#0095f6] p-2.5 text-[13px] font-semibold text-white outline-none transition-all"
                >
                  💬 Chat
                </button>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentList;
