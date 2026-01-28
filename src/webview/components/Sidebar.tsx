import React from 'react';

interface SidebarProps {
  currentUser: any;
  activeView: 'DASHBOARD' | 'CHAT';
  onViewChange: (view: 'DASHBOARD' | 'CHAT') => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, activeView, onViewChange, onLogout }) => {
  return (
    <div style={styles.sidebar}>
      {/* User Profile Section */}
      <div style={styles.userSection}>
        <div style={styles.avatar}>
          {currentUser.name?.charAt(0).toUpperCase() || 'C'}
        </div>
        <div style={styles.userName}>{currentUser.name || 'Chiến Băng'}</div>
        <div style={styles.userRole}>
          {currentUser.role === 'TEACHER' ? 'Giáo viên' : 'Sinh viên'}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav style={styles.nav}>
        <button
          style={{
            ...styles.navItem,
            ...(activeView === 'DASHBOARD' ? styles.navItemActive : {})
          }}
          onClick={() => onViewChange('DASHBOARD')}
        >
          <svg style={styles.navIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={styles.navLabel}>Dashboard</span>
        </button>
        <button
          style={{
            ...styles.navItem,
            ...(activeView === 'CHAT' ? styles.navItemActive : {})
          }}
          onClick={() => onViewChange('CHAT')}
        >
          <svg style={styles.navIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={styles.navLabel}>Chat</span>
        </button>
        <button
          style={styles.navItem}
          onClick={onLogout}
        >
          <svg style={styles.navIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={styles.navLabel}>Đăng xuất</span>
        </button>
      </nav>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  sidebar: {
    width: '70px',
    height: '100vh',
    backgroundColor: '#fff',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 100,
  },
  userSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 8px 16px 8px',
    borderBottom: '1px solid #e0e0e0',
    marginBottom: '16px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#000',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  userName: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: '2px',
    wordBreak: 'break-word',
    maxWidth: '60px',
  },
  userRole: {
    fontSize: '9px',
    color: '#666',
    textAlign: 'center',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 8px',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    outline: 'none',
  },
  navItemActive: {
    backgroundColor: '#f5f5f5',
  },
  navIcon: {
    fontSize: '24px',
    marginBottom: '4px',
    color: '#000',
  },
  navLabel: {
    fontSize: '10px',
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
  },
};

export default Sidebar;
