import React from 'react';

interface SidebarProps {
  currentUser: any;
  activeView: 'DASHBOARD' | 'CHAT';
  onViewChange: (view: 'DASHBOARD' | 'CHAT') => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, activeView, onViewChange, onLogout }) => {
  return (
    <div className="fixed left-0 top-0 z-[100] flex h-screen w-[70px] flex-col border-r border-[#e0e0e0] bg-white py-4">
      {/* User Profile Section */}
      <div className="mb-4 flex flex-col items-center border-b border-[#e0e0e0] px-2 pb-4">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-black text-base font-semibold text-white">
          {currentUser.name?.charAt(0).toUpperCase() || 'C'}
        </div>
        <div className="mb-0.5 max-w-[60px] break-words text-center text-[10px] font-semibold text-black">{currentUser.name || 'Chiến Băng'}</div>
        <div className="text-center text-[9px] text-[#666]">
          {currentUser.role === 'TEACHER' ? 'Giáo viên' : 'Sinh viên'}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-col gap-1 px-2">
        <button
          className={`flex flex-col items-center rounded-lg border-none bg-transparent px-1 py-3 outline-none transition-colors ${activeView === 'DASHBOARD' ? 'bg-[#f5f5f5]' : ''}`}
          onClick={() => onViewChange('DASHBOARD')}
        >
          <svg className="mb-1 text-black" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="text-center text-[10px] font-medium text-black">Dashboard</span>
        </button>
        <button
          className={`flex flex-col items-center rounded-lg border-none bg-transparent px-1 py-3 outline-none transition-colors ${activeView === 'CHAT' ? 'bg-[#f5f5f5]' : ''}`}
          onClick={() => onViewChange('CHAT')}
        >
          <svg className="mb-1 text-black" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-center text-[10px] font-medium text-black">Chat</span>
        </button>
        <button
          className="flex flex-col items-center rounded-lg border-none bg-transparent px-1 py-3 outline-none transition-colors"
          onClick={onLogout}
        >
          <svg className="mb-1 text-black" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="text-center text-[10px] font-medium text-black">Đăng xuất</span>
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
