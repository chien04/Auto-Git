import React from 'react';

interface RoleSelectionProps {
  onSelectRole: (role: 'TEACHER' | 'STUDENT') => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Auto Submit</h1>
          <p style={styles.subtitle}>Quản lý lớp học dễ dàng</p>
        </div>

        <div style={styles.roleContainer}>
          <p style={styles.question}>Bạn là?</p>
          
          <div style={styles.roleButtons}>
            <button
              onClick={() => onSelectRole('TEACHER')}
              style={styles.roleButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
            >
              <h3 style={styles.roleTitle}>Giáo viên</h3>
              <p style={styles.roleDesc}>Tạo và quản lý lớp học, theo dõi sinh viên</p>
            </button>

            <button
              onClick={() => onSelectRole('STUDENT')}
              style={styles.roleButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
            >
              <h3 style={styles.roleTitle}>Sinh viên</h3>
              <p style={styles.roleDesc}>Tham gia lớp học và nộp bài tập</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '20px',
  },
  content: {
    width: '100%',
    maxWidth: '600px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '48px',
  },
  title: {
    fontSize: '36px',
    fontWeight: '700',
    marginBottom: '12px',
    color: '#000',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#8e8e8e',
    fontWeight: '400',
  },
  roleContainer: {
    backgroundColor: '#fff',
    borderRadius: '20px',
    padding: '48px 40px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e5e5e5',
  },
  question: {
    fontSize: '20px',
    fontWeight: '600',
    textAlign: 'center' as const,
    marginBottom: '32px',
    color: '#262626',
  },
  roleButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  roleButton: {
    backgroundColor: '#fff',
    border: '2px solid #dbdbdb',
    borderRadius: '16px',
    padding: '32px 24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const,
    outline: 'none',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  roleTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#000',
  },
  roleDesc: {
    fontSize: '13px',
    color: '#8e8e8e',
    lineHeight: '1.5',
    margin: 0,
    fontWeight: '400',
  },
};

export default RoleSelection;
