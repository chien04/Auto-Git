import React, { useEffect, useState } from 'react';

interface TeacherStatsCardProps {
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

export const TeacherStatsCard: React.FC<TeacherStatsCardProps> = ({ apiService }) => {
    const [classes, setClasses] = useState<ClassStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const classStats = await apiService.getTeacherClassStatistics();
            setClasses(classStats);
        } catch (error) {
            console.error('Failed to load teacher stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={styles.loading}>Đang tải thống kê...</div>;
    }

    const totalClasses = classes.length;
    const activeClasses = classes.filter(c => c.isActive).length;

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Tổng quan</h3>
            
            <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                    <div style={styles.statLabel}>Tổng số lớp</div>
                    <div style={styles.statValue}>{totalClasses}</div>
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
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
    },
    statBox: {
        textAlign: 'center',
        padding: '16px',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
    },
    statLabel: {
        fontSize: '12px',
        color: '#8e8e8e',
        marginBottom: '8px',
    },
    statValue: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#262626',
    },
    loading: {
        padding: '20px',
        textAlign: 'center',
        color: '#8e8e8e',
        fontSize: '13px',
    },
};
