import React from 'react';

interface BottomNavigationProps {
  activeTab: 'dashboard' | 'chat' | 'settings';
  onTabChange: (tab: 'dashboard' | 'chat' | 'settings') => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-[#dbdfe6] flex items-center justify-around px-2 py-2.5 z-20">
      <button
        onClick={() => onTabChange('dashboard')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${
          activeTab === 'dashboard'
            ? 'border-[#111318] text-[#111318]'
            : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
        }`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
      </button>

      <button
        onClick={() => onTabChange('chat')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${
          activeTab === 'chat'
            ? 'border-[#111318] text-[#111318]'
            : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
        }`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
      </button>

      <button
        onClick={() => onTabChange('settings')}
        className={`flex-1 flex flex-col items-center gap-1 pt-1 pb-0.5 transition-colors border-b-2 ${
          activeTab === 'settings'
            ? 'border-[#111318] text-[#111318]'
            : 'border-transparent text-[#9ca3af] hover:text-[#111318]'
        }`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
      </button>
    </nav>
  );
};

export default BottomNavigation;
