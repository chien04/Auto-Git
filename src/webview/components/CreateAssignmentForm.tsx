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

interface TaskFilePayload {
  name: string;
  size: number;
  base64: string;
}

interface SampleTestCase {
  ordinal: number;
  input: string;
  output: string;
  explain?: string;
}

interface TaskDraft {
  id: number;
  taskName: string;
  description: string;
  descriptionMode: 'write' | 'preview';
  testCasesFile: TaskFilePayload | null;
  sampleTestCases: SampleTestCase[];
}

// Bỏ phần Example mẫu đi để giáo viên tự add qua nút
const DESCRIPTION_TEMPLATE = `
## Tên bài toán 
### Mô tả bài toán
Cho ...

### Định dạng đầu vào (Input)
- Mỗi bộ test gồm...

### Định dạng đầu ra (Output)
- Với mỗi bộ test, in ra... trên một dòng.

### Giới hạn (Constraints)
- $1 \\le N \\le 10^5$
- Thời gian chạy: 1.0s
- Bộ nhớ: 256MB

---
### Gợi ý / Note (nếu có)
- Chú ý xử lý số nguyên lớn.

---
### Ví dụ (Example)
`;

const buildDefaultTask = (taskIndex: number): TaskDraft => ({
  id: taskIndex,
  taskName: `Task ${taskIndex}`,
  description: DESCRIPTION_TEMPLATE,
  descriptionMode: 'write',
  testCasesFile: null,
  sampleTestCases: []
});

const CreateAssignmentForm: React.FC<CreateAssignmentFormProps> = ({ vscode, user, classCode, onClose }) => {
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<TaskDraft[]>([buildDefaultTask(1)]);
  const [activeTaskId, setActiveTaskId] = useState(1);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);

  // --- STATE CHO MODAL THÊM TEST CASE ---
  const [isTcModalOpen, setIsTcModalOpen] = useState(false);
  const [tcInput, setTcInput] = useState('');
  const [tcOutput, setTcOutput] = useState('');
  const [tcExplain, setTcExplain] = useState('');

  const activeTask = tasks.find((task) => task.id === activeTaskId) || tasks[0];

  const updateTaskById = (taskId: number, updater: (task: TaskDraft) => TaskDraft) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
  };

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === 'createAssignmentSuccess') {
        const assignmentCode = msg.data.assignmentCode;
        const tasksWithFile = tasks
          .filter((task) => !!task.testCasesFile)
          .map((task) => ({
            taskName: task.taskName,
            fileName: task.testCasesFile!.name,
            fileContent: task.testCasesFile!.base64
          }));

        if (tasksWithFile.length > 0) {
          vscode.postMessage({
            type: 'uploadTaskTestCasesZip',
            assignmentCode,
            tasks: tasksWithFile
          });
          setMessage('Bài tập đã tạo, đang upload test cases theo từng task...');
          return;
        }

        vscode.postMessage({ type: 'skipTestCases', assignmentCode });
        setMessage(`Bài tập đã được tạo! Mã: ${assignmentCode}`);
        setIsSubmitting(false);
        setTimeout(() => {
          vscode.postMessage({ type: 'assignmentCreated', classCode });
          onClose();
        }, 700);
      } else if (msg.command === 'createAssignmentError') {
        setMessage(`Lỗi: ${msg.error}`);
        setIsSubmitting(false);
      } else if (msg.command === 'uploadTaskTestCasesSuccess' || msg.command === 'uploadTestCasesSuccess') {
        setMessage('Test cases theo task đã được upload thành công!');
        setIsSubmitting(false);
        setTimeout(() => {
          vscode.postMessage({ type: 'assignmentCreated', classCode });
          onClose();
        }, 1000);
      } else if (msg.command === 'uploadTaskTestCasesError' || msg.command === 'uploadTestCasesError') {
        setMessage(`Lỗi upload test cases: ${msg.error}`);
        setIsSubmitting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, classCode, onClose, tasks]);

  React.useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = `${Math.max(220, descriptionRef.current.scrollHeight)}px`;
    }
  }, [activeTask?.descriptionMode, activeTask?.id]);

  const toDeadlineValue = (): string | null => {
    if (!deadlineDate) return null;
    return `${deadlineDate}T${deadlineTime || '23:59'}`;
  };

  const addTask = () => {
    setTasks((prev) => {
      const nextTaskNumber = prev.length + 1;
      const nextId = prev.length === 0 ? 1 : Math.max(...prev.map((task) => task.id)) + 1;
      const nextTask: TaskDraft = {
        ...buildDefaultTask(nextTaskNumber),
        id: nextId,
        taskName: `Task ${nextTaskNumber}`
      };
      setActiveTaskId(nextId);
      return [...prev, nextTask];
    });
  };

  const removeTask = (taskId: number) => {
    if (tasks.length <= 1) {
      setMessage('Assignment cần ít nhất 1 task');
      return;
    }
    setTasks((prev) => {
      const filtered = prev.filter((task) => task.id !== taskId);
      if (filtered.length === 0) return prev;
      const normalized = filtered.map((task, index) => ({
        ...task,
        taskName: `Task ${index + 1}`
      }));
      if (activeTaskId === taskId) {
        setActiveTaskId(normalized[0].id);
      }
      return normalized;
    });
  };

  const handleCreateAssignment = () => {
    if (!title) { setMessage('Vui lòng nhập tên bài tập'); return; }
    if (tasks.length === 0) { setMessage('Vui lòng tạo ít nhất một task'); return; }
    const invalidTask = tasks.find((task) => !task.description.trim());
    if (invalidTask) { setMessage(`${invalidTask.taskName} chưa có mô tả`); return; }

    setIsSubmitting(true);

    vscode.postMessage({
      type: 'createAssignment',
      classCode,
      title,
      description: "",
      tasks: tasks.map((task, index) => {
        const nameMatch = task.description.match(/^##\s*(.+)/m);
        const extractedName = nameMatch ? nameMatch[1].trim() : task.taskName;

        return {
          orderNo: index + 1,
          taskName: extractedName,
          description: task.description,
          sampleTestCases: task.sampleTestCases
        };
      }),
      deadline: toDeadlineValue()
    });
    setMessage('Đang tạo bài tập nhiều task...');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!activeTask) return;

    if (file) {
      if (!file.name.endsWith('.zip')) {
        setMessage('Chỉ chấp nhận file .zip');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
        updateTaskById(activeTask.id, (task) => ({
          ...task,
          testCasesFile: { name: file.name, size: file.size, base64 }
        }));
      };
      reader.onerror = () => setMessage('Lỗi đọc file');
      reader.readAsArrayBuffer(file);
    } else {
      updateTaskById(activeTask.id, (task) => ({ ...task, testCasesFile: null }));
    }
  };

  const handleAddTestCaseToMarkdown = () => {
    if (!activeTask) return;

    const nextExampleNumber = activeTask.sampleTestCases.length + 1;

    const newSample: SampleTestCase = {
      ordinal: nextExampleNumber,
      input: tcInput.trim(),
      output: tcOutput.trim(),
      explain: tcExplain.trim()
    };

    const newTcMarkdown = `
**Ví dụ ${nextExampleNumber}:**

**Input:**
\`\`\`text
${newSample.input}
\`\`\`

**Output:**
\`\`\`text
${newSample.output}
\`\`\`

${newSample.explain ? `**Giải thích:** ${newSample.explain}\n\n` : ''}---
`;

    updateTaskById(activeTask.id, (task) => ({
      ...task,
      description: task.description.trim() + '\n' + newTcMarkdown,
      sampleTestCases: [...task.sampleTestCases, newSample]
    }));

    setIsTcModalOpen(false);
    setTcInput('');
    setTcOutput('');
    setTcExplain('');
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateAssignment();
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeTask) return;
    updateTaskById(activeTask.id, (task) => ({ ...task, description: e.target.value }));
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(220, e.target.scrollHeight)}px`;
  };

  const markdownPreviewComponents = {
    h1: ({ children }: any) => <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-[#111318]">{children}</h1>,
    h2: ({ children }: any) => <h2 className="mb-2 mt-5 text-xl font-bold text-[#111318]">{children}</h2>,
    h3: ({ children }: any) => <h3 className="mb-2 mt-4 text-lg font-bold text-[#111318]">{children}</h3>,
    p: ({ children }: any) => <p className="mb-3 leading-7 text-[#424656]">{children}</p>,
    ul: ({ children }: any) => <ul className="mb-3 ml-5 list-disc space-y-1 text-[#424656]">{children}</ul>,
    ol: ({ children }: any) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-[#424656]">{children}</ol>,
    li: ({ children }: any) => <li className="leading-7">{children}</li>,
    strong: ({ children }: any) => <strong className="font-bold text-[#111318]">{children}</strong>,
    code: ({ inline, children }: any) => {
      if (inline) {
        return <code className="rounded bg-[#ecedfa] px-1.5 py-0.5 font-mono text-[0.9em] text-[#135bec]">{children}</code>;
      }
      return <pre className="mb-3 overflow-x-auto rounded-lg bg-[#191b24] p-4 text-sm text-white"><code>{children}</code></pre>;
    }
  };

  return (
    <div className="bg-[#f5f5f5] w-full relative">
      <div className="flex flex-col min-h-screen max-w-[420px] w-full mx-auto bg-white pb-36">
        {/* HEADER */}
        <header className="flex items-center justify-between px-4 py-4 shadow-[0_6px_18px_rgba(17,19,24,0.06)]">
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

        <form onSubmit={handleSubmit} className="px-4 pt-6 pb-6 space-y-4">
          {/* TÊN BÀI TẬP */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_8px_28px_rgba(17,19,24,0.08)]">
            <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89] mb-2">Tên bài tập</label>
            <input
              type="text"
              className="w-full px-4 py-3 text-base bg-[#f7f9fc] rounded-xl text-black focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none transition-all placeholder:text-[#9ca3af]"
              placeholder="Ví dụ: Bài tập tuần 1 - OOP"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* LIST TASKS */}
          <div className="flex flex-wrap gap-3 items-start">
            {tasks.map((task) => (
              <div key={task.id} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveTaskId(task.id)}
                  className={`pr-6 pl-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-tight whitespace-nowrap transition-colors ${task.id === activeTask?.id
                    ? 'bg-[#e8f0ff] text-[#135bec] shadow-[0_4px_12px_rgba(19,91,236,0.18)]'
                    : 'bg-[#f7f9fc] text-[#5a6478] shadow-[0_4px_10px_rgba(17,19,24,0.08)] hover:bg-[#f1f5fb]'
                    }`}
                >
                  {task.taskName}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                  className={`absolute top-1 right-1 w-4 h-4 text-[9px] rounded-full flex items-center justify-center transition-colors ${task.id === activeTask?.id
                    ? 'bg-white text-[#135bec] shadow-[0_2px_8px_rgba(19,91,236,0.22)]'
                    : 'bg-[#eef2f7] text-[#6b7280] shadow-[0_2px_8px_rgba(17,19,24,0.14)] hover:bg-[#e5edf7]'
                    }`}
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTask}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent text-[#135bec] hover:bg-[#eef4ff] transition-colors"
            >
              +
            </button>
          </div>

          {/* EDITOR SECTION */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(17,19,24,0.08)]">
            <div className="px-4 pt-4 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-1 bg-[#f3f4f6] rounded-lg">
                  <button
                    type="button"
                    onClick={() => updateTaskById(activeTask!.id, t => ({ ...t, descriptionMode: 'write' }))}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTask?.descriptionMode === 'write' ? 'bg-white text-[#135bec] shadow-sm' : 'text-[#616f89] hover:text-[#111318]'}`}
                  >
                    Soạn thảo
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTaskById(activeTask!.id, t => ({ ...t, descriptionMode: 'preview' }))}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTask?.descriptionMode === 'preview' ? 'bg-white text-[#135bec] shadow-sm' : 'text-[#616f89] hover:text-[#111318]'}`}
                  >
                    Xem trước
                  </button>
                </div>

                {activeTask?.descriptionMode === 'write' && (
                  <button
                    type="button"
                    onClick={() => setIsTcModalOpen(true)}
                    className="text-sm font-semibold text-[#135bec] hover:underline"
                  >
                    Testcase mẫu
                  </button>
                )}
              </div>
            </div>

            <div className="p-4">
              {activeTask?.descriptionMode === 'write' ? (
                <textarea
                  ref={descriptionRef}
                  className="w-full min-h-[220px] px-4 py-3 text-sm bg-[#f7f9fc] rounded-xl text-black focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none transition-all placeholder:text-[#9ca3af] resize-none overflow-hidden font-mono"
                  placeholder="Nhập mô tả bài tập bằng Markdown tại đây..."
                  value={activeTask?.description || ''}
                  onChange={handleDescriptionChange}
                />
              ) : (
                <div className="min-h-[220px] px-4 py-3 bg-[#f7f9fc] rounded-xl text-sm leading-relaxed text-[#424656] overflow-x-auto markdown-preview">
                  {(activeTask?.description || '').trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownPreviewComponents}>
                      {activeTask?.description || ''}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-[#9ca3af]">Chưa có nội dung mô tả. Hãy nhập Markdown ở chế độ Soạn thảo.</div>
                  )}
                </div>
              )}
            </div>

            {/* UPLOAD ZIP TEST CASES */}
            <div className="px-4 pb-4 pt-1">
              <label className="block text-sm font-bold uppercase tracking-wider text-[#616f89] mb-2">
                Test cases {activeTask?.taskName || 'task'} (Chấm điểm ẩn)
              </label>
              <div className="relative">
                <input type="file" accept=".zip" onChange={handleFileChange} className="hidden" id="testCasesFileInput" />
                <label
                  htmlFor="testCasesFileInput"
                  className="flex flex-col items-center justify-center w-full px-4 py-6 rounded-xl cursor-pointer bg-[#f7f9fc] hover:bg-[#edf3ff] transition-colors shadow-[inset_0_0_0_1px_rgba(173,187,209,0.45),0_6px_16px_rgba(17,19,24,0.08)]"
                >
                  <svg className="w-10 h-10 text-[#616f89] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {activeTask?.testCasesFile ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-[#135bec]">{activeTask.testCasesFile.name}</p>
                      <p className="text-xs text-[#616f89] mt-1">{(activeTask.testCasesFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-[#616f89]">Click để chọn file ZIP</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {message && (
            <div className="p-4 rounded-xl bg-[#135bec]/10 shadow-[0_8px_20px_rgba(19,91,236,0.15)]">
              <p className="text-sm text-[#111318] text-center font-medium">{message}</p>
            </div>
          )}
        </form>

        {/* BOTTOM FIXED BAR */}
        <div className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-white/95 backdrop-blur-sm p-4 flex flex-col gap-4 z-30 shadow-[0_-10px_28px_rgba(17,19,24,0.14)]">
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-tight font-bold text-[#616f89]">Deadline date</label>
              <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="w-full bg-[#f7f9fc] rounded-xl px-3 py-2 text-sm text-[#111318] focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none" />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-tight font-bold text-[#616f89]">Time (UTC)</label>
              <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-full bg-[#f7f9fc] rounded-xl px-3 py-2 text-sm text-[#111318] focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 py-3 bg-[#eef2f9] text-[#111318] text-sm font-bold uppercase tracking-tight rounded-xl hover:bg-[#e2e9f4] transition-colors disabled:opacity-60">Hủy</button>
            <button type="submit" onClick={handleCreateAssignment} disabled={isSubmitting} className="flex-[2] py-3 bg-[#135bec] text-white text-sm font-bold uppercase tracking-tight rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70">
              {isSubmitting ? 'Đang xử lý...' : 'Tạo assignment'}
            </button>
          </div>
        </div>

        {/* MODAL NHẬP TEST CASE MẪU */}
        {isTcModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-[#111318]">Thêm Test Case Mẫu</h3>
                <button onClick={() => setIsTcModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#616f89] mb-1">Dữ liệu đầu vào (Input)</label>
                  <textarea
                    className="w-full bg-[#f7f9fc] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 font-mono"
                    rows={3}
                    value={tcInput}
                    onChange={e => setTcInput(e.target.value)}
                    placeholder="VD: 5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#616f89] mb-1">Kết quả mong muốn (Output)</label>
                  <textarea
                    className="w-full bg-[#f7f9fc] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 font-mono"
                    rows={2}
                    value={tcOutput}
                    onChange={e => setTcOutput(e.target.value)}
                    placeholder="VD: 120"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#616f89] mb-1">Giải thích (Tùy chọn)</label>
                  <input
                    type="text"
                    className="w-full bg-[#f7f9fc] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/20"
                    value={tcExplain}
                    onChange={e => setTcExplain(e.target.value)}
                    placeholder="VD: Vì 5! = 120"
                  />
                </div>
              </div>
              <div className="px-5 py-4 bg-gray-50 flex gap-2 justify-end">
                <button onClick={() => setIsTcModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Hủy</button>
                <button onClick={handleAddTestCaseToMarkdown} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#135bec] hover:opacity-90 transition-opacity">Chèn vào Markdown</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CreateAssignmentForm;