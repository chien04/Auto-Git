import React, { useState } from 'react';

interface CreateAssignmentFormProps {
  vscode: any;
  user?: any;
  classCode: string;
  onClose: () => void;
}

const CreateAssignmentForm: React.FC<CreateAssignmentFormProps> = ({ vscode, user, classCode, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  
  // Test cases state
  const [testCasesFile, setTestCasesFile] = useState<{
    name: string;
    size: number;
    base64: string;
  } | null>(null);
  const [showTestCasesSection, setShowTestCasesSection] = useState(false);
  const [createdAssignmentCode, setCreatedAssignmentCode] = useState<string | null>(null);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      console.log('[DEBUG] Received message:', msg);
      
      if (msg.command === 'createAssignmentSuccess') {
        const assignmentCode = msg.data.assignmentCode;
        console.log('[DEBUG] Assignment created:', assignmentCode);
        setCreatedAssignmentCode(assignmentCode);
        setMessage(`✅ Bài tập đã được tạo! Mã: ${assignmentCode}`);
        setShowTestCasesSection(true);
      } else if (msg.command === 'createAssignmentError') {
        console.log('[DEBUG] Create assignment error:', msg.error);
        setMessage(`❌ Lỗi: ${msg.error}`);
      } else if (msg.command === 'uploadTestCasesSuccess') {
        console.log('[DEBUG] Upload test cases success');
        setMessage(`✅ Test cases đã được upload thành công!`);
        // Extension will auto-open folder after upload
        setTimeout(() => {
          vscode.postMessage({ type: 'assignmentCreated', classCode });
          onClose();
        }, 1000);
      } else if (msg.command === 'uploadTestCasesError') {
        console.log('[DEBUG] Upload test cases error:', msg.error);
        setMessage(`❌ Lỗi upload test cases: ${msg.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, classCode, onClose]);

  const handleCreateAssignment = () => {
    if (!title) {
      setMessage('Vui lòng nhập tên bài tập');
      return;
    }
    vscode.postMessage({ 
      type: 'createAssignment', 
      classCode,
      title, 
      description,
      deadline: deadline || null 
    });
    setMessage('Đang tạo bài tập...');
  };

  const handleUploadTestCases = async () => {
    console.log('[DEBUG] handleUploadTestCases called');
    console.log('[DEBUG] createdAssignmentCode:', createdAssignmentCode);
    console.log('[DEBUG] testCasesFile:', testCasesFile?.name);
    
    if (!createdAssignmentCode) {
      console.log('[DEBUG] No assignment code!');
      setMessage('❌ Chưa có mã bài tập');
      return;
    }

    if (!testCasesFile) {
      console.log('[DEBUG] No test cases file!');
      setMessage('❌ Vui lòng chọn file ZIP test cases');
      return;
    }

    try {
      console.log('[DEBUG] Sending uploadTestCases message with base64 length:', testCasesFile.base64.length);
      vscode.postMessage({ 
        type: 'uploadTestCasesZip', 
        assignmentCode: createdAssignmentCode,
        fileName: testCasesFile.name,
        fileContent: testCasesFile.base64
      });
      setMessage('⏳ Đang upload test cases...');
    } catch (error: any) {
      console.error('[DEBUG] Error:', error);
      setMessage(`❌ Lỗi upload: ${error.message}`);
    }
  };

  const handleSkipTestCases = () => {
    if (!createdAssignmentCode) {
      return;
    }
    
    // Send skip message to extension to open folder
    vscode.postMessage({ 
      type: 'skipTestCases', 
      assignmentCode: createdAssignmentCode
    });
    
    // Close form after sending message
    setTimeout(() => {
      vscode.postMessage({ type: 'assignmentCreated', classCode });
      onClose();
    }, 500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setMessage('❌ Chỉ chấp nhận file .zip');
        return;
      }
      
      // Read file and convert to base64 immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = btoa(
          bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        setTestCasesFile({
          name: file.name,
          size: file.size,
          base64: base64
        });
        setMessage('✓ File đã sẵn sàng upload');
      };
      
      reader.onerror = () => {
        setMessage('❌ Lỗi đọc file');
      };
      
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateAssignment();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-white">
      <div className="flex flex-col h-full max-w-[420px] w-full mx-auto">
        {/* Header matching TeacherDashboard */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-[#dbdfe6]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#135bec] flex items-center justify-center rounded">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 48 48">
                <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-[#111318]">AutoGit</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#111318]">{user?.name || 'Giáo viên'}</span>
            <div className="w-px h-4 bg-[#dbdfe6]"></div>
            <button 
              onClick={() => vscode.postMessage({ type: 'logout' })}
              className="flex items-center justify-center p-1.5 rounded-full text-[#616f89] hover:text-red-600 hover:bg-gray-100 transition-colors" 
              title="Đăng xuất"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Title Section */}
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-black tracking-tight text-[#111318]">
            Tạo bài tập mới
          </h1>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="flex-1 px-4 space-y-4 overflow-y-auto">
          {/* Show normal form OR test cases section */}
          {!showTestCasesSection ? (
            <>
              {/* Assignment Name */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
                  Tên bài tập
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 text-base bg-white border-2 border-[#dbdfe6] rounded-lg text-black focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all placeholder:text-[#616f89]"
                  placeholder="Ví dụ: Bài tập tuần 1 - OOP"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
                  Mô tả
                </label>
                <textarea
                  className="w-full px-4 py-3 text-base bg-white border-2 border-[#dbdfe6] rounded-lg text-black focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all placeholder:text-[#616f89] resize-none"
                  placeholder="Mô tả chi tiết về bài tập..."
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
                  Deadline
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 text-base bg-white border-2 border-[#dbdfe6] rounded-lg focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all text-[#111318]"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              {/* Message Display */}
              {message && (
                <div className="p-4 rounded-lg bg-[#135bec]/10 border border-[#135bec]/20">
                  <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
                </div>
              )}

              {/* Visual Divider */}
              <div className="pt-4 border-t border-[#dbdfe6]"></div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pb-6">
                <button
                  type="submit"
                  className="w-full py-4 bg-[#135bec] text-white font-bold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tạo bài tập
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-transparent text-[#616f89] font-medium rounded-lg hover:text-red-500 transition-colors text-sm"
                >
                  Hủy
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Test Cases Section - Show after assignment created */}
              <div className="pt-6 border-t-2 border-[#135bec]/20"></div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold mb-1">Bước 2: Upload Test Cases (Tùy chọn)</p>
                    <p className="text-blue-700">Upload file ZIP chứa test cases hoặc bỏ qua và upload sau</p>
                  </div>
                </div>

                <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89]">
                  File Test Cases (.zip)
                </label>
                
                {/* File Upload Area */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                    id="testCasesFileInput"
                  />
                  <label
                    htmlFor="testCasesFileInput"
                    className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed border-[#dbdfe6] rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-12 h-12 text-[#616f89] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {testCasesFile ? (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#135bec]">{testCasesFile.name}</p>
                        <p className="text-xs text-[#616f89] mt-1">{(testCasesFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#616f89]">Click để chọn file ZIP</p>
                        <p className="text-xs text-[#9ca3af] mt-1">hoặc kéo thả file vào đây</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Structure Info */}
                <details className="text-xs text-[#616f89]">
                  <summary className="cursor-pointer font-semibold hover:text-[#135bec]">
                    📘 Cấu trúc thư mục trong file ZIP
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                    <pre className="text-xs font-mono text-[#111318]">{`testcases.zip
├── testcases/
│   ├── ex1/
│   │   ├── input1.txt
│   │   ├── output1.txt
│   │   ├── input2.txt
│   │   └── output2.txt
│   └── ex2/
│       ├── input1.txt
│       └── output1.txt`}</pre>
                    <p className="text-xs text-[#616f89] mt-2">
                      • Tên folder = tên bài tập (ex1, ex2, ...)<br/>
                      • Mỗi cặp input/output được đánh số thứ tự (1, 2, 3, ...)<br/>
                      • File input: input1.txt, input2.txt, ...<br/>
                      • File output: output1.txt, output2.txt, ...
                    </p>
                  </div>
                </details>

                {/* Message Display */}
                {message && (
                  <div className="p-4 rounded-lg bg-[#135bec]/10 border border-[#135bec]/20">
                    <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
                  </div>
                )}

                <div className="flex gap-2 pb-6">
                  <button
                    type="button"
                    onClick={handleUploadTestCases}
                    className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Test Cases
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipTestCases}
                    className="px-6 py-3 bg-gray-100 text-[#616f89] font-medium rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Bỏ qua
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateAssignmentForm;
