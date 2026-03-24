import React, { useState, useEffect, useRef } from 'react';
import LoginPage from './LoginPage';
import WelcomeScreen from './WelcomeScreen';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import ChatView from './ChatView';
import ChatWindow from './ChatWindow';
import { ApiService } from '../../services/apiService';
import { getWebSocketService, MessageType } from '../services/websocketService';

interface MainAppProps {
  vscode: any;
}

const MainApp: React.FC<MainAppProps> = ({ vscode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'CHAT'>('DASHBOARD');
  const [selectedRole, setSelectedRole] = useState<'TEACHER' | 'STUDENT' | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConfig, setChatConfig] = useState<{
    otherUserId?: number;
    otherUserName?: string;
    classroomId?: number;
    classroomName?: string;
    chatType: MessageType;
  } | null>(null);
  const [shouldRefreshChat, setShouldRefreshChat] = useState(false);
  const hasCheckedLogin = useRef(false);
  const apiService = useRef(new ApiService()).current;
  const wsService = useRef(getWebSocketService()).current;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'loginSuccess':
          setUser(message.user);
          setLoading(false);
          setSelectedRole(null);
          // Set token for apiService
          if (message.token) {
            apiService.setToken(message.token);
            // Connect WebSocket
            if (message.user && message.user.userId) {
              connectWebSocket(parseInt(message.user.userId), message.token);
            }
          }
          break;
        case 'logout':
          setUser(null);
          setSelectedRole(null);
          setLoading(false);
          apiService.setToken(null);
          // Disconnect WebSocket
          wsService.disconnect();
          break;
        case 'restoreState':
          // Nhận state từ extension
          if (message.user) {
            setUser(message.user);
          }
          // Set token for apiService if available
          if (message.token) {
            apiService.setToken(message.token);
            // Connect WebSocket if user is logged in
            if (message.user && message.user.userId) {
              connectWebSocket(parseInt(message.user.userId), message.token);
            }
          }
          setLoading(false);
          break;
        case 'openChat':
          // Open chat window from dashboard
          if (message.config) {
            setChatConfig(message.config);
            setChatOpen(true);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Chỉ gọi checkLoginStatus 1 lần duy nhất khi component mount
    if (!hasCheckedLogin.current) {
      hasCheckedLogin.current = true;
      vscode.postMessage({ type: 'checkLoginStatus' });
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
      // Don't disconnect WebSocket here - it's a singleton service
      // that should persist across component re-renders.
      // WebSocket will only disconnect on explicit logout.
    };
  }, []);

  const connectWebSocket = async (userId: number, token: string) => {
    try {
      // Connect WebSocket if not connected
      if (!wsService.isConnected()) {
        await wsService.connect(userId, token, () => {
        });
      }
      
      // ALWAYS set up global subscription (whether newly connected or already connected)
      const unsubscribe = wsService.subscribeToPrivateMessages(userId, (message) => {
        
        // Always trigger refresh to update chat list
        setShouldRefreshChat(prev => !prev);
        
        // Broadcast message to all components via window.postMessage
        window.postMessage({ type: 'websocketMessage', message }, '*');
        
        // Notify extension about new message
        vscode.postMessage({ type: 'newMessage', message });
      });
    } catch (error) {
    }
  };

  const handleLogout = () => {
    vscode.postMessage({ type: 'logout' });
    setUser(null);
    setSelectedRole(null);
    setActiveView('DASHBOARD');
    hasCheckedLogin.current = false;
    wsService.disconnect();
  };

  const handleSelectRole = (role: 'TEACHER' | 'STUDENT') => {
    setSelectedRole(role);
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
  };

  const handleViewChange = (view: 'DASHBOARD' | 'CHAT') => {
    setActiveView(view);
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

  const handleCloseChat = () => {
    setChatOpen(false);
    setChatConfig(null);
    // Don't auto-refresh to avoid flickering
    // User can manually refresh if needed, or it will auto-update on next message
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
      return <WelcomeScreen onSelectRole={(role) => handleSelectRole(role.toUpperCase() as 'TEACHER' | 'STUDENT')} />;
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
      {/* Main Content */}
      <div style={styles.mainContentFull}>
        {activeView === 'CHAT' ? (
          <ChatView
            vscode={vscode}
            currentUser={user}
            onOpenChat={handleOpenChat}
            onChatClosed={handleCloseChat}
            key={shouldRefreshChat ? 'refresh' : 'normal'}
          />
        ) : user.role === 'TEACHER' ? (
          <TeacherDashboard vscode={vscode} user={user} apiService={apiService} />
        ) : (
          <StudentDashboard vscode={vscode} user={user} apiService={apiService} />
        )}
      </div>
      
      {/* Chat Window Overlay */}
      {chatOpen && chatConfig && user && (
        <div style={styles.chatOverlay}>
          <ChatWindow
            vscode={vscode}
            currentUserId={parseInt(user.userId)}
            currentUserName={user.name}
            otherUserId={chatConfig.otherUserId}
            otherUserName={chatConfig.otherUserName}
            classroomId={chatConfig.classroomId}
            classroomName={chatConfig.classroomName}
            chatType={chatConfig.chatType}
            onClose={handleCloseChat}
          />
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    position: 'relative' as const,
  },
  mainContentFull: {
    flex: 1,
    minHeight: '100vh',
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
  chatOverlay: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    borderRadius: '8px',
  },
};

export default MainApp;
