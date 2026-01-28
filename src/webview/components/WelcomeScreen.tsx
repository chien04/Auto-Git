import React from 'react';

interface WelcomeScreenProps {
  onSelectRole: (role: 'student' | 'teacher') => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectRole }) => {
  return (
    <div className="flex flex-col min-h-screen max-w-[420px] mx-auto px-6 py-8 bg-white">
      {/* Header */}
      <header className="flex flex-col items-center text-center gap-6 mt-4 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 text-[#135bec]">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#111318]">AutoGit</h2>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111318]">
          Welcome to AutoGit
        </h1>
        <p className="text-sm text-[#616f89] font-medium">
          Select your role to get started
        </p>
      </header>

      {/* Main Content */}
      <main className="flex flex-col gap-4 w-full">
        {/* Student Card */}
        <button
          onClick={() => onSelectRole('student')}
          className="flex items-center gap-4 w-full p-5 rounded-lg border border-[#dbdfe6] bg-white text-left group transition-all hover:border-[#135bec] hover:bg-gray-50 active:scale-[0.98]"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#135bec]/10 text-[#135bec] shrink-0 transition-colors group-hover:bg-[#135bec]/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <h3 className="text-base font-bold text-[#111318]">Student</h3>
            <p className="text-sm text-[#616f89] leading-normal">
              Join classrooms and solve coding challenges
            </p>
          </div>
          <svg className="w-5 h-5 text-[#616f89] group-hover:text-[#135bec] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Teacher Card */}
        <button
          onClick={() => onSelectRole('teacher')}
          className="flex items-center gap-4 w-full p-5 rounded-lg border border-[#dbdfe6] bg-white text-left group transition-all hover:border-[#135bec] hover:bg-gray-50 active:scale-[0.98]"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#135bec]/10 text-[#135bec] shrink-0 transition-colors group-hover:bg-[#135bec]/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <h3 className="text-base font-bold text-[#111318]">Teacher</h3>
            <p className="text-sm text-[#616f89] leading-normal">
              Manage students and interactive curriculum
            </p>
          </div>
          <svg className="w-5 h-5 text-[#616f89] group-hover:text-[#135bec] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </main>

      {/* Footer */}
      <footer className="mt-auto pt-8 w-full">
        <p className="text-center text-xs leading-relaxed text-[#616f89]">
          By continuing, you agree to our{' '}
          <a className="font-medium text-[#135bec] hover:underline cursor-pointer">Terms of Service</a>
          {' '}and{' '}
          <a className="font-medium text-[#135bec] hover:underline cursor-pointer">Privacy Policy</a>
        </p>
        <div className="mt-4 text-center text-[10px] text-[#616f89]">
          © 2026 AutoGit Inc.
        </div>
      </footer>
    </div>
  );
};

export default WelcomeScreen;