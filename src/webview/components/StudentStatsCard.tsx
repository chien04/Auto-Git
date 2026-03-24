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
        return <div style={styles.loading}>Đang tải thống kê...</div>;
    }

    if (!data) {
        return null;
    }

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Thống kê của bạn</h3>
            
            <div style={styles.grid}>
                <div style={styles.statItem}>
                    <div>
                        <div style={styles.statLabel}>Tổng commit</div>
                        <div style={styles.statValue}>{data.totalCommits}</div>
                    </div>
                </div>

                <div style={styles.statItem}>
                    <div>
                        <div style={styles.statLabel}>Commit gần nhất</div>
                        <div style={styles.statValueSmall}>{formatLastCommit(data.lastCommitAt)}</div>
                    </div>
                </div>

                <div style={styles.statItem}>
                    <div>
                        <div style={styles.statLabel}>Lớp tham gia</div>
                        <div style={styles.statValue}>{data.totalClasses}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        marginBottom: '24px',
        backgroundColor: '#fff',
        border: '1px solid #dbdbdb',
        borderRadius: '12px',
        padding: '20px',
    },
    title: {
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: '#262626',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
    },
    statLabel: {
        fontSize: '12px',
        color: '#8e8e8e',
        marginBottom: '4px',
    },
    statValue: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#262626',
    },
    statValueSmall: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#0095f6',
    },
    loading: {
        padding: '20px',
        textAlign: 'center',
        color: '#8e8e8e',
        fontSize: '13px',
    },
};
