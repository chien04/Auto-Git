import React from 'react';

interface ClassDetailStatsProps {
    totalStudents: number;
    studentsSubmitted: number;
    studentsNotSubmitted: number;
    submittedPercentage: number;
    notSubmittedPercentage: number;
}

export const ClassDetailStats: React.FC<ClassDetailStatsProps> = ({
    totalStudents,
    studentsSubmitted,
    studentsNotSubmitted,
    submittedPercentage,
    notSubmittedPercentage
}) => {
    return (
        <div className="mb-5 rounded-xl border border-[#dbdbdb] bg-white p-5">
            <h3 className="mb-4 text-base font-bold text-[#262626]">Thống kê lớp học</h3>
            
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-[#fafafa] p-3 text-center">
                    <div className="mb-1 text-[11px] text-[#8e8e8e]">Tổng sinh viên</div>
                    <div className="text-[20px] font-bold text-[#262626]">{totalStudents}</div>
                </div>

                <div className="rounded-lg bg-[#fafafa] p-3 text-center">
                    <div className="mb-1 text-[11px] text-[#8e8e8e]">Đã nộp bài</div>
                    <div className="text-[20px] font-bold text-[#40c463]">
                        {studentsSubmitted}
                        <span className="text-[13px] font-normal text-[#8e8e8e]"> ({submittedPercentage}%)</span>
                    </div>
                </div>

                <div className="rounded-lg bg-[#fafafa] p-3 text-center">
                    <div className="mb-1 text-[11px] text-[#8e8e8e]">Chưa nộp</div>
                    <div className="text-[20px] font-bold text-[#ed4956]">
                        {studentsNotSubmitted}
                        <span className="text-[13px] font-normal text-[#8e8e8e]"> ({notSubmittedPercentage}%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
