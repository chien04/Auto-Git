import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageType, getWebSocketService } from '../services/websocketService';
import { ImagePlus, Paperclip, Send, ThumbsUp, File } from 'lucide-react';

type AttachmentPayload = {
  kind: 'image' | 'file';
  name: string;
  mimeType: string;
  dataUrl: string;
};

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
  fullScreen?: boolean;
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
  onClose,
  fullScreen = false
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsService = getWebSocketService();
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  const ATTACHMENT_PREFIX = '__ATTACHMENT__:';

  const encodeAttachment = (payload: AttachmentPayload): string => {
    return `${ATTACHMENT_PREFIX}${JSON.stringify(payload)}`;
  };

  const decodeAttachment = (content: string): AttachmentPayload | null => {
    if (!content.startsWith(ATTACHMENT_PREFIX)) {
      return null;
    }
    try {
      return JSON.parse(content.slice(ATTACHMENT_PREFIX.length)) as AttachmentPayload;
    } catch {
      return null;
    }
  };

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

            // Replace optimistic self message with server echo to avoid duplicates
            if (isToOther) {
              const optimisticIndex = prev.findIndex(m =>
                m.senderId === currentUserId &&
                m.receiverId === otherUserId &&
                m.content === message.content &&
                m.id > Date.now() - 5000
              );

              if (optimisticIndex !== -1) {
                const updated = [...prev];
                updated[optimisticIndex] = message;
                console.log('[ChatWindow] Replaced optimistic private message', message.id);
                return updated;
              }
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

  // Ensure class-topic subscription exists while a class chat is open
  useEffect(() => {
    if (chatType !== MessageType.CLASS_GROUP || !classroomId || !wsService.isConnected()) {
      return;
    }

    const unsubscribe = wsService.subscribeToClassMessages(classroomId, () => {
      // Message processing is centralized via global listener in this component.
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [chatType, classroomId, isConnected]);

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
    const hasText = newMessage.trim().length > 0;
    const payloadContent = pendingAttachment ? encodeAttachment(pendingAttachment) : (hasText ? newMessage.trim() : '👍');

    if (!payloadContent) {
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
        content: payloadContent,
        messageType: chatType,
        sentAt: new Date().toISOString(),
        isRead: false
      };

      // Add message to UI immediately
      setMessages((prev) => [...prev, optimisticMessage]);
      
      // Send via WebSocket
      if (chatType === MessageType.PRIVATE && otherUserId) {
        wsService.sendPrivateMessage(otherUserId, payloadContent);
      } else if (chatType === MessageType.CLASS_GROUP && classroomId) {
        wsService.sendClassMessage(classroomId, payloadContent);
      }
      
      setNewMessage('');
      setPendingAttachment(null);
      
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
    if (pendingAttachment) {
      setPendingAttachment(null);
    }
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

  const handleFilePicked = (file: File | null, kind: 'image' | 'file') => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) {
        return;
      }
      setPendingAttachment({
        kind,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl
      });
      setNewMessage('');
    };
    reader.readAsDataURL(file);
  };

  const renderMessageContent = (message: ChatMessage) => {
    const attachment = decodeAttachment(message.content);
    if (!attachment) {
      return (
        <div style={styles.messageContent}>
          {message.content}
          {message.senderId === currentUserId && (
            <span style={styles.readStatus}>{message.isRead ? ' ✓✓' : ' ✓'}</span>
          )}
        </div>
      );
    }

    if (attachment.kind === 'image') {
      return (
        <div style={styles.attachmentWrapper}>
          <img src={attachment.dataUrl} alt={attachment.name} style={styles.attachmentImage} />
          <div style={styles.attachmentName}>{attachment.name}</div>
        </div>
      );
    }

    return (
      <div style={styles.attachmentWrapper}>
        <a href={attachment.dataUrl} download={attachment.name} style={styles.fileLink}>
          <span style={styles.fileLinkInner}>
            <File size={14} strokeWidth={2.2} />
            {attachment.name}
          </span>
        </a>
      </div>
    );
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
    <div
      style={{
        ...styles.container,
        ...(fullScreen ? styles.containerFullScreen : {})
      }}
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          {fullScreen ? (
            <button onClick={onClose} style={styles.backButton} title="Quay lại">
              ←
            </button>
          ) : (
            <div style={styles.avatar}>
              {chatType === MessageType.PRIVATE
                ? (otherUserName ? otherUserName.charAt(0).toUpperCase() : 'U')
                : '👥'}
            </div>
          )}
          <div style={styles.headerText}>
            <div style={styles.headerTitle}>
              {chatType === MessageType.PRIVATE ? otherUserName : classroomName}
            </div>
            <div style={styles.headerSubtitle}>
              {chatType === MessageType.PRIVATE ? 'Direct Message' : 'Class Group'}
            </div>
          </div>
        </div>
        {fullScreen ? (
          <button style={styles.moreButton} title="Tùy chọn">⋮</button>
        ) : (
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        )}
      </div>

      {/* Messages Area */}
      <div
        style={{
          ...styles.messagesContainer,
          ...(fullScreen ? styles.messagesContainerFullScreen : {})
        }}
      >
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
                          {renderMessageContent(message)}
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
      <div
        style={{
          ...styles.inputContainer,
          ...(fullScreen ? styles.inputContainerFullScreen : {})
        }}
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFilePicked(e.target.files?.[0] || null, 'image')}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleFilePicked(e.target.files?.[0] || null, 'file')}
        />
        <button
          style={styles.attachButton}
          onClick={() => imageInputRef.current?.click()}
          title="Gửi ảnh"
          disabled={!isConnected}
        >
          <ImagePlus size={16} strokeWidth={2.2} />
        </button>
        <button
          style={styles.attachButton}
          onClick={() => fileInputRef.current?.click()}
          title="Gửi file"
          disabled={!isConnected}
        >
          <Paperclip size={16} strokeWidth={2.2} />
        </button>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          style={styles.input}
          disabled={!isConnected}
          placeholder={pendingAttachment ? `Sẵn sàng gửi: ${pendingAttachment.name}` : 'Nhập tin nhắn...'}
        />
        <button
          onClick={handleSendMessage}
          disabled={!isConnected}
          style={{
            ...styles.sendButton,
            ...(!isConnected ? styles.sendButtonDisabled : {})
          }}
          title={(newMessage.trim() || pendingAttachment) ? 'Gửi' : 'Thả tim'}
        >
          {(newMessage.trim() || pendingAttachment) ? (
            <Send size={18} strokeWidth={2.5} />
          ) : (
            <ThumbsUp size={17} strokeWidth={2.5} />
          )}
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
  containerFullScreen: {
    width: '100%',
    maxWidth: '420px',
    minHeight: '100vh',
    height: '100vh',
    borderRadius: 0,
    boxShadow: 'none',
    margin: '0 auto',
    backgroundColor: '#ffffff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#ffffff',
    color: '#111318',
    borderBottom: '1px solid #e5e7eb'
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
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  headerSubtitle: {
    fontSize: '10px',
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    color: '#111318',
    fontSize: '22px',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    lineHeight: '1'
  },
  moreButton: {
    background: 'transparent',
    border: 'none',
    color: '#111318',
    fontSize: '20px',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    lineHeight: '1'
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
    backgroundColor: '#fafafa'
  },
  messagesContainerFullScreen: {
    paddingBottom: '88px'
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
  attachmentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  attachmentImage: {
    maxWidth: '220px',
    maxHeight: '220px',
    borderRadius: '10px',
    objectFit: 'cover'
  },
  attachmentName: {
    fontSize: '11px',
    opacity: 0.8
  },
  fileLink: {
    color: 'inherit',
    textDecoration: 'underline',
    fontWeight: 600,
    fontSize: '13px'
  },
  fileLinkInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
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
    backgroundColor: '#ffffff'
  },
  inputContainerFullScreen: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '420px',
    zIndex: 30,
    backgroundColor: '#ffffff'
  },
  input: {
    flex: 1,
    padding: '7px 12px',
    border: '1px solid #e4e6eb',
    borderRadius: '20px',
    fontSize: '15px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#111318',
    backgroundColor: '#ffffff',
    caretColor: '#111318',
    opacity: 1,
    resize: 'none',
    outline: 'none',
    height: '32px',
    minHeight: '32px',
    maxHeight: '100px',
    lineHeight: '18px',
    overflowY: 'hidden'
  },
  attachButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#f3f4f6',
    color: '#111318',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
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
