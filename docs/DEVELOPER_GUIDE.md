# Hướng Dẫn Phát Triển & Đóng Gói Dự Án (Developer Guide)

Tài liệu này cung cấp hướng dẫn đầy đủ dành cho các nhà phát triển muốn đóng góp, duy trì hoặc đóng gói ứng dụng **LetCuteMC Launcher**.

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính phát triển của bạn đã cài đặt các công cụ sau:

- **Node.js**: Phiên bản LTS (Khuyến nghị **v20.x** hoặc mới hơn).
- **Package Manager**: `npm` (đi kèm Node.js).
- **Hệ điều hành**: Windows 10/11 (được khuyến nghị chính cho xây dựng bộ cài `.exe`).
- **Java Runtime**: Nên có ít nhất một phiên bản Java (Java 8, 17 hoặc 21) cài trên máy để phục vụ thử nghiệm game.

---

## 2. Thiết Lập Môi Trường Phát Triển (Setup Project)

### Bước 1: Clone kho mã nguồn
```bash
git clone https://github.com/LetCuteMC/LetCuteMC-Launcher.git
cd LetCuteMC
```

### Bước 2: Cài đặt các thư viện phụ thuộc (Dependencies)
```bash
npm install
```

### Bước 3: Chạy ứng dụng ở chế độ Phát triển (Development Mode)
```bash
npm run dev
```
Lệnh này sẽ tự động:
1. Biên dịch tiến trình Main Process bằng `tsc`.
2. Khởi chạy Vite Dev Server cho Renderer UI tại địa chỉ `http://127.0.0.1:5173`.
3. Tự động bật cửa sổ ứng dụng Electron kết nối với Vite Server.

---

## 3. Các Lệnh Script Trong Dự Án (NPM Scripts)

Bảng tổng hợp tất cả các lệnh thao tác trong `package.json`:

| Lệnh Script | Mô tả chức năng |
| :--- | :--- |
| `npm run dev` | Khởi chạy môi trường phát triển với tính năng Hot Reload cho cả UI và Main Process. |
| `npm run dev:main` | Chạy theo dõi (watch mode) biên dịch lại Main Process khi sửa file TypeScript trong `src/main/`. |
| `npm run build:renderer` | Biên dịch trang giao diện React thành các tệp tĩnh bằng Vite (`dist/`). |
| `npm run build:main` | Biên dịch Main Process và sao chép logo biểu tượng vào `dist-electron/main/`. |
| `npm run verify:main` | Chạy script kiểm tra đầu ra biên dịch của Main Process (`scripts/verify-electron-build.mjs`). |
| `npm run build` | Biên dịch toàn bộ dự án hoàn chỉnh (Renderer + Main + Verify). |
| `npm run test:java` | Chạy kiểm tra bộ quét Java Scanner trên máy tính (`scripts/test-java-scanner.mjs`). |
| `npm run dist` | Đóng gói ứng dụng thành installer NSIS `.exe` cho Windows. |
| `npm run dist:portable` | Đóng gói riêng bản Portable duy nhất cho Windows. |
| `npm run clean` | Xóa các thư mục build tạm (`dist`, `dist-electron`, `release`). |

---

## 4. Cấu Trúc Thư Mục Mã Nguồn (Directory Layout)

```
LetCuteMC/
├── .github/                   # Cấu hình GitHub Actions / Workflows
├── docs/                      # Bộ tài liệu kỹ thuật của dự án
│   ├── ARCHITECTURE.md        # Kiến trúc hệ thống & đa tiến trình
│   ├── SERVICES.md            # Phân tích chi tiết Services & Workers
│   ├── IPC_API.md             # Danh mục API IPC Reference
│   ├── FEATURES_SPEC.md       # Đặc tả các tính năng kỹ thuật cốt lõi
│   └── DEVELOPER_GUIDE.md     # Hướng dẫn dành cho lập trình viên (File này)
├── public/                    # Tài nguyên tĩnh (Logo, favicon, icons)
├── scripts/                   # Các kịch bản kiểm tra & build hỗ trợ
│   ├── test-java-scanner.mjs  # Kịch bản kiểm thử quét Java
│   └── verify-electron-build.mjs # Kịch bản kiểm tra file build Electron
├── src/
│   ├── main/                  # Tiến trình Electron Main Process
│   │   ├── services/         # 44 Backend Services xử lý logic (chia 6 domains)
│   │   ├── workers/           # 2 Worker Threads (prepareWorker, launchWorker)
│   │   ├── ipc/              # Đăng ký các kênh IPC phân theo domain
│   │   ├── utils/            # Tiện ích platform và môi trường thực thi
│   │   ├── main.ts           # Khởi tạo BrowserWindow & App Lifecycle
│   │   └── preload.ts        # Preload script bảo mật expose window.launcherApi
│   ├── renderer/              # Tiến trình Giao diện Renderer (React 19)
│   │   ├── screens/           # Các màn hình chính (Profiles, Accounts, Mods, Settings...)
│   │   ├── components/        # Các React Components giao diện dùng chung
│   │   ├── hooks/             # Custom React Hooks
│   │   ├── services/          # Service wrappers trên UI
│   │   ├── App.tsx            # Component gốc quản lý Navigation & State
│   │   └── index.css          # Styling gốc với TailwindCSS
│   └── shared/                # Định nghĩa Typescript dùng chung (types.ts)
├── package.json               # Khai báo dependencies & scripts
├── electron-builder.json      # (Hoặc phần build trong package.json) Cấu hình đóng gói
├── tsconfig.json              # Cấu hình TypeScript Renderer
├── tsconfig.main.json         # Cấu hình TypeScript Main Process
└── vite.config.ts             # Cấu hình Vite bundler
```

---

## 5. Quy Trình Đóng Gói Thành Phẩm (Production Release Packaging)

Dự án sử dụng **`electron-builder`** để tạo installer NSIS cài theo user trên Windows. Cấu hình one-click không hiển thị wizard; gỡ cài đặt giữ lại dữ liệu ứng dụng của user.

### Các bước đóng gói:
1. Đảm bảo ứng dụng biên dịch thành công mà không có lỗi:
   ```bash
   npm run build
   ```
2. Thực hiện đóng gói bộ cài:
   ```bash
   npm run dist
   ```
3. Kết quả đầu ra sẽ nằm trong thư mục `release/`:
   - `LetCuteMC-<version>-windows-x64.exe`: Installer NSIS.
   - Chạy `npm run dist:portable` riêng để tạo bản Portable không cần cài đặt.

---

## 6. Quy Định Viết Mã (Coding Conventions)

- **TypeScript Strict Mode**: Luôn khai báo kiểu dữ liệu rõ ràng trong `src/shared/types.ts`. Không sử dụng kiểu `any` trừ trường hợp bắt buộc.
- **Xử lý Lỗi trong IPC**: Tất cả các handler IPC trong `src/main/ipc/` được đăng ký thông qua `handleIpc` (từ `ipcHelper.ts`) tự động bọc trong `try...catch` và chuẩn hóa thông điệp lỗi gửi về Renderer.
- **Tối ưu UI Render**: Đối với các sự kiện phát liên tục từ backend (như thông báo dòng log hoặc % tải dữ liệu), luôn sử dụng cơ chế batching (`launcher:event-batch`) để tránh làm React re-render quá mức.
