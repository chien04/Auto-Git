import React from 'react';

interface UserHeaderProps {
  user: any;
  onLogout: () => void;
  onOpenChat?: () => void;
  onOpenDashboard?: () => void;
  currentView?: string | null;
}

const UserHeader: React.FC<UserHeaderProps> = ({ 
  user, 
  onLogout, 
  onOpenChat, 
  onOpenDashboard,
  currentView 
}) => {
  return (
    <div className="flex items-center justify-between border-b border-[#dbdbdb] bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-base font-semibold tracking-[0.5px] text-white">
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <div className="mb-0.5 text-sm font-semibold text-[#262626]">{user?.name || user?.email}</div>
          <div className="text-xs font-normal text-[#8e8e8e]">
            {user?.role === 'TEACHER' ? 'Giáo viên' : 'Sinh viên'}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Navigation buttons */}
        <div className="flex gap-2">
          <button 
            onClick={onOpenDashboard}
            className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold outline-none transition-all ${currentView !== 'CHAT' ? 'border-[#0095f6] bg-[#0095f6] text-white' : 'border-[#dbdbdb] bg-white text-[#8e8e8e]'}`}
          >
            🏠 Dashboard
          </button>
          <button 
            onClick={onOpenChat}
            className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold outline-none transition-all ${currentView === 'CHAT' ? 'border-[#0095f6] bg-[#0095f6] text-white' : 'border-[#dbdbdb] bg-white text-[#8e8e8e]'}`}
          >
            💬 Chat
          </button>
        </div>
        
        <button onClick={onLogout} className="cursor-pointer rounded-[10px] border border-[#dbdbdb] bg-white px-5 py-2 text-[13px] font-semibold text-[#262626] outline-none transition-all">
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

export default UserHeader;
