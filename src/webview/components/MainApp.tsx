import React, { useState, useEffect, useRef } from 'react';
import LoginPage from './LoginPage';
import RoleSelection from './RoleSelection';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import UserHeader from './UserHeader';
import { ApiService } from '../../services/apiService';

interface MainAppProps {
  vscode: any;
}

const MainApp: React.FC<MainAppProps> = ({ vscode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'TEACHER' | 'STUDENT' | null>(null);
  const hasCheckedLogin = useRef(false);
  const apiService = useRef(new ApiService()).current;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('WebView received message:', message.type, message);
      
      switch (message.type) {
        case 'loginSuccess':
          setUser(message.user);
          setLoading(false);
          setSelectedRole(null);
          // Set token for apiService
          if (message.token) {
            apiService.setToken(message.token);
          }
          break;
        case 'logout':
          setUser(null);
          setSelectedRole(null);
          setLoading(false);
          apiService.setToken(null);
          break;
        case 'restoreState':
          // Nhận state từ extension
          if (message.user) {
            setUser(message.user);
          }
          // Set token for apiService if available
          if (message.token) {
            apiService.setToken(message.token);
          }
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Chỉ gọi checkLoginStatus 1 lần duy nhất khi component mount
    if (!hasCheckedLogin.current) {
      hasCheckedLogin.current = true;
      console.log('Requesting login status...');
      vscode.postMessage({ type: 'checkLoginStatus' });
    }
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogout = () => {
    vscode.postMessage({ type: 'logout' });
    setUser(null);
    setSelectedRole(null);
    hasCheckedLogin.current = false;
  };

  const handleSelectRole = (role: 'TEACHER' | 'STUDENT') => {
    setSelectedRole(role);
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    if (!selectedRole) {
      return <RoleSelection onSelectRole={handleSelectRole} />;
    }
    return (
      <LoginPage 
        vscode={vscode} 
        role={selectedRole}
        onBack={handleBackToRoleSelection}
      />
    );
  }

  return (
    <div style={styles.container}>
      <UserHeader user={user} onLogout={handleLogout} />
      {user.role === 'TEACHER' ? (
        <TeacherDashboard vscode={vscode} user={user} apiService={apiService} />
      ) : (
        <StudentDashboard vscode={vscode} user={user} apiService={apiService} />
      )}
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#fafafa',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e5e5',
    borderTop: '3px solid #000',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#8e8e8e',
    fontWeight: '500',
  },
};

export default MainApp;
