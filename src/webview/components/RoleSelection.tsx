import React from 'react';

interface RoleSelectionProps {
  onSelectRole: (role: 'TEACHER' | 'STUDENT') => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-5">
      <div className="w-full max-w-[600px]">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-[-0.5px] text-black">UET-CodingRooms</h1>
          <p className="text-base font-normal text-[#8e8e8e]">Quản lý lớp học dễ dàng</p>
        </div>

        <div className="rounded-[20px] border border-[#e5e5e5] bg-white px-10 py-12 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <p className="mb-8 text-center text-xl font-semibold text-[#262626]">Bạn là?</p>
          
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => onSelectRole('TEACHER')}
              className="cursor-pointer rounded-2xl border-2 border-[#dbdbdb] bg-white px-6 py-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.08)] outline-none transition-all duration-200 ease-in-out hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
            >
              <h3 className="mb-2 text-lg font-semibold text-black">Giáo viên</h3>
              <p className="m-0 text-[13px] font-normal leading-[1.5] text-[#8e8e8e]">Tạo và quản lý lớp học, theo dõi sinh viên</p>
            </button>

            <button
              onClick={() => onSelectRole('STUDENT')}
              className="cursor-pointer rounded-2xl border-2 border-[#dbdbdb] bg-white px-6 py-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.08)] outline-none transition-all duration-200 ease-in-out hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
            >
              <h3 className="mb-2 text-lg font-semibold text-black">Sinh viên</h3>
              <p className="m-0 text-[13px] font-normal leading-[1.5] text-[#8e8e8e]">Tham gia lớp học và nộp bài tập</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
