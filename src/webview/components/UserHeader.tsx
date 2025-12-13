import React from 'react';

interface UserHeaderProps {
  user: any;
  onLogout: () => void;
}

const UserHeader: React.FC<UserHeaderProps> = ({ user, onLogout }) => {
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
      <button onClick={onLogout} style={styles.logoutButton}>
        Đăng xuất
      </button>
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
