import React, { useEffect, useState } from 'react';

interface StatsCardProps {
    vscode: any;
    apiService: any;
}

interface DashboardData {
    totalCommits: number;
    lastCommitAt: string | null;
    totalClasses: number;
    activeClasses: number;
}

export const StudentStatsCard: React.FC<StatsCardProps> = ({ vscode, apiService }) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();

        // Listen for messages from extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'studentDashboardLoaded') {
                setData(message.dashboard);
                setLoading(false);
            } else if (message.type === 'studentDashboardError') {
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const loadStats = () => {
        setLoading(true);
        vscode.postMessage({ type: 'getStudentDashboard' });
    };

    const formatLastCommit = (dateString: string | null) => {
        if (!dateString) return 'Chưa có commit';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays === 1) return 'Hôm qua';
        if (diffDays < 7) return `${diffDays} ngày trước`;
        
        return date.toLocaleDateString('vi-VN');
    };

    if (loading) {
        return <div className="p-5 text-center text-[13px] text-[#8e8e8e]">Đang tải thống kê...</div>;
    }

    if (!data) {
        return null;
    }

    return (
        <div className="mb-6 rounded-xl border border-[#dbdbdb] bg-white p-5">
            <h3 className="mb-4 text-lg font-bold text-[#262626]">Thống kê của bạn</h3>
            
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                <div className="flex items-center rounded-lg bg-[#fafafa] p-3">
                    <div>
                        <div className="mb-1 text-xs text-[#8e8e8e]">Tổng commit</div>
                        <div className="text-[20px] font-bold text-[#262626]">{data.totalCommits}</div>
                    </div>
                </div>

                <div className="flex items-center rounded-lg bg-[#fafafa] p-3">
                    <div>
                        <div className="mb-1 text-xs text-[#8e8e8e]">Commit gần nhất</div>
                        <div className="text-[13px] font-semibold text-[#0095f6]">{formatLastCommit(data.lastCommitAt)}</div>
                    </div>
                </div>

                <div className="flex items-center rounded-lg bg-[#fafafa] p-3">
                    <div>
                        <div className="mb-1 text-xs text-[#8e8e8e]">Lớp tham gia</div>
                        <div className="text-[20px] font-bold text-[#262626]">{data.totalClasses}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
