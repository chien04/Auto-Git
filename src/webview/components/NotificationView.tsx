import React, { useEffect, useMemo, useState } from 'react';

interface NotificationViewProps {
  vscode: any;
}

interface NotificationItem {
  id: number;
  title: string;
  subtitle?: string;
  time: string;
  type: 'class' | 'student' | 'instructor';
  roleLabel?: string;
  preview?: string;
  unread?: boolean;
  initials: string;
}

interface IncomingNotification {
  id?: number;
  type?: string;
  title?: string;
  message?: string;
  createdAt?: string;
  isRead?: boolean;
  score?: number;
}

const getInitials = (text: string) => {
  const words = text.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return text.slice(0, 2).toUpperCase();
};

const formatTime = (iso?: string) => {
  if (!iso) return 'Now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Now';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const mapIncomingToItem = (incoming: IncomingNotification): NotificationItem => {
  const type = incoming.type || 'INFO';
  const title = incoming.title || '';
  const message = incoming.message || 'Bạn có thông báo mới';
  const isRead = incoming.isRead ?? false;
  const createdAt = incoming.createdAt;

  if (type === 'SUBMIT') {
    return {
      id: incoming.id || Date.now(),
      title: title || 'Bài nộp mới',
      subtitle: 'Thông báo cho giáo viên',
      preview: message,
      time: formatTime(createdAt),
      type: 'student',
      roleLabel: 'Student',
      unread: !isRead,
      initials: 'SV'
    };
  }

  if (type === 'GRADED') {
    return {
      id: incoming.id || Date.now(),
      title: title || 'Đã chấm điểm',
      subtitle: 'Thông báo cho sinh viên',
      preview: message,
      time: formatTime(createdAt),
      type: 'instructor',
      roleLabel: 'Instructor',
      unread: !isRead,
      initials: 'GV'
    };
  }

  return {
    id: incoming.id || Date.now(),
    title: title || 'Thông báo mới',
    preview: message,
    time: formatTime(createdAt),
    type: 'class',
    unread: !isRead,
    initials: getInitials('TB')
  };
};

const NotificationView: React.FC<NotificationViewProps> = ({ vscode }) => {
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    vscode.postMessage({ type: 'getNotifications' });

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'notificationsLoaded' && Array.isArray(data.notifications)) {
        const loaded = data.notifications.map((item: IncomingNotification) => mapIncomingToItem(item));
        setNotifications(loaded);
      } else if (data?.type === 'websocketNotification' && data.notification) {
        const item = mapIncomingToItem(data.notification as IncomingNotification);
        setNotifications(prev => [item, ...prev.filter(p => p.id !== item.id)].slice(0, 100));
      } else if (data?.type === 'notificationMarkedAsRead' && data.notificationId) {
        setNotifications(prev => prev.map(item =>
          item.id === data.notificationId ? { ...item, unread: false } : item
        ));
      } else if (data?.type === 'allNotificationsMarkedAsRead') {
        setNotifications(prev => prev.map(item => ({ ...item, unread: false })));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]);

  const filteredNotifications = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return notifications;
    }

    return notifications.filter((item) => {
      return (
        item.title.toLowerCase().includes(keyword) ||
        (item.preview || '').toLowerCase().includes(keyword) ||
        (item.subtitle || '').toLowerCase().includes(keyword) ||
        (item.roleLabel || '').toLowerCase().includes(keyword)
      );
    });
  }, [search, notifications]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-white">
      <div className="px-4 py-3 border-b border-[#eef1f6] bg-white">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-[#9ca3af] text-[14px]">/</span>
          <input
            className="w-full bg-[#f3f4f6] border border-transparent rounded-lg py-2.5 pl-9 pr-4 text-xs focus:ring-1 focus:ring-[#111318] focus:border-[#111318] placeholder-[#9ca3af] outline-none transition-all"
            placeholder="Search notifications..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-white pb-24">
        {filteredNotifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
            <div className="w-12 h-12 rounded-full bg-[#f3f4f6] flex items-center justify-center text-lg mb-3">?</div>
            <p className="text-sm font-semibold text-[#111318]">No notifications found</p>
            <p className="text-xs text-[#616f89] mt-1">Try another keyword.</p>
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 px-4 py-4 hover:bg-[#f8fafc] cursor-pointer border-b border-[#f1f5f9]"
              onClick={() => {
                if (item.unread) {
                  vscode.postMessage({ type: 'markNotificationAsRead', notificationId: item.id });
                }
              }}
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-lg bg-[#111318] text-white flex items-center justify-center text-xs font-bold">
                  {item.initials}
                </div>
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 overflow-hidden mb-0.5">
                    <p className="text-[14px] font-semibold truncate text-[#111318]">{item.title}</p>
                    {item.roleLabel && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-tighter ${
                          item.type === 'instructor'
                            ? 'bg-[#111318] text-white'
                            : 'bg-[#f3f4f6] text-[#616f89]'
                        }`}
                      >
                        {item.roleLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9ca3af]">{item.time}</span>
                </div>

                {item.subtitle && <p className="text-[12px] text-[#616f89] truncate">{item.subtitle}</p>}
                {item.preview && <p className="text-[12px] text-[#616f89] truncate">{item.preview}</p>}
              </div>

              {item.unread && <span className="mt-2 w-2 h-2 bg-[#111318] rounded-full"></span>}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default NotificationView;
