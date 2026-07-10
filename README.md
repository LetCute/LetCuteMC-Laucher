# LetCuteMC Launcher

**LetCuteMC Launcher** là một trình khởi chạy Minecraft hiện đại, hiệu năng cao và giàu tính thẩm mỹ. Dự án được phát triển dựa trên **Electron**, **React**, **TypeScript**, sử dụng hệ thống thư viện lõi **@xmcl** mạnh mẽ để quản lý việc tải và vận hành game.

---

## ✨ Tính Năng Nổi Bật

* **Quản lý Cấu hình (Profiles)**: Dễ dàng thêm, sửa, xoá cấu hình phiên bản Minecraft. Hỗ trợ tùy chỉnh thư mục game, phân bổ bộ nhớ (RAM), Java Runtime riêng biệt cho từng cấu hình.
* **Cơ chế xác thực tài khoản**:
  * Chế độ chơi Offline (Tài khoản ảo).
  * Đăng nhập Microsoft/Xbox chính thức.
* **Quản lý Tài nguyên tích hợp**:
  * Quản lý Mods, Resource Packs (Gói tài nguyên) và Shader Packs trực tiếp trên giao diện trực quan.
  * Bật/tắt nhanh hoặc xoá bỏ tài nguyên chỉ với 1 click.
* **Xác thực & Tải tệp tin game thông minh**:
  * Tự động quét, đối chiếu kích thước tệp tin trước khi vào game.
  * Hỗ trợ tải song song (lên đến 8 luồng đồng thời) các tệp tin asset, thư viện (libraries) và client jar từ Mojang.
  * Cơ chế tải qua tệp tạm `.part` và xác minh mã băm SHA-1 trước khi đổi tên chính thức để ngăn chặn tệp tin bị hỏng (corruption).
* **Tính năng Sửa lỗi (Repair)**: Cung cấp tuỳ chọn quét toàn diện mã băm SHA-1 của toàn bộ tệp tin game và tự động tải lại các tệp bị lỗi/thiếu.
* **Trình xem Nhật ký (Logs View)**: Hộp thoại dòng lệnh trực tiếp (console log) cho phép bôi đen, lựa chọn và sao chép văn bản log thuận tiện.
* **Giao diện không viền (Frameless Window)**: Hỗ trợ kéo thả di chuyển cửa sổ mượt mà từ cả thanh Sidebar bên trái lẫn thanh điều hướng bên phải.

---

## 🛠️ Công Nghệ Sử Dụng

* **Khung ứng dụng**: Electron 43 & Node.js
* **Giao diện**: React, Vite, TypeScript
* **Styling**: TailwindCSS & Vanilla CSS (với các hiệu ứng Blur, Glassmorphism, Dark mode cao cấp)
* **Minecraft Core**: `@xmcl/core`, `@xmcl/user`, `@xmcl/unzip`...

---

## 🚀 Hướng Dẫn Phát Triển & Đóng Gói

### Cài đặt dependencies
```bash
npm install
```

### Chạy ứng dụng ở môi trường Phát triển (Dev)
```bash
npm run dev
```

### Build biên dịch ứng dụng
```bash
npm run build
```

### Đóng gói ứng dụng thành phẩm (Production Build)
```bash
npm run dist
```
*Sau khi chạy, bộ cài đặt `.exe` và bản portable sẽ được lưu tại thư mục `release/`.*

---

## 📁 Cấu Trúc Thư Mục Chính

* `src/main/`: Mã nguồn tiến trình Electron Main và các Services chạy nền.
* `src/main/workers/`: Các worker tiến trình độc lập xử lý tải game (`prepareWorker.ts`) và khởi chạy game (`launchWorker.ts`).
* `src/renderer/`: Giao diện người dùng (React, components, screens, hooks).
* `src/shared/`: Định nghĩa kiểu dữ liệu (Types) dùng chung giữa Main và Renderer.
* `public/`: Tài nguyên tĩnh phục vụ dev & build.
