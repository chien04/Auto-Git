import React, { useState } from 'react';

interface LoginPageProps {
  vscode: any;
  role: 'TEACHER' | 'STUDENT';
  onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ vscode, role, onBack }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [message, setMessage] = useState('');

  const handleRequestOtp = () => {
    if (!email) {
      setMessage('Vui lòng nhập email');
      return;
    }
    vscode.postMessage({ type: 'requestOtp', email });
    setIsOtpSent(true);
    setMessage('OTP đã được gửi đến email của bạn');
  };

  const handleVerifyOtp = () => {
    if (!otp) {
      setMessage('Vui lòng nhập mã OTP');
      return;
    }
    vscode.postMessage({ type: 'verifyOtp', email, otp, role });
  };

  const handleGoogleLogin = () => {
    vscode.postMessage({ type: 'googleLogin', role });
  };

  const roleText = role === 'TEACHER' ? 'Giáo viên' : 'Sinh viên';

  return (
    <div className="flex flex-col min-h-screen max-w-[420px] mx-auto px-6 py-8 bg-white">
      {/* Logo Section */}
      <div className="flex flex-col items-center gap-6 mt-4 mb-6 w-full">
        <button
          onClick={onBack}
          className="self-start text-[#616f89] hover:text-[#111318] transition-colors text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 text-[#135bec]">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#111318]">AutoGit</h2>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-center text-[#111318]">
          Đăng nhập với tư cách <span className="text-[#135bec]">{roleText}</span>
        </h1>
      </div>

      {/* Login Form Container */}
      <div className="w-full space-y-4 mt-8">
        {/* Email Input */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium leading-none text-[#111318]">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isOtpSent}
            className="flex w-full rounded-lg border border-[#dbdfe6] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#135bec]/20 transition-all placeholder:text-[#616f89] text-[#111318] disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>

        {!isOtpSent ? (
          <button
            onClick={handleRequestOtp}
            className="flex w-full items-center justify-center rounded-lg bg-[#135bec] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Gửi mã OTP
          </button>
        ) : (
          <>
            {/* OTP Input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-none text-[#111318]">Mã OTP</label>
              <input
                type="text"
                placeholder="Nhập mã OTP từ email"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleVerifyOtp();
                }}
                className="flex w-full rounded-lg border border-[#dbdfe6] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#135bec]/20 transition-all placeholder:text-[#616f89] text-[#111318]"
              />
            </div>

            <button
              onClick={handleVerifyOtp}
              className="flex w-full items-center justify-center rounded-lg bg-[#135bec] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              Xác nhận
            </button>

            <button
              onClick={() => {
                setIsOtpSent(false);
                setOtp('');
                setMessage('');
              }}
              className="flex w-full items-center justify-center rounded-lg border border-[#dbdfe6] bg-white py-2.5 text-sm font-medium text-[#111318] transition-colors hover:bg-gray-50 active:scale-[0.98]"
            >
              Gửi lại mã
            </button>
          </>
        )}

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#dbdfe6]"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#616f89] font-bold">HOẶC</span>
          </div>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#dbdfe6] bg-white py-3 text-sm font-medium text-[#111318] transition-colors hover:bg-gray-50 active:scale-[0.98]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Đăng nhập với Google
        </button>

        {/* Message */}
        {message && (
          <div className="mt-4 p-4 rounded-lg bg-[#135bec]/10 border border-[#135bec]/20">
            <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto w-full pt-8 pb-4">
        <p className="text-center text-xs leading-relaxed text-[#616f89]">
          Bằng việc tiếp tục, bạn đồng ý với{' '}
          <a className="font-medium text-[#135bec] hover:underline cursor-pointer">Điều khoản dịch vụ</a>
          {' '}và{' '}
          <a className="font-medium text-[#135bec] hover:underline cursor-pointer">Chính sách bảo mật</a> của chúng tôi.
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
