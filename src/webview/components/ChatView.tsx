import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ChatViewProps {
  vscode: any;
  currentUser: any;
  token: string;
  onOpenChat: (config: any) => void;
  onChatClosed?: () => void;
}

interface Classroom {
  id: number;
  className: string;
  classCode: string;
  teacherName: string;
  studentCount: number;
}

interface RecentPrivateChat {
  userId: number;
  userName: string;
  userEmail: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

const ChatView: React.FC<ChatViewProps> = ({ vscode, currentUser, token, onOpenChat, onChatClosed }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [recentPrivateChats, setRecentPrivateChats] = useState<RecentPrivateChat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Set up message listener FIRST
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message && message.type === 'classesLoaded') {
        console.log('[ChatView] ✓ Received classesLoaded from extension');
        console.log('[ChatView] Classes array:', message.classes);
        
        if (message.classes && Array.isArray(message.classes)) {
          console.log('[ChatView] Setting', message.classes.length, 'classes');
          setClassrooms(message.classes);
          setLoading(false);
        }
      } else if (message && message.type === 'refreshChatView') {
        refreshData();
      } else if (message && message.type === 'newMessage') {
        // Refresh chat list when new message arrives
        refreshData();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // THEN load data after listener is ready
    loadData();
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadClassrooms(), loadRecentPrivateChats()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    await Promise.all([loadClassrooms(), loadRecentPrivateChats()]);
  };

  const loadClassrooms = async () => {
    try {
      console.log('[ChatView] Loading classrooms with messages');
      
      // Use new API endpoint that includes last message
      const endpoint = '/api/class/chat/classes-with-messages';
      const response = await axios.get(`http://localhost:8080${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('[ChatView] API response with messages:', response.data);
      let classes = response.data || [];
      
      // Sort by lastMessageTime (newest first), classes without messages at the end
      classes.sort((a: any, b: any) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      
      setClassrooms(classes);
      setLoading(false);
    } catch (error) {
      console.error('[ChatView] Error loading classrooms:', error);
      setLoading(false);
    }
  };

  const loadRecentPrivateChats = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/messages/recent-chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('[ChatView] Recent private chats RAW:', response.data);
      
      // Debug: log each chat's lastMessageTime
      response.data?.forEach((chat: any) => {
        console.log(`[ChatView] Chat with ${chat.userName}: lastMessage="${chat.lastMessage}", time=${chat.lastMessageTime}`);
      });
      
      setRecentPrivateChats(response.data || []);
    } catch (error) {
      console.error('Error loading recent chats:', error);
      setRecentPrivateChats([]);
    }
  };

  const searchMembers = async (query: string = '') => {
    try {
      setIsSearching(true);
      const endpoint = query.trim() 
        ? `/api/class/chat/search-members?query=${encodeURIComponent(query)}`
        : '/api/class/chat/search-members';
      const response = await axios.get(`http://localhost:8080${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching members:', error);
      setSearchResults([]);
    }
  };

  const handleOpenGroupChat = (classroom: Classroom) => {
    onOpenChat({
      classroomId: classroom.id,
      classroomName: classroom.className,
      chatType: 'CLASS_GROUP'
    });
  };

  const handleOpenPrivateChat = (chat: RecentPrivateChat) => {
    onOpenChat({
      otherUserId: chat.userId,
      otherUserName: chat.userName,
      chatType: 'PRIVATE'
    });
  };

  // Filter chats based on search query
  const filteredClassrooms = searchQuery.trim()
    ? classrooms.filter(classroom =>
        classroom.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        classroom.classCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : classrooms;

  const filteredPrivateChats = searchQuery.trim()
    ? recentPrivateChats.filter(chat =>
        chat.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recentPrivateChats;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#616f89] text-sm">Đang tải...</p>
      </div>
    );
  }

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('vi-VN', { weekday: 'long' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const getInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Search Box - Right below header */}
      <div className="px-4 py-3 border-b border-[#dbdfe6]">
        <div className="relative flex items-center">
          <svg className="absolute left-3 w-[18px] h-[18px] text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="w-full bg-[#f7f7f7] border-none rounded-lg py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-[#111318] placeholder-[#9ca3af] transition-all outline-none"
            placeholder="Search conversations..."
            value={searchQuery}
            onFocus={() => {
              if (!isSearching && searchResults.length === 0) {
                searchMembers('');
              }
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchMembers(e.target.value);
            }}
          />
          {searchQuery && (
            <button
              className="absolute right-3 text-[#9ca3af] hover:text-[#111318]"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setIsSearching(false);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <main className="flex-1 overflow-y-auto bg-white pb-24">
        {isSearching && searchQuery ? (
          /* Search Results */
          searchResults.length > 0 ? (
            searchResults.map((member) => (
              <div
                key={`search-${member.userId}`}
                className="flex items-center gap-3 px-4 py-4 hover:bg-[#fafafa] cursor-pointer border-b border-[#f7f7f7]"
                onClick={() => {
                  onOpenChat({
                    otherUserId: member.userId,
                    otherUserName: member.userName,
                    chatType: 'PRIVATE'
                  });
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsSearching(false);
                }}
              >
                <div className="w-12 h-12 rounded-full bg-[#9b59b6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {getInitials(member.userName)}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2 overflow-hidden mb-0.5">
                    <p className="text-[14px] font-semibold truncate text-[#111318]">{member.userName}</p>
                    <span className="px-1.5 py-0.5 rounded bg-[#f7f7f7] text-[10px] font-medium text-[#616f89] uppercase tracking-tighter">
                      {member.role}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#616f89] truncate">{member.className}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-[#616f89] text-sm">Không tìm thấy người dùng</p>
            </div>
          )
        ) : (
          /* Class Group Chats and Private Chats */
          <>
            {classrooms.length === 0 && recentPrivateChats.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#616f89] text-sm">Chưa có cuộc trò chuyện nào</p>
              </div>
            ) : (
              <>
                {/* Merge and sort all chats by time */}
                {(() => {
                  const merged = [
                    ...classrooms.map(c => ({ ...c, type: 'group', time: (c as any).lastMessageTime })),
                    ...recentPrivateChats.map(c => ({ ...c, type: 'private', time: c.lastMessageTime }))
                  ];
                  
                  const sorted = merged.sort((a: any, b: any) => {
                    if (!a.time && !b.time) return 0;
                    if (!a.time) return 1;
                    if (!b.time) return -1;
                    return new Date(b.time).getTime() - new Date(a.time).getTime();
                  });
                  
                  return sorted;
                })()
                  .map((chat: any) => {
                    if (chat.type === 'group') {
                      return (
                        <div
                          key={`group-${chat.id}`}
                          className="flex items-center gap-3 px-4 py-4 hover:bg-[#fafafa] cursor-pointer border-b border-[#f7f7f7]"
                          onClick={() => handleOpenGroupChat(chat)}
                        >
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-lg bg-[#111318] flex items-center justify-center text-white text-xs font-bold">
                              {getInitials(chat.className)}
                            </div>
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-[14px] font-semibold truncate text-[#111318]">{chat.className}</p>
                              {chat.lastMessageTime && (
                                <span className="text-[10px] text-[#9ca3af]">{formatTime(chat.lastMessageTime)}</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-[12px] text-[#616f89] truncate">
                                Class Group • {chat.studentCount} members
                              </p>
                              {chat.lastMessage && (
                                <div className="w-2 h-2 rounded-full bg-[#111318] shrink-0"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={`private-${chat.userId}`}
                          className="flex items-start gap-3 px-4 py-4 hover:bg-[#fafafa] cursor-pointer border-b border-[#f7f7f7]"
                          onClick={() => handleOpenPrivateChat(chat)}
                        >
                          <div className="w-12 h-12 rounded-full bg-[#9b59b6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {getInitials(chat.userName)}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 overflow-hidden mb-0.5">
                                <p className="text-[14px] font-semibold truncate text-[#111318]">{chat.userName}</p>
                                <span className="px-1.5 py-0.5 rounded bg-[#111318] text-[10px] font-medium text-white uppercase tracking-tighter">
                                  Student
                                </span>
                              </div>
                              {chat.lastMessageTime && (
                                <span className="text-[10px] text-[#9ca3af]">{formatTime(chat.lastMessageTime)}</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-[12px] text-[#616f89] truncate font-medium">
                                {chat.lastMessage || 'Bắt đầu trò chuyện'}
                              </p>
                              {chat.unreadCount && chat.unreadCount > 0 && (
                                <div className="w-2 h-2 rounded-full bg-[#111318] shrink-0"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default ChatView;
