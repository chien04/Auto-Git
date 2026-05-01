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
        vscode.postMessage({ type: 'loadMyClasses' });
        if (onClose) {
          onClose();
        } else {
          vscode.postMessage({ type: 'classCreated' });
        }
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
    // Bao phủ toàn bộ bằng font và màu nền VS Code
    <div className="font-vscode bg-vscode-bg text-vscode-fg min-h-screen flex justify-center">

      {/* Giới hạn độ rộng tối đa để form không bị bẹp ngang, giữ layout gọn gàng */}
      <div className="flex flex-col min-h-screen max-w-[500px] w-full">

        {/* Header chuẩn VS Code (Viền mỏng, chữ gọn) */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-solid border-[var(--vscode-panel-border)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 text-vscode-link flex items-center justify-center">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 48 48">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight text-vscode-fg">AutoGit</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-vscode-fg">{user?.name || 'Giáo viên'}</span>
            <div className="w-px h-3.5 bg-[var(--vscode-panel-border)]"></div>
            <button
              onClick={() => vscode.postMessage({ type: 'logout' })}
              className="cursor-pointer flex items-center justify-center p-1 rounded-sm text-vscode-desc hover:text-[var(--vscode-errorForeground)] hover:bg-vscode-hoverBg transition-colors"
              title="Đăng xuất"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Căn lề trái, đẩy lên trên, Padding chuẩn 24px (px-6) */}
        <main className="flex flex-1 flex-col px-6 pt-8 pb-10">
          <div className="w-full flex flex-col gap-6">

            {/* Tiêu đề góc trái */}
            <div>
              <h1 className="text-vscode-fg text-[22px] font-normal leading-tight mb-1.5">
                Tạo lớp học mới
              </h1>
              <p className="text-vscode-desc text-[13px] leading-relaxed">
                Tạo một không gian (workspace) để tổ chức quản lý bài tập của sinh viên.
              </p>
            </div>

            {/* Form Input */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-vscode-fg text-[13px] font-medium">Tên lớp học</label>
                <input
                  // Cực kỳ quan trọng: Input cao 28px (h-7), chữ 13px, viền bao trong (outline-offset-[-1px])
                  className="flex w-full rounded-sm border border-solid border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] outline-none focus:outline focus:outline-1 focus:-outline-offset-1 focus:outline-[var(--vscode-focusBorder)] focus:border-transparent h-7 px-2.5 text-[13px] transition-all placeholder:text-[var(--vscode-input-placeholderForeground)]"
                  placeholder="Ví dụ: Lập trình Web - K66"
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleCreateClass();
                  }}
                  autoFocus
                />
              </div>

              {/* Box thông báo (Giống hộp thoại Info của VS Code) */}
              {message && (
                <div className="px-3 py-2 rounded-sm bg-[var(--vscode-textBlockQuote-background)] border border-solid border-[var(--vscode-panel-border)] flex items-start gap-2">
                  <svg className="w-4 h-4 text-vscode-link shrink-0 mt-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[12px] text-vscode-fg leading-relaxed font-medium">{message}</p>
                </div>
              )}

              {/* Action Buttons: Kích thước 28px (h-7), nằm ngang sát nhau */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleCreateClass}
                  className="cursor-pointer flex items-center justify-center rounded-sm h-7 px-4 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] text-[13px] font-medium hover:bg-[var(--vscode-button-hoverBackground)] transition-colors active:scale-[0.98]"
                >
                  Tạo lớp học
                </button>
                <button
                  onClick={handleCancel}
                  className="cursor-pointer flex items-center justify-center rounded-sm h-7 px-4 border border-solid border-[var(--vscode-button-secondaryBackground)] bg-transparent text-vscode-fg text-[13px] font-medium hover:bg-vscode-hoverBg transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
};

export default TeacherForm;
