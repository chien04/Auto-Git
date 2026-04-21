import React, { useEffect, useState } from 'react';

interface TeacherStatsCardProps {
    vscode: any;
    apiService: any;
}

interface ClassStats {
    classId: number;
    className: string;
    classCode: string;
    totalStudents: number;
    studentsSubmitted: number;
    studentsNotSubmitted: number;
    submittedPercentage: number;
    notSubmittedPercentage: number;
    isActive: boolean;
}

export const TeacherStatsCard: React.FC<TeacherStatsCardProps> = ({ vscode, apiService }) => {
    const [classes, setClasses] = useState<ClassStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();

        // Listen for messages from extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'teacherStatsLoaded') {
                setClasses(message.stats);
                setLoading(false);
            } else if (message.type === 'teacherStatsError') {
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const loadStats = () => {
        setLoading(true);
        vscode.postMessage({ type: 'getTeacherClassStatistics' });
    };

    if (loading) {
        return <div className="p-5 text-center text-[13px] text-[#8e8e8e]">Đang tải thống kê...</div>;
    }

    const totalClasses = classes.length;
    const activeClasses = classes.filter(c => c.isActive).length;

    return (
        <div className="mb-6 rounded-xl border border-[#dbdbdb] bg-white p-5">
            <h3 className="mb-4 text-lg font-bold text-[#262626]">Tổng quan</h3>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[#fafafa] p-4 text-center">
                    <div className="mb-2 text-xs text-[#8e8e8e]">Tổng số lớp</div>
                    <div className="text-2xl font-bold text-[#262626]">{totalClasses}</div>
                </div>
            </div>
        </div>
    );
};
