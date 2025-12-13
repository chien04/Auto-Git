import React, { useState, useEffect } from 'react';

interface StudentFormProps {
  vscode: any;
}

const StudentForm: React.FC<StudentFormProps> = ({ vscode }) => {
  const [studentName, setStudentName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'joinClassSuccess') {
        setMessage('Tham gia lớp học thành công!');
        setStudentName('');
        setClassCode('');
        setLocalPath('');
        // Notify parent dashboard
        vscode.postMessage({ type: 'classJoined' });
      } else if (msg.command === 'joinClassError') {
        setMessage(`Lỗi: ${msg.error}`);
      } else if (msg.type === 'folderSelected') {
        setLocalPath(msg.path);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleSelectFolder = () => {
    vscode.postMessage({ type: 'selectFolder' });
  };

  const handleJoinClass = () => {
    if (!studentName || !classCode) {
      setMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (!localPath) {
      setMessage('Vui lòng chọn thư mục lưu repository');
      return;
    }
    vscode.postMessage({ type: 'joinClass', studentName, classCode, localPath });
    setMessage('Đang tham gia lớp học...');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Tham Gia Lớp Học</h2>
        <p style={styles.description}>
          Nhập thông tin để tham gia lớp học
        </p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Tên sinh viên</label>
          <input
            type="text"
            placeholder="Nhập tên của bạn"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Mã lớp học</label>
          <input
            type="text"
            placeholder="Nhập mã lớp học"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.toUpperCase())}
            style={styles.input}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleJoinClass();
            }}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Thư mục lưu repository</label>
          <div style={styles.folderSelector}>
            <input
              type="text"
              placeholder="Chọn thư mục..."
              value={localPath}
              readOnly
              style={styles.input}
            />
            <button onClick={handleSelectFolder} style={styles.selectButton}>
              📁 Chọn thư mục
            </button>
          </div>
        </div>

        <button onClick={handleJoinClass} style={styles.button}>
          Tham gia lớp học
        </button>

        {message && (
          <div style={styles.message}>{message}</div>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    border: '1px solid #dbdbdb',
    maxWidth: '480px',
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#000',
    letterSpacing: '-0.5px',
  },
  description: {
    fontSize: '14px',
    color: '#8e8e8e',
    marginBottom: '32px',
    fontWeight: '400',
  },
  inputGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#262626',
    letterSpacing: '0.2px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#fafafa',
    color: '#262626',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  folderSelector: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  selectButton: {
    padding: '14px 20px',
    backgroundColor: '#0066FF',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#000',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  message: {
    marginTop: '20px',
    padding: '14px 16px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '12px',
    fontSize: '13px',
    textAlign: 'center' as const,
    color: '#262626',
    fontWeight: '500',
  },
};

export default StudentForm;
