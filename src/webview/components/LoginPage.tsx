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
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <button onClick={onBack} style={styles.backButton}>
          ← Quay lại
        </button>

        <div style={styles.header}>
          <h1 style={styles.title}>Đăng nhập</h1>
          <p style={styles.subtitle}>Đăng nhập với tư cách <strong>{roleText}</strong></p>
        </div>

        {/* Email + OTP Login */}
        <div style={styles.section}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            placeholder="Nhập địa chỉ email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            disabled={isOtpSent}
          />

          {!isOtpSent ? (
            <button 
              onClick={handleRequestOtp} 
              style={styles.button}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Gửi mã OTP
            </button>
          ) : (
            <>
              <label style={styles.label}>Mã OTP</label>
              <input
                type="text"
                placeholder="Nhập mã OTP từ email"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={styles.input}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleVerifyOtp();
                }}
              />
              <button 
                onClick={handleVerifyOtp} 
                style={styles.button}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Xác nhận
              </button>
              <button 
                onClick={() => {
                  setIsOtpSent(false);
                  setOtp('');
                  setMessage('');
                }}
                style={styles.resetButton}
              >
                Gửi lại mã
              </button>
            </>
          )}
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerText}>HOẶC</span>
        </div>

        {/* Google Login */}
        <div style={styles.section}>
          <button 
            onClick={handleGoogleLogin} 
            style={styles.googleButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f8f8';
              e.currentTarget.style.borderColor = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#dbdbdb';
            }}
          >
            <svg style={styles.googleIcon} viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Đăng nhập với Google
          </button>
        </div>

        {message && (
          <div style={styles.message}>{message}</div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '20px',
  },
  loginBox: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e5e5e5',
    width: '100%',
    maxWidth: '420px',
    position: 'relative' as const,
  },
  backButton: {
    position: 'absolute' as const,
    top: '20px',
    left: '20px',
    background: 'none',
    border: 'none',
    color: '#8e8e8e',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
    padding: '8px',
    outline: 'none',
    transition: 'color 0.2s',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
    marginTop: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#000',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8e8e8e',
    fontWeight: '400',
  },
  section: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#262626',
    letterSpacing: '0.2px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    marginBottom: '12px',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#fafafa',
    color: '#262626',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  button: {
    width: '100%',
    padding: '14px 20px',
    backgroundColor: '#000',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  resetButton: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    color: '#262626',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  divider: {
    textAlign: 'center' as const,
    margin: '28px 0',
    position: 'relative' as const,
    '::before': {
      content: '""',
      position: 'absolute' as const,
      top: '50%',
      left: 0,
      right: 0,
      height: '1px',
      backgroundColor: '#dbdbdb',
    },
  },
  dividerText: {
    backgroundColor: '#ffffff',
    padding: '0 16px',
    color: '#8e8e8e',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    position: 'relative' as const,
  },
  googleButton: {
    width: '100%',
    padding: '14px 20px',
    backgroundColor: '#ffffff',
    color: '#262626',
    border: '1px solid #dbdbdb',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  googleIcon: {
    width: '20px',
    height: '20px',
    marginRight: '12px',
  },
  message: {
    marginTop: '20px',
    padding: '14px 16px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '12px',
    fontSize: '13px',
    textAlign: 'center' as const,
    color: '#262626',
    fontWeight: '500',
  },
};

export default LoginPage;
