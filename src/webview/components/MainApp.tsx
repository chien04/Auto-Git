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

      wsService.subscribeToNotifications(userId, (notification) => {
        window.postMessage({ type: 'websocketNotification', notification }, '*');
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#e5e5e5] border-t-black" />
        <p className="mt-4 text-sm font-medium text-[#8e8e8e]">Đang tải...</p>
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
    <div className="relative flex min-h-screen">
      {/* Main Content */}
      <div className="min-h-screen flex-1">
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
        <div className="fixed bottom-5 right-5 z-[1000] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          <ChatWindow
            vscode={vscode}
            apiService={apiService}
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

export default MainApp;
