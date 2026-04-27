import React, { useEffect, useState } from 'react';

// Định nghĩa kiểu dữ liệu truyền vào từ Component cha
interface SettingsProps {
    vscode: any;
    user: any;
    baseDirectory?: string; // Nhận thêm thư mục gốc từ state của cha nếu có
}

const Settings: React.FC<SettingsProps> = ({ vscode, user }) => {
    const [baseDirectory, setBaseDirectory] = useState<string>('');
    console.log('--- Dữ liệu User trong Settings ---', user);

    useEffect(() => {
        vscode.postMessage({ type: 'loadSetting', userId: user.userId });
        console.log('Gửi yêu cầu loadSetting với ID:', user.id || user.userId);
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('--- Settings nhận được tin nhắn từ Extension ---', message);
            switch (message.type) {
                case 'settingLoaded':
                    if (message.baseDirectory) {
                        setBaseDirectory(message.baseDirectory);
                    }
                    break;
            }

        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        }
    }, [vscode]);


    return (
        <main className="flex-1 flex flex-col px-6 pt-12 pb-24 gap-12 overflow-y-auto bg-white">
            {/* Profile Header - Phẳng hoàn toàn */}
            <section className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                    <div className="w-32 h-32 rounded-full">
                        <img
                            alt="User Avatar"
                            className="w-full h-full rounded-full object-cover"
                            src={user?.profilePicture || `https://ui-avatars.com/api/?name=${user?.name || 'S'}&background=random`}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-[#111318]">
                        {user?.name || 'Người dùng'}
                    </h2>
                    <p className="text-base text-gray-500 font-medium">
                        {user?.email || 'user@hust.edu.vn'}
                    </p>
                    <div className="pt-2">
                        <div className="inline-flex items-center gap-1.5 bg-[#135bec] text-white px-4 py-1.5 rounded-full">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                {user?.role === 'TEACHER' ? 'Giảng viên' : 'Sinh viên'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Storage Directory Section - Tiêu đề căn trái, Ô nội dung đổ bóng */}
            <section className="space-y-4">
                {/* Tiêu đề căn trái, font mặc định, không viết hoa toàn bộ */}
                <h3 className="text-sm font-bold text-[#111318] px-1">
                    Thư mục lưu trữ
                </h3>

                <div className="space-y-4">
                    {/* DUY NHẤT KHỐI NÀY ĐỔ BÓNG */}
                    <div className="bg-white shadow-[0_8px_30px_rgba(17,19,24,0.12)] rounded-2xl px-5 py-4 flex items-center border border-gray-50">
                        <p className="text-sm text-gray-800 break-all font-medium">
                            {baseDirectory || 'Đang tải cấu hình...'}
                        </p>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed italic text-center px-1">
                        Toàn bộ mã nguồn bài tập và dữ liệu cục bộ đang được lưu trữ an toàn tại thư mục này.
                    </p>
                </div>
            </section>
        </main>
    );
}
export default Settings;