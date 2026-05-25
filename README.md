# Hướng Dẫn Cài Đặt Frontend


## 1. Clone Repository Frontend

Chọn một thư mục làm việc:

```powershell
git clone https://github.com/chien04/Auto-Git.git
```

## 2. Yêu Cầu Môi Trường

Cài đặt trước:

| Thành phần | Phiên bản khuyến nghị | Mục đích |
|---|---:|---|
| Node.js | 18 trở lên | Build extension và React Webview |
| npm | 9 trở lên | Cài thư viện frontend |
| Git | Bản mới nhất | Clone repo và thao tác Git |
| VS Code | Bản mới nhất | Chạy Extension Development Host |

Kiểm tra:

```powershell
node -v
npm -v
git -v
code --version
```

## 3. Cài Dependency

Trong repo frontend:

```powershell
cd Auto-Git
npm install
```

## 4. Cấu Hình Kết Nối Backend

Frontend mặc định gọi backend local:

```text
REST API: http://localhost:8080/api
WebSocket: http://localhost:8080/ws-notifications
```

Các file đang cấu hình URL backend:

```text
src/extension.ts
src/services/apiService.ts
src/webview/services/websocketService.ts
```

Nếu backend chạy ở host hoặc port khác, cập nhật các URL trong các file trên.

## 5. Build Extension Host

Biên dịch TypeScript của VS Code extension:

```powershell
cd Auto-Git
npm run compile
```

Output được tạo trong thư mục:

```text
out/
```

## 6. Build React Webview

Bundle giao diện React Webview:

```powershell
cd Auto-Git
npm run build:webview
```

Output chính:

```text
out/webview/webview.js
```

## 7. Chạy Frontend Trong VS Code

Mở repo frontend bằng VS Code:

```powershell
code Auto-Git
```

Trong VS Code:

1. Nhấn `F5`.
2. Chọn cấu hình `Run Extension`.
3. VS Code mở cửa sổ `Extension Development Host`.
4. Trong cửa sổ mới, mở Activity Bar.
5. Chọn `Auto Git Classroom`.

Cấu hình debug nằm ở:

```text
.vscode/launch.json
```

## 8. Chạy Watch Mode Khi Phát Triển

Mở hai terminal.

Terminal 1, watch Extension Host:

```powershell
cd Auto-Git
npm run watch
```

Terminal 2, watch React Webview:

```powershell
cd Auto-Git
npm run watch:webview
```

Sau khi sửa code, reload cửa sổ Extension Development Host:

```text
Ctrl + R
```

## 9. Thứ Tự Chạy Frontend Với Backend

Frontend cần backend đang chạy trước để đăng nhập, tạo lớp, tạo bài tập, chat, notification, run code và submit code.

Thứ tự khuyến nghị:

1. Chạy backend ở `http://localhost:8080`.
2. Build frontend:

```powershell
cd Auto-Git
npm run compile
npm run build:webview
```

3. Mở repo frontend bằng VS Code:

```powershell
code Auto-Git
```

4. Nhấn `F5`.
5. Sử dụng extension trong cửa sổ `Extension Development Host`.

