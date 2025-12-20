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
        <div style={styles.container}>
            <h3 style={styles.title}>Thống kê lớp học</h3>
            
            <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                    <div style={styles.statLabel}>Tổng sinh viên</div>
                    <div style={styles.statValue}>{totalStudents}</div>
                </div>

                <div style={styles.statBox}>
                    <div style={styles.statLabel}>Đã nộp bài</div>
                    <div style={{...styles.statValue, color: '#40c463'}}>
                        {studentsSubmitted}
                        <span style={styles.percentage}> ({submittedPercentage}%)</span>
                    </div>
                </div>

                <div style={styles.statBox}>
                    <div style={styles.statLabel}>Chưa nộp</div>
                    <div style={{...styles.statValue, color: '#ed4956'}}>
                        {studentsNotSubmitted}
                        <span style={styles.percentage}> ({notSubmittedPercentage}%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        marginBottom: '20px',
        backgroundColor: '#fff',
        border: '1px solid #dbdbdb',
        borderRadius: '12px',
        padding: '20px',
    },
    title: {
        fontSize: '16px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: '#262626',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
    },
    statBox: {
        textAlign: 'center',
        padding: '12px',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
    },
    statLabel: {
        fontSize: '11px',
        color: '#8e8e8e',
        marginBottom: '4px',
    },
    statValue: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#262626',
    },
    percentage: {
        fontSize: '13px',
        color: '#8e8e8e',
        fontWeight: 'normal',
    },
};
