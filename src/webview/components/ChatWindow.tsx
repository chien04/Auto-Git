import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageType, getWebSocketService } from '../services/websocketService';

interface ChatWindowProps {
  vscode: any;
  currentUserId: number;
  currentUserName: string;
  otherUserId?: number;
  otherUserName?: string;
  classroomId?: number;
  classroomName?: string;
  chatType: MessageType;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  vscode,
  currentUserId,
  currentUserName,
  otherUserId,
  otherUserName,
  classroomId,
  classroomName,
  chatType,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsService = getWebSocketService();
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Check WebSocket connection status
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };
    
    // Check immediately
    checkConnection();
    
    // Check every second
    connectionCheckInterval.current = setInterval(checkConnection, 1000);
    
    return () => {
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
      }
    };
  }, []);

  // Load message history
  useEffect(() => {
    // Set up listener for message history responses
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg && msg.type === 'privateMessagesLoaded' && msg.otherUserId === otherUserId) {
        const data: ChatMessage[] = msg.messages || [];
        setMessages(data);
        setLoading(false);
        // Mark unread messages as read
        const unread = data.filter((m: any) => m.senderId === otherUserId && !m.isRead);
        for (const m of unread) { markAsRead(m.id); }
        if (unread.length > 0) { window.parent.postMessage({ type: 'newMessage' }, '*'); }
      } else if (msg && msg.type === 'classMessagesLoaded' && msg.classroomId === classroomId) {
        setMessages(msg.messages || []);
        setLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    loadMessageHistory();
    return () => { window.removeEventListener('message', handleMessage); };
  }, [otherUserId, classroomId]);

  // Subscribe to WebSocket messages via GLOBAL LISTENER (no direct subscription)
  useEffect(() => {
    if (!wsService.isConnected()) {
      console.log('[ChatWindow] WebSocket not connected yet, waiting...');
      return;
    }

    console.log('[ChatWindow] 🔥 Adding global message listener for chat with:', otherUserId || classroomId);

    // Add global listener instead of direct subscription
    const removeListener = wsService.addGlobalMessageListener((message: ChatMessage) => {
      console.log('[ChatWindow] 🔥 REALTIME WS MESSAGE (via global listener):', message);
      console.log('[ChatWindow] Message from:', message.senderId, 'to:', message.receiverId);
      console.log('[ChatWindow] Current chat with:', otherUserId, 'type:', chatType);
      
      // Filter messages based on chat type
      if (chatType === MessageType.PRIVATE && otherUserId) {
        // Only add messages from/to this chat partner
        const isFromOther = message.senderId === otherUserId;
        const isToOther = message.receiverId === otherUserId && message.senderId === currentUserId;
        
        console.log('[ChatWindow] isFromOther:', isFromOther, 'isToOther:', isToOther);
        
        if (isFromOther || isToOther) {
          console.log('[ChatWindow] ✅ Message matches current chat, adding to UI');
          setMessages((prev) => {
            // Check if message already exists
            const existingIndex = prev.findIndex(m => m.id === message.id);
            if (existingIndex !== -1) {
              // Update existing message (for read status updates)
              const updated = [...prev];
              updated[existingIndex] = message;
              console.log('[ChatWindow] Updated existing message', message.id);
              return updated;
            }
            console.log('[ChatWindow] Adding new message', message.id);
            return [...prev, message];
          });
          
          // Always scroll and mark as read immediately when receiving
          setTimeout(() => scrollToBottom(), 50);
          
          // Mark as read if it's from the other user (immediate)
          if (isFromOther && !message.isRead) {
            console.log('[ChatWindow] Marking message as read:', message.id);
            setTimeout(() => markAsRead(message.id), 100);
          }
        } else {
          console.log('[ChatWindow] ❌ Message does not match current chat, ignoring');
        }
      } else if (chatType === MessageType.CLASS_GROUP && classroomId) {
        console.log('[ChatWindow] Checking CLASS message for classroom:', classroomId);
        
        if (message.classroomId === classroomId) {
          console.log('[ChatWindow] ✅ Class message matches current classroom, adding to UI');
          setMessages((prev) => {
            // Check if message already exists by ID
            const exists = prev.some(m => m.id === message.id);
            if (exists) {
              console.log('[ChatWindow] Message already exists, skipping');
              return prev;
            }
            
            // If this is our own message (coming back from broadcast),
            // replace the optimistic message instead of adding a duplicate
            if (message.senderId === currentUserId) {
              // Find and replace optimistic message (with temporary Date.now() id)
              const optimisticIndex = prev.findIndex(m => 
                m.senderId === currentUserId && 
                m.content === message.content &&
                m.id > Date.now() - 5000 // Within last 5 seconds
              );
              
              if (optimisticIndex !== -1) {
                // Replace optimistic with real message
                console.log('[ChatWindow] Replacing optimistic message with real one');
                const newMessages = [...prev];
                newMessages[optimisticIndex] = message;
                return newMessages;
              }
            }
            
            // Add new message from others
            console.log('[ChatWindow] Adding new class message');
            return [...prev, message];
          });
          
          setTimeout(() => scrollToBottom(), 50);
        } else {
          console.log('[ChatWindow] ❌ Class message does not match current classroom, ignoring');
        }
      }
    });

    return () => {
      console.log('[ChatWindow] Cleaning up global message listener');
      removeListener();
    };
  }, [currentUserId, otherUserId, classroomId, chatType, isConnected]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessageHistory = () => {
    setLoading(true);
    if (chatType === MessageType.PRIVATE && otherUserId) {
      vscode.postMessage({ type: 'getPrivateMessages', otherUserId });
    } else if (chatType === MessageType.CLASS_GROUP && classroomId) {
      vscode.postMessage({ type: 'getClassMessages', classroomId });
    } else {
      setLoading(false);
    }
  };

  const markAsRead = (messageId: number) => {
    vscode.postMessage({ type: 'markMessageAsRead', messageId });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) {
      return;
    }

    if (!isConnected) {
      alert('WebSocket chưa kết nối. Vui lòng đợi kết nối được thiết lập.');
      return;
    }

    try {
      // Create optimistic message for immediate display
      const optimisticMessage: ChatMessage = {
        id: Date.now(), // Temporary ID
        senderId: currentUserId,
        senderName: currentUserName,
        receiverId: otherUserId,
        classroomId: classroomId,
        content: newMessage.trim(),
        messageType: chatType,
        sentAt: new Date().toISOString(),
        isRead: false
      };

      // Add message to UI immediately
      setMessages((prev) => [...prev, optimisticMessage]);
      
      // Send via WebSocket
      if (chatType === MessageType.PRIVATE && otherUserId) {
        wsService.sendPrivateMessage(otherUserId, newMessage);
      } else if (chatType === MessageType.CLASS_GROUP && classroomId) {
        wsService.sendClassMessage(classroomId, newMessage);
      }
      
      setNewMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '32px';
      }
      
      // Notify parent to refresh chat list
      setTimeout(() => {
        window.parent.postMessage({ type: 'newMessage' }, '*');
      }, 500);
      
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Auto-resize textarea like Messenger
    if (textareaRef.current) {
      textareaRef.current.style.height = '32px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 100) + 'px';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  // Group messages by date
  const groupedMessages: { [key: string]: ChatMessage[] } = {};
  messages.forEach((msg) => {
    const dateKey = formatDate(msg.createdAt || msg.sentAt || new Date().toISOString());
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(msg);
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <div style={styles.avatar}>
            {chatType === MessageType.PRIVATE 
              ? (otherUserName ? otherUserName.charAt(0).toUpperCase() : 'U')
              : '👥'}
          </div>
          <div style={styles.headerText}>
            <div style={styles.headerTitle}>
              {chatType === MessageType.PRIVATE ? otherUserName : classroomName}
            </div>
            <div style={styles.headerSubtitle}>
              {isConnected ? (
                <span style={{color: '#4ade80'}}>● Đã kết nối</span>
              ) : (
                <span style={{color: '#f87171'}}>● Đang kết nối...</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={styles.closeButton}>✕</button>
      </div>

      {/* Messages Area */}
      <div style={styles.messagesContainer}>
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.loading}>Đang tải tin nhắn...</div>
          </div>
        ) : (
          <>
            {Object.keys(groupedMessages).length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>💬</div>
                <div style={styles.emptyText}>Chưa có tin nhắn nào</div>
                <div style={styles.emptySubtext}>Hãy gửi tin nhắn đầu tiên!</div>
              </div>
            ) : (
              Object.keys(groupedMessages).map((dateKey) => (
                <div key={dateKey}>
                  <div style={styles.dateDivider}>{dateKey}</div>
                  {groupedMessages[dateKey].map((message) => {
                    const isOwnMessage = message.senderId === currentUserId;
                    return (
                      <div
                        key={message.id}
                        style={{
                          ...styles.messageWrapper,
                          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            ...styles.messageBubble,
                            ...(isOwnMessage ? styles.ownMessage : styles.otherMessage),
                            position: 'relative'
                          }}
                          title={formatTime(message.createdAt || message.sentAt || new Date().toISOString())}
                        >
                          {!isOwnMessage && chatType === MessageType.CLASS_GROUP && (
                            <div style={styles.senderName}>{message.senderName}</div>
                          )}
                          <div style={styles.messageContent}>
                            {message.content}
                            {isOwnMessage && (
                              <span style={styles.readStatus}>
                                {message.isRead ? ' ✓✓' : ' ✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div style={styles.inputContainer}>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          style={styles.input}
          disabled={!isConnected}
          placeholder="Nhập tin nhắn..."
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || !isConnected}
          style={{
            ...styles.sendButton,
            ...(!newMessage.trim() || !isConnected ? styles.sendButtonDisabled : {})
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '500px',
    width: '360px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#0084ff',
    color: '#ffffff',
    borderBottom: 'none'
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    color: '#007acc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column'
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '600'
  },
  headerSubtitle: {
    fontSize: '12px',
    opacity: 0.9
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: '1'
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  loading: {
    color: '#666666',
    fontSize: '14px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999999'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px'
  },
  emptySubtext: {
    fontSize: '14px'
  },
  dateDivider: {
    textAlign: 'center',
    color: '#999999',
    fontSize: '12px',
    margin: '16px 0',
    position: 'relative'
  },
  messageWrapper: {
    display: 'flex',
    marginBottom: '12px'
  },
  messageBubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    borderRadius: '12px',
    wordWrap: 'break-word'
  },
  ownMessage: {
    backgroundColor: '#007acc',
    color: '#ffffff',
    borderBottomRightRadius: '4px'
  },
  otherMessage: {
    backgroundColor: '#ffffff',
    color: '#333333',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  senderName: {
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#007acc'
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap'
  },
  readStatus: {
    fontSize: '11px',
    marginLeft: '4px',
    opacity: 0.6
  },
  inputContainer: {
    display: 'flex',
    padding: '8px 12px',
    gap: '6px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #dbdbdb'
  },
  input: {
    flex: 1,
    padding: '7px 12px',
    border: '1px solid #e4e6eb',
    borderRadius: '20px',
    fontSize: '15px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    resize: 'none',
    outline: 'none',
    height: '32px',
    minHeight: '32px',
    maxHeight: '100px',
    lineHeight: '18px',
    overflowY: 'hidden'
  },
  sendButton: {
    padding: '0',
    width: '32px',
    height: '32px',
    backgroundColor: '#0084ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50%',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed'
  }
};

export default ChatWindow;
