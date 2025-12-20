import React, { useState, useEffect } from 'react';
import StudentList from './StudentList';
import { StudentStatsCard } from './StudentStatsCard';
import { CommitHeatmap } from './CommitHeatmap';

interface StudentDashboardProps {
  vscode: any;
  user: any;
  apiService: any;
}

interface ClassItem {
  classId: string;
  className: string;
  classCode: string;
  repoUrl: string;
  branchName: string;
  deadline?: string;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ vscode, user, apiService }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  useEffect(() => {
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
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Load classes on mount
    vscode.postMessage({ type: 'loadMyClasses' });

    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleLeaveClass = (classItem: ClassItem) => {
    console.log('Leave button clicked for class:', classItem);
    console.log('Sending leaveClass message:', classItem.classCode);
    vscode.postMessage({ 
      type: 'leaveClass', 
      classCode: classItem.classCode,
      className: classItem.className,
      branchName: classItem.branchName
    });
  };

  const handleOpenRepo = (url: string) => {
    vscode.postMessage({ type: 'openUrl', url });
  };

  if (showJoinForm) {
    return (
      <div style={styles.container}>
        <button 
          onClick={() => {
            setShowJoinForm(false);
            vscode.postMessage({ type: 'loadMyClasses' });
          }} 
          style={styles.backButton}
        >
          ←
        </button>
        <StudentForm vscode={vscode} />
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
    <div style={styles.container}>
      <StudentStatsCard apiService={apiService} />
      
      <div style={styles.header}>
        <h2 style={styles.title}>Lớp học của tôi</h2>
        <button onClick={() => setShowJoinForm(true)} style={styles.joinButton}>
          + Tham gia lớp
        </button>
      </div>

      {classes.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Bạn chưa tham gia lớp học nào</p>
          <button onClick={() => setShowJoinForm(true)} style={styles.joinButtonLarge}>
            + Tham gia lớp học
          </button>
        </div>
      ) : (
        <>
          <div style={styles.classList}>
            {classes.map((classItem) => (
              <div key={classItem.classId} style={styles.classCard}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{classItem.className}</h3>
                  <button
                    onClick={() => handleLeaveClass(classItem)}
                    style={styles.leaveButton}
                    title="Rời lớp"
                  >
                    Rời lớp
                  </button>
                </div>
                <div style={styles.cardBody}>
                  {classItem.deadline && (
                    <>
                      <p style={styles.cardInfo}>
                        <strong>Deadline:</strong> {new Date(classItem.deadline).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {new Date(classItem.deadline) < new Date() && (
                        <p style={styles.cardInfoExpired}>
                          <strong>Đã hết hạn</strong>
                        </p>
                      )}
                    </>
                  )}
                  <p style={styles.cardInfo}>
                    <strong>Mã lớp:</strong> {classItem.classCode}
                  </p>
                  <p style={styles.cardInfo}>
                    <strong>Branch của bạn:</strong> {classItem.branchName}
                  </p>
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => {
                        setSelectedClass(classItem);
                        // Open folder when viewing class details
                        vscode.postMessage({ type: 'openClassFolder', classCode: classItem.classCode });
                      }}
                      style={styles.viewClassButton}
                    >
                      Xem lớp học
                    </button>
                    <button
                      onClick={() => handleOpenRepo(classItem.repoUrl)}
                      style={styles.repoButton}
                    >
                      Mở Repository
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <CommitHeatmap apiService={apiService} />
        </>
      )}
    </div>
  );
};

// Import StudentForm from existing file
import StudentForm from './StudentForm';

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
  joinButton: {
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
  leaveButton: {
    padding: '8px 16px',
    backgroundColor: '#fff',
    color: '#262626',
    border: '1px solid #dbdbdb',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.15s ease',
    outline: 'none',
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
  cardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
  },
  viewClassButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#0095f6',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  repoButton: {
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
  joinButtonLarge: {
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
};

export default StudentDashboard;
