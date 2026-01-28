import React from 'react';

interface UserHeaderProps {
  user: any;
  onLogout: () => void;
  onOpenChat?: () => void;
  onOpenDashboard?: () => void;
  currentView?: string | null;
}

const UserHeader: React.FC<UserHeaderProps> = ({ 
  user, 
  onLogout, 
  onOpenChat, 
  onOpenDashboard,
  currentView 
}) => {
  return (
    <div style={styles.header}>
      <div style={styles.userInfo}>
        <div style={styles.avatar}>
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <div style={styles.name}>{user?.name || user?.email}</div>
          <div style={styles.role}>
            {user?.role === 'TEACHER' ? 'Giáo viên' : 'Sinh viên'}
          </div>
        </div>
      </div>
      
      <div style={styles.actions}>
        {/* Navigation buttons */}
        <div style={styles.navButtons}>
          <button 
            onClick={onOpenDashboard}
            style={{
              ...styles.navButton,
              ...(currentView !== 'CHAT' ? styles.navButtonActive : {})
            }}
          >
            🏠 Dashboard
          </button>
          <button 
            onClick={onOpenChat}
            style={{
              ...styles.navButton,
              ...(currentView === 'CHAT' ? styles.navButtonActive : {})
            }}
          >
            💬 Chat
          </button>
        </div>
        
        <button onClick={onLogout} style={styles.logoutButton}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #dbdbdb',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#000',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '16px',
    letterSpacing: '0.5px',
  },
  name: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#262626',
    marginBottom: '2px',
  },
  role: {
    fontSize: '12px',
    color: '#8e8e8e',
    fontWeight: '400',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  navButtons: {
    display: 'flex',
    gap: '8px',
  },
  navButton: {
    padding: '8px 16px',
    backgroundColor: '#ffffff',
    color: '#8e8e8e',
    border: '1px solid #dbdbdb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  } as React.CSSProperties,
  navButtonActive: {
    backgroundColor: '#0095f6',
    color: '#ffffff',
    borderColor: '#0095f6',
  },
  logoutButton: {
    padding: '8px 20px',
    backgroundColor: '#ffffff',
    color: '#262626',
    border: '1px solid #dbdbdb',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
};

export default UserHeader;
