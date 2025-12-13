# Auto Git Classroom - VSCode Extension

Hệ thống quản lý lớp học tự động với tích hợp GitHub và auto-push.

## Tính năng

- 🔐 **Đăng nhập Google OAuth** - Xác thực an toàn qua Google
- 👨‍🏫 **Teacher Mode** - Tạo repository GitHub và class code tự động
- 👨‍🎓 **Student Mode** - Tham gia lớp học và clone repository
- 🚀 **Auto Push** - Tự động commit và push khi Ctrl+S
- 🌿 **Branch Management** - Mỗi sinh viên có branch riêng

## Cài đặt

### Yêu cầu

- Node.js 18+
- VSCode 1.106.1+
- Git

### Cài đặt Dependencies

```bash
cd auto-git
npm install
```

### Cấu hình Backend URL

Mở file `src/services/apiService.ts` và cập nhật URL backend nếu cần:

```typescript
constructor(baseURL: string = 'http://localhost:8080/api')
```

### Build Extension

```bash
npm run compile
```

### Chạy Extension trong Development Mode

1. Mở VSCode
2. Mở folder `auto-git`
3. Nhấn F5 để mở Extension Development Host
4. Extension sẽ được kích hoạt tự động

## Sử dụng

### Teacher

1. Mở sidebar "Auto Git Classroom"
2. Chọn role "Teacher"
3. Đăng nhập bằng Google
4. Nhập tên lớp học
5. Click "Tạo Repository + Class Code"
6. Copy class code và chia sẻ với sinh viên

### Student

1. Mở sidebar "Auto Git Classroom"
2. Chọn role "Student"
3. Đăng nhập bằng Google
4. Nhập tên và class code
5. Click "Tham gia lớp học"
6. Extension sẽ clone repository tự động
7. Mọi thay đổi khi save (Ctrl+S) sẽ được push lên GitHub

## Cấu trúc Project

```
auto-git/
├── src/
│   ├── extension.ts              # Entry point
│   ├── providers/
│   │   └── classroomViewProvider.ts  # WebView provider
│   ├── services/
│   │   ├── apiService.ts         # Backend API client
│   │   └── gitService.ts         # Git operations
│   └── webview/
│       └── index.html            # WebView UI
├── package.json
└── tsconfig.json
```

## Commands

- `Auto Git: Open Classroom` - Mở panel quản lý lớp học
- `Auto Git: Logout` - Đăng xuất và xóa dữ liệu

## Troubleshooting

### Auto-push không hoạt động

- Kiểm tra xem bạn đã tham gia lớp học chưa
- Đảm bảo file được lưu nằm trong workspace repository
- Kiểm tra console để xem log lỗi

### Clone repository thất bại

- Kiểm tra kết nối internet
- Đảm bảo Git đã được cài đặt
- Kiểm tra token GitHub hợp lệ

## Development

### Watch Mode

```bash
npm run watch
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

## License

MIT
