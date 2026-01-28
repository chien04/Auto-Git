import React, { useState, useEffect } from 'react';

interface StudentFormProps {
  vscode: any;
  user?: any;
  onClose?: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ vscode, user, onClose }) => {
  const [studentName, setStudentName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'joinClassSuccess') {
        setMessage('Tham gia lớp học thành công! Bạn có thể tham gia bài tập.');
        setStudentName('');
        setClassCode('');
        // Notify parent dashboard
        vscode.postMessage({ type: 'classJoined' });
      } else if (msg.command === 'joinClassError') {
        setMessage(`Lỗi: ${msg.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleJoinClass = () => {
    if (!studentName || !classCode) {
      setMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    vscode.postMessage({ type: 'joinClass', studentName, classCode });
    setMessage('Đang tham gia lớp học...');
  };

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-[#dbdfe6] px-6 py-4 bg-white">
        <div className="flex items-center gap-3 text-[#111318]">
          <div className="w-6 h-6 text-[#111318] flex items-center justify-center">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 48 48">
              <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-tight">AutoGit</h2>
        </div>
        <button 
          onClick={onClose}
          className="flex items-center justify-center rounded-lg h-9 w-9 bg-[#f7f7f7] text-[#616f89] hover:bg-[#e5e5e5] transition-colors"
          title="Đóng"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Form Content Container */}
      <main className="flex flex-col flex-1 px-6 py-10 bg-white h-full">
        {/* Headline Section */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-[#111318] tracking-tight text-[28px] font-extrabold leading-tight text-center">
            Tham gia lớp học
          </h1>
          {/* Body Text */}
          <p className="text-[#616f89] text-base font-normal leading-relaxed text-center mt-3">
            Nhập tên và mã lớp học do giáo viên cung cấp
          </p>
        </div>

        {/* Input Fields Section */}
        <div className="space-y-5">
          {/* Student Name Field */}
          <div className="flex flex-col w-full">
            <label className="flex flex-col w-full">
              <span className="text-[#111318] text-sm font-semibold leading-normal pb-2 ml-1">Tên sinh viên</span>
              <input 
                type="text"
                className="form-input flex w-full rounded-lg text-[#111318] focus:outline-0 focus:ring-2 focus:ring-[#111318]/20 border border-[#dbdfe6] bg-white h-14 placeholder:text-[#9ca3af] p-4 text-base font-normal leading-normal transition-all"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </label>
          </div>

          {/* Class Code Field */}
          <div className="flex flex-col w-full">
            <label className="flex flex-col w-full">
              <span className="text-[#111318] text-sm font-semibold leading-normal pb-2 ml-1">Mã lớp học</span>
              <input 
                type="text"
                className="form-input flex w-full rounded-lg text-[#111318] focus:outline-0 focus:ring-2 focus:ring-[#111318]/20 border border-[#dbdfe6] bg-white h-14 placeholder:text-[#9ca3af] p-4 text-base font-normal leading-normal transition-all"
                placeholder="Ví dụ: AB12-CD34"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleJoinClass();
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
        </div>

        {/* Action Buttons Section */}
        <div className="mt-10 flex flex-col gap-4">
          <button 
            onClick={handleJoinClass}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 bg-[#111318] text-white gap-2 text-base font-bold leading-normal tracking-wide hover:bg-[#2c2c2c] transition-colors"
          >
            <span>Tham gia lớp học</span>
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-transparent text-[#616f89] gap-2 text-sm font-medium leading-normal hover:text-[#111318] transition-colors"
            >
              <span>Hủy</span>
            </button>
          )}
        </div>

        {/* Visual Accent */}
        <div className="mt-auto pt-10 flex justify-center opacity-10">
          <div className="w-24 h-1 bg-[#111318] rounded-full"></div>
        </div>
      </main>
    </>
  );
};

export default StudentForm;
