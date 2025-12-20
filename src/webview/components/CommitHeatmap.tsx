import React, { useEffect, useState } from 'react';

interface CommitHeatmapProps {
    apiService: any;
}

interface DayData {
    date: string;
    count: number;
}

export const CommitHeatmap: React.FC<CommitHeatmapProps> = ({ apiService }) => {
    const [data, setData] = useState<DayData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivity();
    }, []);

    const loadActivity = async () => {
        try {
            const activity = await apiService.getStudentActivity();
            
            // Convert map to array
            // Each date with commits counts as 1 submission, regardless of commit count
            const dailyData: DayData[] = Object.entries(activity.dailyCommits || {})
                .map(([date, count]) => ({ 
                    date, 
                    count: (count as number) > 0 ? 1 : 0  // Convert to submission count (0 or 1)
                }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setData(dailyData);
        } catch (error) {
            console.error('Failed to load submission activity:', error);
        } finally {
            setLoading(false);
        }
    };

    const getColorForCount = (count: number): string => {
        if (count === 0) return '#ebedf0'; // ⬜
        if (count === 1) return '#40c463'; // 🟩
        return '#40c463'; // Always green if submitted
    };

    const getWeeks = () => {
        const weeks: DayData[][] = [];
        let currentWeek: DayData[] = [];

        // Start from Monday of first week
        let firstDate = data[0] ? new Date(data[0].date) : new Date();
        let dayOfWeek = firstDate.getDay();
        let daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        // Pad beginning with empty days if needed
        for (let i = 0; i < daysToMonday; i++) {
            currentWeek.push({ date: '', count: -1 });
        }

        data.forEach((day, index) => {
            currentWeek.push(day);
            
            const date = new Date(day.date);
            const isLastDay = index === data.length - 1;
            const isSunday = date.getDay() === 0;

            if (isSunday || isLastDay) {
                // Pad end of week if needed
                while (currentWeek.length < 7 && isLastDay) {
                    currentWeek.push({ date: '', count: -1 });
                }
                
                if (currentWeek.length > 0) {
                    weeks.push([...currentWeek]);
                    currentWeek = [];
                }
            }
        });

        return weeks;
    };

    if (loading) {
        return <div style={styles.loading}>Đang tải hoạt động...</div>;
    }

    if (data.length === 0) {
        return null;
    }

    const weeks = getWeeks();

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Hoạt động nộp bài</h3>
            
            <div style={styles.heatmapContainer}>
                <div style={styles.weekLabels}>
                    {weeks.map((_, index) => (
                        <div key={index} style={styles.weekLabel}>W{index + 1}</div>
                    ))}
                </div>
                
                <div>
                    <div style={styles.dayLabels}>
                        <span style={styles.dayLabel}>Mon</span>
                        <span style={styles.dayLabel}>Tue</span>
                        <span style={styles.dayLabel}>Wed</span>
                        <span style={styles.dayLabel}>Thu</span>
                        <span style={styles.dayLabel}>Fri</span>
                        <span style={styles.dayLabel}>Sat</span>
                        <span style={styles.dayLabel}>Sun</span>
                    </div>

                    <div style={styles.grid}>
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} style={styles.week}>
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={dayIndex}
                                        style={{
                                            ...styles.day,
                                            backgroundColor: day.count === -1 ? 'transparent' : getColorForCount(day.count),
                                        }}
                                        title={day.date ? `${day.date}: ${day.count === 1 ? 'Đã nộp' : 'Chưa nộp'}` : ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={styles.legend}>
                <div style={{ ...styles.legendBox, backgroundColor: '#ebedf0' }} />
                <span style={styles.legendLabel}>Chưa nộp</span>
                <div style={{ ...styles.legendBox, backgroundColor: '#40c463' }} />
                <span style={styles.legendLabel}>Đã nộp</span>
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
    heatmapContainer: {
        display: 'flex',
        gap: '8px',
    },
    weekLabels: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        paddingTop: '24px',
    },
    weekLabel: {
        fontSize: '11px',
        color: '#8e8e8e',
        height: '14px',
        display: 'flex',
        alignItems: 'center',
    },
    dayLabels: {
        display: 'flex',
        gap: '4px',
        marginBottom: '4px',
    },
    dayLabel: {
        fontSize: '11px',
        color: '#8e8e8e',
        width: '14px',
        textAlign: 'center',
    },
    grid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    week: {
        display: 'flex',
        gap: '4px',
    },
    day: {
        width: '14px',
        height: '14px',
        borderRadius: '2px',
        border: '1px solid #e1e4e8',
    },
    legend: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '16px',
        fontSize: '12px',
        color: '#8e8e8e',
    },
    legendLabel: {
        fontSize: '11px',
    },
    legendBox: {
        width: '12px',
        height: '12px',
        borderRadius: '2px',
        border: '1px solid #e1e4e8',
    },
    legendText: {
        fontSize: '11px',
        color: '#8e8e8e',
        marginTop: '8px',
    },
    loading: {
        padding: '20px',
        textAlign: 'center',
        color: '#8e8e8e',
        fontSize: '13px',
    },
};
