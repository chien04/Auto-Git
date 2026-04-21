import React, { useEffect, useState } from 'react';

interface CommitHeatmapProps {
    apiService: any;
    vscode: any;
}

interface DayData {
    date: string;
    count: number;
}

export const CommitHeatmap: React.FC<CommitHeatmapProps> = ({ apiService, vscode }) => {
    const [data, setData] = useState<DayData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivity();

        // Listen for messages from extension
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'studentActivityLoaded') {
                const activity = message.activity;
                // Convert map to array
                const dailyData: DayData[] = Object.entries(activity.dailyCommits || {})
                    .map(([date, count]) => ({ 
                        date, 
                        count: (count as number) > 0 ? 1 : 0
                    }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                setData(dailyData);
                setLoading(false);
            } else if (message.type === 'studentActivityError') {
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const loadActivity = () => {
        setLoading(true);
        vscode.postMessage({ type: 'getStudentActivity' });
    };

    const getCellClass = (count: number): string => {
        if (count === -1) return 'border-none bg-transparent';
        if (count === 0) return 'border border-[#e1e4e8] bg-[#ebedf0]';
        return 'border border-[#e1e4e8] bg-[#40c463]';
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
        return <div className="p-5 text-center text-[13px] text-[#8e8e8e]">Đang tải hoạt động...</div>;
    }

    if (data.length === 0) {
        return null;
    }

    const weeks = getWeeks();

    return (
        <div className="mb-6 rounded-xl border border-[#dbdbdb] bg-white p-5">
            <h3 className="mb-4 text-lg font-bold text-[#262626]">Hoạt động nộp bài</h3>
            
            <div className="flex gap-2">
                <div className="flex flex-col gap-1 pt-6">
                    {weeks.map((_, index) => (
                        <div key={index} className="flex h-[14px] items-center text-[11px] text-[#8e8e8e]">W{index + 1}</div>
                    ))}
                </div>
                
                <div>
                    <div className="mb-1 flex gap-1">
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Mon</span>
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Tue</span>
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Wed</span>
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Thu</span>
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Fri</span>
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Sat</span>
                        <span className="w-4 text-center text-[11px] text-[#8e8e8e]">Sun</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex gap-1">
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={dayIndex}
                                        className={`h-4 w-4 rounded-[2px] ${getCellClass(day.count)}`}
                                        title={day.date ? `${day.date}: ${day.count === 1 ? 'Đã nộp' : 'Chưa nộp'}` : ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-1 text-xs text-[#8e8e8e]">
                <div className="h-3 w-3 rounded-[2px] border border-[#e1e4e8] bg-[#ebedf0]" />
                <span className="text-[11px]">Chưa nộp</span>
                <div className="h-3 w-3 rounded-[2px] border border-[#e1e4e8] bg-[#40c463]" />
                <span className="text-[11px]">Đã nộp</span>
            </div>
        </div>
    );
};
