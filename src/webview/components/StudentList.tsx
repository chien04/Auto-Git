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
      <div style={styles.container}>
        <button onClick={() => setSelectedStudent(null)} style={styles.backButton}>
          ←
        </button>
        
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Lịch sử commit - {selectedStudent.studentName}</h2>
            <p style={styles.subtitle}>Branch: {selectedStudent.branchName}</p>
          </div>
        </div>

        {commits.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>Chưa có commit nào</p>
          </div>
        ) : (
          <div style={styles.commitList}>
            {commits
              .filter(commit => !commit.message.toLowerCase().includes('initial commit'))
              .map((commit) => (
              <div key={commit.sha} style={styles.commitCard}>
                <div style={styles.commitHeader}>
                  <span style={styles.commitDate}>
                    {new Date(commit.date).toLocaleString('vi-VN')}
                  </span>
                  <button
                    onClick={() => handleViewCode(commit.sha)}
                    style={styles.viewButton}
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
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>
        ←
      </button>
      
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{classItem.className}</h2>
          <p style={styles.subtitle}>Mã lớp: {classItem.classCode}</p>
        </div>
      </div>

      {students.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Chưa có sinh viên nào trong lớp</p>
        </div>
      ) : (
        <div style={styles.studentGrid}>
          {students.map((student) => {
            const isCurrent = isCurrentUser(student);
            const isClickable = userRole === 'TEACHER' || isCurrent;
            return (
            <div 
              key={student.studentId} 
              style={{
                ...styles.studentCard,
                ...(isCurrent ? styles.currentUserCard : {}),
                cursor: isClickable ? 'pointer' : 'default',
                opacity: (userRole === 'STUDENT' && !isCurrent) ? 0.6 : 1,
              }}
              onClick={() => handleViewCommits(student)}
            >
              <h3 style={{
                ...styles.studentName,
                ...(isCurrent ? styles.currentUserName : {})
              }}>
                {student.studentName}
              </h3>
              {userRole === 'TEACHER' && (
                <>
                  <div style={styles.studentInfo}>
                    <p style={styles.infoItem}>
                      <span style={styles.label}>Branch:</span> {student.branchName}
                    </p>
                    <p style={styles.infoItem}>
                      <span style={styles.label}>Commits:</span> {student.commitCount}
                    </p>
                    {student.lastCommitAt && (
                      <p style={styles.infoItem}>
                        <span style={styles.label}>Commit cuối:</span>{' '}
                        {new Date(student.lastCommitAt).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Xóa sinh viên ${student.studentName} khỏi lớp?`)) {
                        vscode.postMessage({
                          type: 'removeStudent',
                          classCode: classItem.classCode,
                          studentId: student.studentId,
                          studentName: student.studentName
                        });
                      }
                    }}
                    style={styles.removeButton}
                  >
                    Xóa
                  </button>
                </>
              )}
            </div>
          );
          })}
        </div>
      )}
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
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#262626',
    padding: '8px',
    marginBottom: '16px',
    outline: 'none',
    transition: 'color 0.2s',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    marginBottom: '8px',
    color: '#000',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8e8e8e',
    margin: 0,
  },
  empty: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: '1px solid #dbdbdb',
  },
  emptyText: {
    fontSize: '16px',
    color: '#8e8e8e',
  },
  studentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  studentCard: {
    backgroundColor: '#fff',
    border: '2px solid #dbdbdb',
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  currentUserCard: {
    backgroundColor: '#f0f8ff',
    borderColor: '#0095f6',
    boxShadow: '0 2px 8px rgba(0, 149, 246, 0.15)',
  },
  studentName: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#262626',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  currentUserName: {
    color: '#0095f6',
    fontWeight: '700',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: '#0095f6',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase' as const,
  },
  studentInfo: {
    fontSize: '13px',
  },
  infoItem: {
    margin: '6px 0',
    color: '#262626',
  },
  label: {
    color: '#8e8e8e',
    fontWeight: '500',
  },
  removeButton: {
    width: '100%',
    marginTop: '12px',
    padding: '10px',
    backgroundColor: '#fff',
    color: '#ed4956',
    border: '1px solid #ed4956',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  commitList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  commitCard: {
    backgroundColor: '#fff',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  commitHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  commitMessage: {
    fontSize: '15px',
    fontWeight: '600',
    margin: 0,
    color: '#262626',
    flex: 1,
  },
  viewButton: {
    padding: '6px 16px',
    backgroundColor: '#0095f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  commitMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#8e8e8e',
    marginBottom: '8px',
  },
  commitAuthor: {
    fontWeight: '500',
  },
  commitDate: {},
  commitSha: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#8e8e8e',
    backgroundColor: '#fafafa',
    padding: '4px 8px',
    borderRadius: '4px',
    display: 'inline-block',
  },
};

export default StudentList;
