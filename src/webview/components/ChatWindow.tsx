import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageType, getWebSocketService } from '../services/websocketService';
import { Plus, Send, ThumbsUp, File, X, ImagePlus, Paperclip, Check, CheckCheck, Copy } from 'lucide-react';
import { ApiService } from '../../services/apiService';
import { AI_ASSISTANT_ID, AI_STREAM_DONE } from '../constants/aiConstants';
import 'katex/dist/katex.min.css';

const ReactMarkdown = require('react-markdown').default;
const remarkGfm = require('remark-gfm').default;
const remarkMath = require('remark-math').default;
const rehypeKatex = require('rehype-katex').default;

type AttachmentPayload = {
  kind: 'image' | 'file';
  name: string;
  mimeType: string;
  dataUrl: string;
};

interface ChatWindowProps {
  vscode: any;
  apiService: ApiService;
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
  apiService,
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
  const [activeFilePath, setActiveFilePath] = useState('');
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsService = getWebSocketService();
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const aiStreamingMessageIdRef = useRef<number | null>(null);
  const copyCodeResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedCodeBlockId, setCopiedCodeBlockId] = useState<string | null>(null);

  const ATTACHMENT_PREFIX = '__ATTACHMENT__:';
  const isAiAssistantChat = chatType === MessageType.PRIVATE && otherUserId === AI_ASSISTANT_ID;

  const handleCopyCodeBlock = async (codeText: string, blockId: string) => {
    if (!codeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedCodeBlockId(blockId);

      if (copyCodeResetTimerRef.current) {
        clearTimeout(copyCodeResetTimerRef.current);
      }
      copyCodeResetTimerRef.current = setTimeout(() => {
        setCopiedCodeBlockId(null);
      }, 1400);
    } catch (error) {
      console.error('[ChatWindow] Failed to copy code block:', error);
    }
  };

  const aiMarkdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="mb-2 text-[16px] font-semibold leading-6">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-2 mt-2 text-[15px] font-semibold leading-6">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-1.5 mt-2 text-[15px] font-medium leading-6">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-2 whitespace-pre-wrap text-[15px] leading-relaxed">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-2 ml-5 list-disc space-y-1 text-[15px] leading-relaxed">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-2 ml-5 list-decimal space-y-1 text-[15px] leading-relaxed">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
    pre: ({ children }: { children?: React.ReactNode }) => {
      const firstChild = React.Children.toArray(children)[0];
      const childElement = React.isValidElement(firstChild)
        ? firstChild as React.ReactElement<{ className?: string; children?: React.ReactNode }>
        : null;

      const className = childElement?.props?.className || '';
      const rawCode = String(childElement?.props?.children ?? '').replace(/\n$/, '');
      const languageMatch = /language-([\w-]+)/.exec(className);
      const languageLabel = languageMatch ? languageMatch[1] : 'Plaintext';
      const codeBlockId = `${languageLabel}:${rawCode.slice(0, 64)}`;

      return (
        <div className="mb-2 overflow-hidden rounded-2xl border border-[#d8dee6] bg-[#eceff4]">
          <div className="flex items-center justify-between border-b border-[#d8dee6] px-3 py-1.5">
            <span className="text-[13px] font-medium text-[#3f4753]">{languageLabel}</span>
            <button
              type="button"
              onClick={() => handleCopyCodeBlock(rawCode, codeBlockId)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[#69717d] transition hover:bg-[#dfe4ea] hover:text-[#2f3641]"
              title={copiedCodeBlockId === codeBlockId ? 'Copied' : 'Copy code'}
              aria-label="Copy code"
            >
              {copiedCodeBlockId === codeBlockId ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={2.2} />}
            </button>
          </div>
          <pre className="overflow-x-auto px-3 py-2 text-[14px] leading-6 text-[#111827]">
            <code className={`${className} bg-transparent`}>{rawCode}</code>
          </pre>
        </div>
      );
    },
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="rounded-md bg-[#eceff4] px-1.5 py-0.5 font-mono text-[0.92em] text-[#111827]">
        {children}
      </code>
    )
  };

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

  const addContextFile = (filePath: string, pinToTop = false) => {
    if (!filePath) {
      return;
    }

    setContextFiles((prev) => {
      const normalized = filePath.trim();
      if (!normalized) {
        return prev;
      }

      const deduped = prev.filter((item) => item !== normalized);
      const merged = pinToTop ? [normalized, ...deduped] : [...deduped, normalized];
      return merged.slice(0, 8);
    });
  };

  const removeContextFile = (filePath: string) => {
    setContextFiles((prev) => prev.filter((item) => item !== filePath));
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

      if (copyCodeResetTimerRef.current) {
        clearTimeout(copyCodeResetTimerRef.current);
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
      } else if (isAiAssistantChat && msg && msg.type === 'chatActiveFile') {
        const filePath = typeof msg.filePath === 'string' ? msg.filePath : '';
        setActiveFilePath(filePath);
        if (filePath) {
          addContextFile(filePath, true);
        }
      } else if (isAiAssistantChat && msg && msg.type === 'chatWorkspaceFilePicked') {
        const filePath = typeof msg.filePath === 'string' ? msg.filePath : '';
        if (filePath) {
          addContextFile(filePath);
        }
      } else if (isAiAssistantChat && msg && msg.type === 'aiAskFailed') {
        const errorText = typeof msg.error === 'string' && msg.error.trim()
          ? msg.error
          : 'AI khong phan hoi!';
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          senderId: AI_ASSISTANT_ID,
          senderName: otherUserName || 'AI Assistant',
          receiverId: currentUserId,
          content: errorText,
          type: MessageType.PRIVATE,
          isRead: true,
          sentAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    };
    window.addEventListener('message', handleMessage);

    if (isAiAssistantChat) {
      vscode.postMessage({ type: 'requestChatActiveFile' });
    }
    loadMessageHistory();

    // Fallback: Set loading to false after 5 seconds even if response hasn't arrived
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(loadingTimeout);
    };
  }, [otherUserId, classroomId, isAiAssistantChat]);

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

  const handleSendMessage = async () => {
    const hasText = newMessage.trim().length > 0;
    const payloadContent = pendingAttachment ? encodeAttachment(pendingAttachment) : (hasText ? newMessage.trim() : '👍');

    if (!payloadContent) {
      return;
    }

    // AI chat doesn't need WebSocket connection
    if (!isAiAssistantChat && !isConnected) {
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

      // Send via REST for AI assistant, otherwise normal WebSocket chat
      if (isAiAssistantChat) {
        vscode.postMessage({
          type: 'askAiWithContext',
          message: payloadContent,
          contextFiles
        });
      } else if (chatType === MessageType.PRIVATE && otherUserId) {
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

      if (!isAiAssistantChat) {
        // Notify parent to refresh chat list
        setTimeout(() => {
          window.parent.postMessage({ type: 'newMessage' }, '*');
        }, 500);
      }

      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      if (isAiAssistantChat) {
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          senderId: AI_ASSISTANT_ID,
          senderName: otherUserName || 'AI Assistant',
          receiverId: currentUserId,
          content: 'AI khong phan hoi!',
          type: MessageType.PRIVATE,
          isRead: true,
          sentAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
      }
    }
  };

  useEffect(() => {
    if (!isAiAssistantChat || !wsService.isConnected()) {
      return;
    }

    const unsubscribe = wsService.subscribeToAiStream((chunk: string) => {
      if (!chunk) {
        return;
      }

      if (chunk === AI_STREAM_DONE) {
        aiStreamingMessageIdRef.current = null;
        return;
      }

      setMessages((prev) => {
        const streamingId = aiStreamingMessageIdRef.current;

        if (!streamingId) {
          const newId = Date.now() + 1;
          aiStreamingMessageIdRef.current = newId;
          return [
            ...prev,
            {
              id: newId,
              senderId: AI_ASSISTANT_ID,
              senderName: otherUserName || 'AI Assistant',
              receiverId: currentUserId,
              content: chunk,
              type: MessageType.PRIVATE,
              isRead: true,
              sentAt: new Date().toISOString()
            }
          ];
        }

        return prev.map((msg) => {
          if (msg.id !== streamingId) {
            return msg;
          }
          return {
            ...msg,
            content: (msg.content || '') + chunk,
            sentAt: new Date().toISOString()
          };
        });
      });

      setTimeout(() => scrollToBottom(), 0);
    });

    return () => {
      aiStreamingMessageIdRef.current = null;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isAiAssistantChat, currentUserId, otherUserName, isConnected]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handlePickWorkspaceFile = () => {
    vscode.postMessage({ type: 'pickWorkspaceFileForChat' });
  };

  const handleOpenContextFile = (filePath: string) => {
    if (!filePath) {
      return;
    }
    vscode.postMessage({ type: 'openChatContextFile', filePath });
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
      const isAiMessage = isAiAssistantChat && message.senderId === AI_ASSISTANT_ID;

      if (isAiMessage) {
        return (
          <div className="text-[15px] leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={aiMarkdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        );
      }

      return (
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {message.content}
          {message.senderId === currentUserId && (
            <span className="ml-1 inline-flex items-center text-blue-600">
              {message.isRead ? <CheckCheck size={12} strokeWidth={2.2} /> : <Check size={12} strokeWidth={2.2} />}
            </span>
          )}
        </div>
      );
    }

    if (attachment.kind === 'image') {
      return (
        <div className="flex flex-col gap-1.5">
          <img src={attachment.dataUrl} alt={attachment.name} className="max-h-[220px] max-w-[220px] rounded-sm object-cover" />
          <div className="text-[11px] text-gray-600">{attachment.name}</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <a href={attachment.dataUrl} download={attachment.name} className="text-[12px] font-semibold text-blue-600 underline">
          <span className="inline-flex items-center gap-1.5">
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

  const getMessageTimestamp = (message: ChatMessage): number => {
    const value = message.createdAt || message.sentAt;
    if (!value) {
      return Number.NaN;
    }
    return new Date(value).getTime();
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

  const headerName = chatType === MessageType.PRIVATE ? (otherUserName || 'Unknown') : (classroomName || 'Class Group');
  const headerInitial = headerName.charAt(0).toUpperCase();

  return (
    <div className={fullScreen ? 'mx-auto flex h-screen min-h-screen w-full max-w-[420px] flex-col overflow-hidden border-x border-gray-200 bg-white' : 'flex h-[560px] w-[360px] flex-col overflow-hidden rounded-sm border border-gray-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.1)]'}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3.5">
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-sm text-gray-600 transition-colors hover:bg-gray-100"
            title="Quay lại"
          >
            <span className="text-[20px] leading-none">←</span>
          </button>
          <div className="relative">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-700">
              {headerInitial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-green-500" />
          </div>
          <div className="text-[15px] font-semibold tracking-tight text-gray-900">{headerName}</div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-600 transition-colors hover:bg-gray-100" title="Tùy chọn">
          <span className="text-[20px] leading-none">⋮</span>
        </button>
      </div>

      {/* Messages Area */}
      <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-white px-3 py-3 [scrollbar-color:#ffffff_#ffffff] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white [&::-webkit-scrollbar-track]:bg-white [&::-webkit-scrollbar]:w-[6px]">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-[12px] text-gray-500">Đang tải tin nhắn...</div>
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <div className="mb-3 text-3xl">💬</div>
            <div className="text-xs">Chưa có tin nhắn nào</div>
          </div>
        ) : (
          Object.keys(groupedMessages).map((dateKey) => (
            <div key={dateKey}>
              <div className="my-2 flex justify-center">
                <span className="rounded-sm bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gray-500">
                  {dateKey}
                </span>
              </div>

              {groupedMessages[dateKey].map((message, messageIndex) => {
                const isOwnMessage = message.senderId === currentUserId;
                const messagesInDay = groupedMessages[dateKey];
                const previousMessage = messageIndex > 0 ? messagesInDay[messageIndex - 1] : null;
                const currentTimestamp = getMessageTimestamp(message);
                const previousTimestamp = previousMessage ? getMessageTimestamp(previousMessage) : Number.NaN;
                const showMeta = !previousMessage || Number.isNaN(currentTimestamp) || Number.isNaN(previousTimestamp)
                  ? true
                  : (currentTimestamp - previousTimestamp) >= 10 * 60 * 1000;

                return (
                  <div key={message.id} className={`group flex max-w-[85%] flex-col ${isOwnMessage ? 'ml-auto items-end' : 'items-start'} mb-3`}>
                    {showMeta && (
                      <div className="mb-1 flex items-center gap-2">
                        {!isOwnMessage && (
                          <span className="text-[11px] font-semibold text-gray-800">
                            {chatType === MessageType.CLASS_GROUP ? message.senderName : headerName}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500">
                          {formatTime(message.createdAt || message.sentAt || new Date().toISOString())}
                        </span>
                        {isOwnMessage && <span className="text-[11px] font-semibold text-blue-600">You</span>}
                      </div>
                    )}

                    <div
                      className={`rounded-sm px-3 py-2 text-[15px] leading-relaxed shadow-sm ${isOwnMessage
                        ? 'border border-blue-200 bg-blue-50 text-gray-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}
                      title={formatTime(message.createdAt || message.sentAt || new Date().toISOString())}
                    >
                      {renderMessageContent(message)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {isAiAssistantChat ? (
        <div className="shrink-0 bg-white px-2.5 py-2.5">
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
            {contextFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {contextFiles.map((filePath, index) => (
                  <span
                    key={`${filePath}-${index}`}
                    className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${index === 0 && filePath === activeFilePath
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    title={filePath}
                  >
                    <File size={12} />
                    <button
                      type="button"
                      onClick={() => handleOpenContextFile(filePath)}
                      className="max-w-[180px] truncate text-left underline-offset-2 hover:underline"
                      title={`Mo file: ${filePath}`}
                    >
                      {filePath}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeContextFile(filePath);
                      }}
                      className="rounded p-0.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                      title="Bo file khoi context"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              className="min-h-[36px] max-h-[110px] w-full resize-none border-0 bg-transparent px-1 py-0 text-[14px] leading-[20px] text-gray-900 placeholder:text-gray-400 outline-none [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300"
              disabled={false}
              placeholder="Nhap tin nhan..."
            />

            <div className="-mt-2 flex items-center justify-between pt-0">
              <button
                type="button"
                onClick={handlePickWorkspaceFile}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                title="Them file trong workspace"
              >
                <Plus size={17} />
              </button>

              <button
                onClick={handleSendMessage}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${newMessage.trim() ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900' : 'cursor-not-allowed text-gray-300'
                  }`}
                disabled={!newMessage.trim()}
                title="Gui"
              >
                <Send size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex shrink-0 items-center gap-1.5 border-t border-gray-200 bg-white px-2.5 py-2.5">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFilePicked(e.target.files?.[0] || null, 'image')}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFilePicked(e.target.files?.[0] || null, 'file')}
          />

          <div className="flex items-center">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-sm text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50"
              onClick={() => imageInputRef.current?.click()}
              title="Gửi ảnh"
              disabled={!isConnected}
            >
              <ImagePlus size={19} strokeWidth={2.1} />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-sm text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              title="Gửi file"
              disabled={!isConnected}
            >
              <Paperclip size={19} strokeWidth={2.1} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="h-[40px] min-h-[40px] max-h-[160px] flex-1 resize-none rounded-sm border-0 border-b border-gray-300 bg-gray-50 px-2.5 py-2 text-[14px] leading-[20px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-0"
            disabled={!isConnected}
            placeholder={pendingAttachment ? `Sẵn sàng gửi: ${pendingAttachment.name}` : 'Nhập tin nhắn...'}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected}
            className={`flex h-9 w-9 items-center justify-center rounded-sm p-0 transition-all duration-150 ${isConnected
              ? 'cursor-pointer text-blue-600 hover:bg-blue-50 hover:text-blue-700'
              : 'cursor-not-allowed text-gray-400'
              }`}
            title={(newMessage.trim() || pendingAttachment) ? 'Gửi' : 'Thả tim'}
          >
            {(newMessage.trim() || pendingAttachment) ? (
              <Send size={20} strokeWidth={2.4} />
            ) : (
              <ThumbsUp size={19} strokeWidth={2.4} />
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
