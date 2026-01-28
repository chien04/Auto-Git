import React, { useState } from 'react';

interface CreateAssignmentFormProps {
  vscode: any;
  user?: any;
  classCode: string;
  onClose: () => void;
}

const CreateAssignmentForm: React.FC<CreateAssignmentFormProps> = ({ vscode, user, classCode, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'createAssignmentSuccess') {
        setMessage(`Bài tập đã được tạo! Mã: ${msg.data.assignmentCode}`);
        setTimeout(() => {
          onClose();
          vscode.postMessage({ type: 'assignmentCreated', classCode });
        }, 1500);
      } else if (msg.command === 'createAssignmentError') {
        setMessage(`Lỗi: ${msg.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, classCode, onClose]);

  const handleCreateAssignment = () => {
    if (!title) {
      setMessage('Vui lòng nhập tên bài tập');
      return;
    }
    vscode.postMessage({ 
      type: 'createAssignment', 
      classCode,
      title, 
      description,
      deadline: deadline || null 
    });
    setMessage('Đang tạo bài tập...');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateAssignment();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-white">
      <div className="flex flex-col h-full max-w-[420px] w-full mx-auto">
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

        {/* Title Section */}
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-black tracking-tight text-[#111318]">
            Tạo bài tập mới
          </h1>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="flex-1 px-4 space-y-4">
          {/* Assignment Name */}
          <div className="space-y-2">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
              Tên bài tập
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 text-base bg-white border-2 border-[#dbdfe6] rounded-lg text-black focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all placeholder:text-[#616f89]"
              placeholder="Ví dụ: Bài tập tuần 1 - OOP"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
              Mô tả
            </label>
            <textarea
              className="w-full px-4 py-3 text-base bg-white border-2 border-[#dbdfe6] rounded-lg text-black focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all placeholder:text-[#616f89] resize-none"
              placeholder="Mô tả chi tiết về bài tập..."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
              Deadline
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                className="w-full px-4 py-3 text-base bg-white border-2 border-[#dbdfe6] rounded-lg focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all text-[#111318]"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className="p-4 rounded-lg bg-[#135bec]/10 border border-[#135bec]/20">
              <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
            </div>
          )}

          {/* Visual Divider */}
          <div className="pt-4 border-t border-[#dbdfe6]"></div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pb-6">
            <button
              type="submit"
              className="w-full py-4 bg-[#135bec] text-white font-bold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tạo bài tập
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-transparent text-[#616f89] font-medium rounded-lg hover:text-red-500 transition-colors text-sm"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignmentForm;
