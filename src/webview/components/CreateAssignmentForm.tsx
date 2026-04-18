import React, { useState } from 'react';
import 'katex/dist/katex.min.css';

const ReactMarkdown = require('react-markdown').default;
const remarkGfm = require('remark-gfm').default;
const remarkMath = require('remark-math').default;
const rehypeKatex = require('rehype-katex').default;

interface CreateAssignmentFormProps {
  vscode: any;
  user?: any;
  classCode: string;
  onClose: () => void;
}

const DESCRIPTION_TEMPLATE = `
### Mô tả bài toán
Cho ...

### Định dạng đầu vào (Input)
- Dòng đầu tiên chứa số nguyên $T$ - số lượng bộ test.
- Mỗi bộ test gồm...

### Định dạng đầu ra (Output)
- Với mỗi bộ test, in ra... trên một dòng.

### Giới hạn (Constraints)
- $1 \\le T \\le 100$
- $1 \\le N \\le 10^5$
- Thời gian chạy: 1.0s
- Bộ nhớ: 256MB

---

### Ví dụ (Example)

**Input:** \`5\`  
**Output:** \`120\`

**Giải thích:** Vì $5! = 1 \\times 2 \\times 3 \\times 4 \\times 5 = 120$.

---
### Gợi ý / Note (nếu có)
- Chú ý xử lý số nguyên lớn.`;

const CreateAssignmentForm: React.FC<CreateAssignmentFormProps> = ({ vscode, user, classCode, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(DESCRIPTION_TEMPLATE);
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const [descriptionMode, setDescriptionMode] = useState<'write' | 'preview'>('write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testCasesFile, setTestCasesFile] = useState<{
    name: string;
    size: number;
    base64: string;
  } | null>(null);
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      console.log('[DEBUG] Received message:', msg);

      if (msg.command === 'createAssignmentSuccess') {
        const assignmentCode = msg.data.assignmentCode;
        console.log('[DEBUG] Assignment created:', assignmentCode);

        if (testCasesFile) {
          vscode.postMessage({
            type: 'uploadTestCasesZip',
            assignmentCode,
            fileName: testCasesFile.name,
            fileContent: testCasesFile.base64
          });
          setMessage('⏳ Bài tập đã tạo, đang upload test cases...');
          return;
        }

        vscode.postMessage({
          type: 'skipTestCases',
          assignmentCode
        });
        setMessage(`✅ Bài tập đã được tạo! Mã: ${assignmentCode}`);
        setIsSubmitting(false);
        setTimeout(() => {
          vscode.postMessage({ type: 'assignmentCreated', classCode });
          onClose();
        }, 700);
      } else if (msg.command === 'createAssignmentError') {
        console.log('[DEBUG] Create assignment error:', msg.error);
        setMessage(`❌ Lỗi: ${msg.error}`);
        setIsSubmitting(false);
      } else if (msg.command === 'uploadTestCasesSuccess') {
        console.log('[DEBUG] Upload test cases success');
        setMessage('✅ Test cases đã được upload thành công!');
        setIsSubmitting(false);
        setTimeout(() => {
          vscode.postMessage({ type: 'assignmentCreated', classCode });
          onClose();
        }, 1000);
      } else if (msg.command === 'uploadTestCasesError') {
        console.log('[DEBUG] Upload test cases error:', msg.error);
        setMessage(`❌ Lỗi upload test cases: ${msg.error}`);
        setIsSubmitting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, classCode, onClose, testCasesFile]);

  React.useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = `${Math.max(220, descriptionRef.current.scrollHeight)}px`;
    }
  }, []);

  const handleCreateAssignment = () => {
    if (!title) {
      setMessage('Vui lòng nhập tên bài tập');
      return;
    }

    setIsSubmitting(true);
    vscode.postMessage({
      type: 'createAssignment',
      classCode,
      title,
      description,
      deadline: deadline || null
    });
    setMessage(testCasesFile ? 'Đang tạo bài tập và chuẩn bị upload test cases...' : 'Đang tạo bài tập...');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setMessage('❌ Chỉ chấp nhận file .zip');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));

        setTestCasesFile({
          name: file.name,
          size: file.size,
          base64
        });
      };

      reader.onerror = () => {
        setMessage('❌ Lỗi đọc file');
      };

      reader.readAsArrayBuffer(file);
    } else {
      setTestCasesFile(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateAssignment();
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(220, e.target.scrollHeight)}px`;
  };

  const markdownPreviewComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-[#111318]">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-2 mt-5 text-xl font-bold text-[#111318]">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-2 mt-4 text-lg font-bold text-[#111318]">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-3 leading-7 text-[#424656]">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-3 ml-5 list-disc space-y-1 text-[#424656]">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-3 ml-5 list-decimal space-y-1 text-[#424656]">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-[#111318]">{children}</strong>
    ),
    code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => {
      if (inline) {
        return (
          <code className="rounded bg-[#ecedfa] px-1.5 py-0.5 font-mono text-[0.9em] text-[#135bec]">
            {children}
          </code>
        );
      }

      return (
        <pre className="mb-3 overflow-x-auto rounded-lg bg-[#191b24] p-4 text-sm text-white">
          <code>{children}</code>
        </pre>
      );
    }
  };

  return (
    <div className="bg-white w-full">
      <div className="flex flex-col min-h-screen w-full">
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

        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-black tracking-tight text-[#111318]">Tạo bài tập mới</h1>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="bg-white rounded-xl border border-[#dbdfe6] p-4">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89] mb-2">
              Tên bài tập
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 text-base bg-white border border-[#dbdfe6] rounded-lg text-black focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all placeholder:text-[#9ca3af]"
              placeholder="Ví dụ: Bài tập tuần 1 - OOP"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl border border-[#dbdfe6] overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89] mb-3">
                Mô tả
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex p-1 bg-[#f3f4f6] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDescriptionMode('write')}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                      descriptionMode === 'write' ? 'bg-white text-[#135bec] shadow-sm' : 'text-[#616f89] hover:text-[#111318]'
                    }`}
                  >
                    Soạn thảo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescriptionMode('preview')}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                      descriptionMode === 'preview' ? 'bg-white text-[#135bec] shadow-sm' : 'text-[#616f89] hover:text-[#111318]'
                    }`}
                  >
                    Xem trước
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {descriptionMode === 'write' ? (
                <textarea
                  ref={descriptionRef}
                  className="w-full min-h-[220px] px-4 py-3 text-sm bg-[#fafafa] border border-[#dbdfe6] rounded-lg text-black focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all placeholder:text-[#9ca3af] resize-none overflow-hidden font-mono"
                  placeholder="Nhập mô tả bài tập bằng Markdown tại đây..."
                  value={description}
                  onChange={handleDescriptionChange}
                />
              ) : (
                <div className="min-h-[220px] px-4 py-3 bg-[#fafafa] border border-[#dbdfe6] rounded-lg text-sm leading-relaxed text-[#424656] overflow-x-auto markdown-preview">
                  {description.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownPreviewComponents}>
                      {description}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-[#9ca3af]">
                      Chưa có nội dung mô tả. Hãy nhập Markdown ở chế độ Soạn thảo.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#dbdfe6] p-4">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89] mb-2">
              Deadline
            </label>
            <input
              type="datetime-local"
              className="w-full px-4 py-3 text-base bg-white border border-[#dbdfe6] rounded-lg focus:border-[#135bec] focus:ring-0 focus:outline-none transition-all text-[#111318]"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl border border-[#dbdfe6] p-4">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89] mb-2">
              File test cases (.zip)
            </label>
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
                className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed border-[#dbdfe6] rounded-lg cursor-pointer bg-[#fafafa] hover:bg-[#f3f4f6] transition-colors"
              >
                <svg className="w-10 h-10 text-[#616f89] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-xs text-[#9ca3af] mt-1">Tùy chọn, có thể để trống</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {message && (
            <div className="p-4 rounded-lg bg-[#135bec]/10 border border-[#135bec]/20">
              <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-transparent text-[#616f89] font-semibold rounded-lg border border-[#dbdfe6] hover:bg-gray-50 transition-colors text-sm disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#135bec] text-white font-bold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isSubmitting ? 'Đang xử lý...' : 'Tạo bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignmentForm;
