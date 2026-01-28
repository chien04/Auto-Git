import React, { useState, useEffect } from 'react';

interface TeacherFormProps {
  vscode: any;
  user?: any;
  onClose?: () => void;
}

const TeacherForm: React.FC<TeacherFormProps> = ({ vscode, user, onClose }) => {
  const [className, setClassName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'createClassSuccess') {
        setMessage(`Lớp học đã được tạo! Mã lớp: ${msg.data.classCode}`);
        setClassName('');
        // Notify parent dashboard
        vscode.postMessage({ type: 'classCreated' });
      } else if (msg.command === 'createClassError') {
        setMessage(`Lỗi: ${msg.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleCreateClass = () => {
    if (!className) {
      setMessage('Vui lòng nhập tên lớp học');
      return;
    }
    vscode.postMessage({ type: 'createClass', className });
    setMessage('Đang tạo lớp học...');
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      vscode.postMessage({ type: 'loadMyClasses' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col min-h-screen max-w-[420px] w-full bg-white shadow-2xl">
        {/* Header matching TeacherDashboard */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-[#dbdfe6]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#135bec] flex items-center justify-center rounded">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 48 48">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-[#111318]">AutoGit</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#111318]">{user?.name || 'Giáo viên'}</span>
            <div className="w-px h-4 bg-[#dbdfe6]"></div>
            <button 
              onClick={() => vscode.postMessage({ type: 'logout' })}
              className="flex items-center justify-center p-1.5 rounded-full text-[#616f89] hover:text-red-600 hover:bg-gray-100 transition-colors" 
              title="Đăng xuất"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Centered Form Content */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px] flex flex-col gap-8">
            {/* Headline */}
            <div className="text-center">
              <h1 className="text-[#111318] text-3xl font-bold leading-tight tracking-tight">
                Tạo lớp học mới
              </h1>
            </div>

            {/* Input Form Section */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="flex flex-col w-full">
                  <p className="text-[#111318] text-sm font-semibold leading-normal pb-2 px-1">Tên lớp học</p>
                  <input 
                    className="flex w-full min-w-0 rounded-lg text-[#111318] border border-[#dbdfe6] bg-white focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec] h-10 placeholder:text-[#616f89] px-4 text-base font-normal transition-all" 
                    placeholder="Ví dụ: Lập trình Web - K66" 
                    type="text" 
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleCreateClass();
                    }}
                  />
                </label>
              </div>

              {/* Message Display */}
              {message && (
                <div className="p-4 rounded-lg bg-[#135bec]/10 border border-[#135bec]/20">
                  <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 mt-2">
                <button 
                  onClick={handleCreateClass}
                  className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-6 bg-[#135bec] text-white text-base font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity"
                >
                  <span className="truncate">Tạo lớp học</span>
                </button>
                <button 
                  onClick={handleCancel}
                  className="text-[#616f89] text-sm font-medium leading-normal py-2 px-4 text-center underline underline-offset-4 hover:text-[#111318] transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Meta */}
        <footer className="p-6 text-center">
          <p className="text-[#616f89] text-xs font-normal">
            Tạo lớp học để tổ chức workspace và quản lý sinh viên
          </p>
        </footer>
      </div>
    </div>
  );
};

export default TeacherForm;
