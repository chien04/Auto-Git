import React from 'react';
import { LayoutDashboard, MessageCircle, Bell, Settings } from 'lucide-react';
interface BottomNavigationProps {
  activeTab: 'dashboard' | 'chat' | 'notification' | 'settings';
  onTabChange: (tab: 'dashboard' | 'chat' | 'notification' | 'settings') => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-[#dbdfe6] flex items-center justify-around px-2 py-2.5 z-20">

      {/* Tab Dashboard */}
      <button
        onClick={() => onTabChange('dashboard')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${activeTab === 'dashboard'
          ? 'border-[#111318] text-[#111318]'
          : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
          }`}
      >
        <LayoutDashboard className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
      </button>

      {/* Tab Chat */}
      <button
        onClick={() => onTabChange('chat')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${activeTab === 'chat'
          ? 'border-[#111318] text-[#111318]'
          : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
          }`}
      >
        <MessageCircle className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
      </button>

      {/* Tab Notification */}
      <button
        onClick={() => onTabChange('notification')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${activeTab === 'notification'
          ? 'border-[#111318] text-[#111318]'
          : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
          }`}
      >
        <div className="relative">
          <Bell className="w-6 h-6" strokeWidth={2} />
          {/* Chấm tròn thông báo chưa đọc */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#111318]"></span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider">Notif</span>
      </button>

      {/* Tab Settings */}
      <button
        onClick={() => onTabChange('settings')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${activeTab === 'settings'
          ? 'border-[#111318] text-[#111318]'
          : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
          }`}
      >
        <Settings className="w-6 h-6" strokeWidth={2} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
      </button>

    </nav>
  );
};

export default BottomNavigation;
