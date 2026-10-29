<div align="center">
  <img src="public/logo.png" alt="LetCuteMC Logo" width="128" />
  <h1>LetCuteMC Launcher</h1>
  <p><b>Trình khởi chạy Minecraft thế hệ mới: Tốc độ cao, giao diện Dark Glassmorphism, tối ưu phần cứng yếu và toàn diện cho game thủ & modder.</b></p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Framework-Electron%2034%20%7C%20React%2018-61dafb?style=flat-square" alt="Framework" />
    <img src="https://img.shields.io/badge/Language-TypeScript-3178c6?style=flat-square" alt="TypeScript" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>

  ![Giao diện LetCuteMC Launcher](docs/assets/screenshot-v3.png)
</div>

---

## 📚 Bộ Tài Liệu Kỹ Thuật (Technical Documentation)

Để hỗ trợ việc tìm hiểu kiến trúc, phát triển tính năng mới cũng như bảo trì hệ thống, dự án cung cấp bộ tài liệu kỹ thuật chi tiết tại thư mục [`docs/`](./docs):

* 🏗️ **[Kiến Trúc Hệ Thống (ARCHITECTURE.md)](./docs/ARCHITECTURE.md)**: Mô hình đa tiến trình (Main, Renderer, Worker Threads), cơ chế giao tiếp IPC bảo mật, kiến trúc GPU Keep-Alive.
* ⚙️ **[Chi Tiết Services & Workers (SERVICES.md)](./docs/SERVICES.md)**: Phân tích danh mục 35 backend services và 2 worker xử lý ngầm (`launchWorker`, `prepareWorker`).
* 🔌 **[Danh Mục IPC Channel & API (IPC_API.md)](./docs/IPC_API.md)**: Tra cứu chi tiết toàn bộ các kênh IPC `window.launcherApi` và các sự kiện thời gian thực.
* 🎯 **[Đặc Tả Tính Năng Kỹ Thuật (FEATURES_SPEC.md)](./docs/FEATURES_SPEC.md)**: Cơ chế quét & tự động cài Java OpenJDK, tải song song & xác minh SHA-1, quản lý Mods/ResourcePacks và xác thực Microsoft.
* 🛠️ **[Hướng Dẫn Phát Triển & Đóng Gói (DEVELOPER_GUIDE.md)](./docs/DEVELOPER_GUIDE.md)**: Cài đặt môi trường, danh mục các lệnh script (`npm run dev`, `build`, `dist`) và cấu trúc dự án.

---

## ⚡ Đánh Giá Hiệu Năng & Khả Năng Tương Thích Thiết Bị

### 1. Launcher có gây giật lag không?
**Hoàn toàn không.** LetCuteMC được thiết kế với tiêu chuẩn zero-overhead, áp dụng hàng loạt kỹ thuật tối ưu hóa chuyên sâu:
* **Độc lập tiến trình hoàn toàn (Utility Process Isolation):** Tiến trình tải tài nguyên game (`prepareWorker`) và tiến trình chuẩn bị classpath/launch (`launchWorker`) được chạy trên tiến trình con của Node.js qua Electron Utility Process. Giao diện người dùng (UI) chạy trên Event Loop riêng biệt nên không bao giờ bị đơ (freeze/lag) khi tải file hoặc khởi động game.
* **Chế độ máy cỏ (Potato PC Preset):** Tự động nhận diện cấu hình phần cứng. Khi máy có RAM $\le$ 6GB hoặc CPU $\le$ 4 luồng, giao diện tự động bật cờ `data-ui-quality="low"`:
  * Tắt hoàn toàn hiệu ứng kính mờ tốn GPU (`backdrop-filter: blur`).
  * Loại bỏ hiệu ứng đổ bóng mờ (`box-shadow`).
  * Triệt tiêu thời gian chuyển động (`transition: 0s`).
* **Tiết kiệm RAM tuyệt đối khi chơi game:**
  * Giới hạn V8 Heap Size tối đa cho tiến trình chính ở mức 256MB (`--max-old-space-size=256`).
  * Khi nhấn Chơi game, cửa sổ Launcher tự động ẩn (`mainWindow.hide()`) và kích hoạt cơ chế thu hồi bộ nhớ (`trimLauncherMemory`), ép V8 thực hiện Garbage Collection, đưa mức chiếm dụng RAM của Launcher xuống dưới **50MB - 80MB**.
* **Zero-Reflow GPU Tabs:** Giữ các tab giao diện trên GPU context (`content-visibility: hidden`), chuyển đổi tức thì giữa các màn hình mà không cần re-render từ đầu.

---

### 2. Bảng Yêu Cầu Cấu Hình Máy Tính (System Requirements)

| Tiêu chí | Cấu hình tối thiểu (Potato PC / Máy yếu) | Cấu hình đề xuất (Chơi mượt & Modpack) |
| :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10/11 64-bit, Ubuntu 20.04+, macOS 11+ | Windows 10/11 64-bit, macOS 13+, Arch/Fedora |
| **Bộ xử lý (CPU)** | Intel Core 2 Quad / Intel Celeron N4000 / AMD Athlon 64 | Intel Core i3 8th Gen / AMD Ryzen 3 3200G trở lên |
| **Bộ nhớ (RAM)** | **4 GB** (Dành 2.5GB cho Minecraft, Launcher <80MB) | **8 GB – 16 GB** (Dành 4GB - 8GB cho Modpack) |
| **Card đồ họa (GPU)**| Intel HD Graphics 4000 / AMD Radeon HD 7000 (OpenGL 4.4)| NVIDIA GeForce GTX 1050 / AMD Radeon RX 560 hoặc Intel Iris Xe |
| **Ổ đĩa lưu trữ** | 2 GB dung lượng trống (HDD) | 10 GB dung lượng trống (**SSD NVMe/SATA** khuyến nghị) |
| **Java Runtime** | Tự động tải OpenJDK tương thích (Java 8 - 25) | Tự động nhận diện OpenJDK 21/17 tối ưu |

---

## 🏆 Bảng So Sánh Tính Năng Nổi Bật

| Tính năng cốt lõi | **LetCuteMC** 🇻🇳 | Prism Launcher | Modrinth App | HMCL | Lunar / Badlion |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Giao diện hiện đại (Dark Glassmorphism)** |  (Đẹp, mượt) | ❌ (Qt cổ điển) |  (Hiện đại) | ❌ (Java Swing/JavaFX) |  (Gaming UI) |
| **Chế độ máy yếu tự động (Low-End GPU Preset)** |  | ❌ | ❌ | ❌ | ❌ |
| **Kho Modrinth Store trực tiếp 1-Click** |  |  |  | ⚠️ (Hạn chế) | ❌ (Chỉ mod có sẵn) |
| **Quét & Tự cài đặt Java OpenJDK tự động (8-25)**|  | ⚠️ (Cần cài thủ công) |  | ⚠️ (Cần Java ngoài) |  (Tự đóng gói) |
| **Tự động chẩn đoán thiếu Dependency mod** |  | ❌ |  | ❌ | ❌ |
| **Thư viện Ảnh chụp màn hình (Screenshots Studio)**|  | ❌ | ❌ | ❌ |  |
| **Quản lý Thế giới (NBT Parser, Streamer Safe Seed)**|  | ❌ | ❌ | ❌ | ❌ |
| **Bảng thống kê thành tựu In-Game (Stats & K/D)** |  | ❌ | ❌ | ❌ | ❌ |
| **Hỗ trợ Tài khoản Offline & Microsoft chính thức** |  |  (Cần cài đặt) | ❌ (Chỉ Microsoft) |  | ❌ (Chỉ Microsoft) |
| **Tự động cấu hình Server Top VN & Tiếng Việt** |  | ❌ | ❌ | ❌ | ❌ |
| **Độc lập tiến trình tải & chạy (Utility Process)** |  | ⚠️ | ⚠️ | ❌ |  |
| **Tiết kiệm RAM khi ẩn (RAM Trimming <80MB)** |  | ⚠️ | ❌ (Electron nặng) | ⚠️ (Dính JVM) | ❌ |

---

## ✨ Danh Sách Tính Năng Chi Tiết

### 🎮 1. Quản Lý Cấu Hình Game (Profiles)
* **Độc lập hoàn toàn:** Mỗi cấu hình có thể chỉ định thư mục game riêng (`gameDir`), phiên bản Java riêng, mức RAM Min/Max riêng.
* **Hỗ trợ mọi ModLoader:** Hỗ trợ đầy đủ Vanilla, Snapshot, Forge, Fabric, Quilt và NeoForge.
* **Xuất / Nhập Cấu Hình:** Dễ dàng chia sẻ cấu hình modpack qua tệp `.letcutepack` chỉ với 1 click.
* **Khởi động siêu tốc:** Cơ chế Fast Launch và kiểm tra chuẩn bị game nền (Background Prepare).

### 🛒 2. Cửa Hàng Modrinth Tích Hợp (Store)
* **Kho tài nguyên phong phú:** Tìm kiếm trực tiếp hàng ngàn Mods, Modpacks, Resource Packs và Shader Packs từ Modrinth API.
* **Lọc thông minh:** Tự động lọc theo phiên bản Minecraft và ModLoader tương thích với cấu hình hiện tại.
* **Cài đặt 1-Click:** Tự động tải và phân loại file vào đúng thư mục cấu hình.

### ⚡ 3. Quản Lý Mods & Chẩn Đoán Xung Đột (Mods Manager)
* **Bật / Tắt nhanh:** Chuyển đổi trạng thái mod nhanh chóng (`.jar` ⇋ `.jar.disabled`) không cần xóa tệp.
* **Kéo thả cài đặt:** Hỗ trợ kéo thả trực tiếp tệp `.jar` từ máy tính vào Launcher.
* **Tự động phát hiện xung đột & thiếu dependency:** Quét mã nguồn `fabric.mod.json` hoặc `mods.toml` để phát hiện mod bị thiếu và cung cấp nút 1-click tự động tải bổ sung từ Modrinth.
* **Kiểm tra bản cập nhật:** Tự động đối chiếu hash với Modrinth để thông báo khi có bản mod mới.

### 🌍 4. Quản Lý Thế Giới & Chế Độ Streamer (Worlds)
* **Phân tích NBT chuyên sâu:** Hiển thị tên bản đồ, chế độ chơi (Sinh tồn, Sáng tạo, Hardcore, Phiêu lưu), độ khó, phiên bản, dung lượng và lần chơi cuối.
* **Sao lưu & Phục hồi:** Tạo bản sao lưu `.zip` an toàn và khôi phục nhanh chóng.
* **🛡️ Chế độ Streamer Safe (Che Giấu Seed):**
  * Tự động ẩn Seed (`••••••••••••••••`) để chống lộ tọa độ thế giới khi livestream.
  * Tích hợp nút con mắt (👁️) bật/tắt hiển thị an toàn và nút sao chép Seed vào clipboard.

### 🎨 5. Resource Packs & Shader Packs
* Đọc tệp `pack.mcmeta` và hiển thị ảnh mô tả thumbnail trực quan.
* Kéo thả cài đặt tệp `.zip` và bật/tắt nhanh chóng.

### 📸 6. Thư Viện Ảnh Chụp Màn Hình (Screenshots Studio)
* Tự động quét và gom nhóm ảnh theo Ngày / Tháng.
* Trình xem ảnh phóng to toàn màn hình (Lightbox viewer) hỗ trợ phím mũi tên `←` / `→`.
* Nút sao chép ảnh trực tiếp vào Clipboard để gửi vào Discord / Facebook nhanh chóng.

### 📊 7. Thống Kê & Thành Tựu Người Chơi (Stats)
* Quét và phân tích dữ liệu `stats/<uuid>.json` từ Minecraft.
* **Gộp thế giới thông minh:** Gom toàn bộ dữ liệu người chơi theo từng thế giới, không bị trùng lặp mục.
* **Huy hiệu K/D & Khoáng sản quý:** Hiển thị tổng giờ chơi, số lượng Kim Cương / Netherite đã đào, chiến tích diệt quái kèm **Pill Badge K/D** riêng biệt.
* **Chi tiết đầy đủ:** Khai khoáng, Chiến đấu, Quãng đường (Đi bộ, Bơi, Bay Elytra, Thuyền) và Sinh tồn.

### 📜 8. Nhật Ký Thời Gian Thực & Trợ Lý Bắt Lỗi (Game Logs)
* Stream log game trực tiếp khi Minecraft đang chạy qua ring-buffer hiệu năng cao.
* Bộ lọc theo cấp độ (`INFO`, `WARN`, `ERROR`, `FATAL`) và tìm kiếm văn bản / regex.
* Tự động nhận diện nguyên nhân Crash (thiếu RAM, lỗi driver card đồ họa, xung đột mod) và gợi ý cách khắc phục.

### 👤 9. Quản Lý Tài Khoản & Skin (Accounts)
* **Tài khoản Offline (Virtual):** Tùy chỉnh tên nhân vật với UUID cố định để giữ nguyên tiến trình chơi.
* **Đăng nhập Microsoft / Xbox chính thức:** Xác thực thông qua OAuth2 PKCE chuẩn bảo mật của Microsoft.
* **Mã hóa an toàn:** Token tài khoản được mã hóa bảo vệ qua hệ thống `safeStorage` (DPAPI trên Windows).
* **Quản lý Skin & Áo choàng 3D:** Xem trước skin dạng 3D trực quan và tải skin lên tài khoản.

### ⚙️ 10. Tinh Chỉnh Hiệu Năng & Cài Đặt Hệ Thống (Settings)
* **Tự động quét & Cài đặt Java OpenJDK:** Nhận diện Java 8, 11, 16, 17, 21, 25; tự động tải OpenJDK tương thích nếu máy chưa có.
* **Đề xuất RAM thông minh:** Tính toán theo cấu hình RAM thực tế của máy tính.
* **JVM Presets cao cấp:** Cung cấp sẵn các bộ cờ tối ưu hóa bộ nhớ (`Aikar's Flags`, `Shenandoah GC`, `ZGC`).
* **Đồng bộ đồ họa UI (High / Medium / Low):** Tự động chuyển đổi giao diện sang chế độ siêu nhẹ trên máy yếu.
* **Dọn dẹp ổ đĩa:** Quét và giải phóng bộ nhớ đệm cache tệp tin tạm.

### 🌐 11. Tự Động Hóa Máy Chủ Việt Nam (Auto Server List)
* Tự động nạp danh sách Server Top VN vào `servers.dat`.
* Bảo toàn máy chủ riêng do người chơi tự thêm.
* Tự động kích hoạt Tiếng Việt, Unicode font và chấp nhận Server Resource Packs.

### 💬 12. Discord Rich Presence (RPC) & Auto-Updater
* Hiển thị trạng thái đang chơi / đang ở sảnh lên Discord Profile.
* Tự động kiểm tra và tải bản cập nhật mới nhất từ GitHub Releases.

---

## 🛡️ Kiến Trúc An Toàn & Bảo Mật

* **Phòng ngừa RCE qua JVM Arguments:** Tự động lọc bỏ các cờ JVM nguy hiểm (`-javaagent:`, `-agentlib:`, `-agentpath:`, `-Xbootclasspath`, `-XX:OnError=`) khi nạp cấu hình từ bên ngoài.
* **Chống Path Traversal & Xóa nhầm file:** Ràng buộc nghiêm ngặt ranh giới thư mục game (`assertPathInsideGameDir`) trên mọi tác vụ xóa phiên bản, bật/tắt mod và quản lý tệp tin.
* **Bảo vệ mã hóa Token:** Thông tin xác thực Microsoft được mã hóa bằng cơ chế mã hóa cấp OS (`safeStorage` DPAPI), không lưu trữ plaintext trên đĩa.
* **Tải xuống an toàn qua HTTPS:** Bắt buộc kết nối HTTPS mã hóa trên toàn bộ luồng tải file và kiểm tra toàn vẹn gói OpenJDK trước khi giải nén.

---

## 🛠️ Công Nghệ Sử Dụng

* **Khung ứng dụng:** Electron 34+ & Node.js
* **Giao diện:** React 18, Vite 8, TypeScript, Lucide Icons
* **Styling & GPU:** Tailwind CSS, GPU Zero-Reflow Layer (`content-visibility: hidden`), Dynamic Graphic Presets
* **Minecraft Core:** `@xmcl/core`, `@xmcl/installer`, `@xmcl/unzip`, `prismarine-nbt`

---

## 🚀 Hướng Dẫn Phát Triển & Đóng Gói

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Chạy ứng dụng ở môi trường Phát triển (Dev)
```bash
npm run dev
```

### 3. Build biên dịch ứng dụng
```bash
npm run build
```

### 4. Đóng gói ứng dụng thành phẩm (Production Build)

**Bản cài đặt Windows Installer (`.exe`) & Portable:**
```bash
npm run dist
```

**Bản Portable Windows độc lập:**
```bash
npm run dist:portable
```

**Bản Linux (AppImage & DEB):**
```bash
npm run dist:appimage
npm run dist:deb
```

*Sau khi chạy, các bộ cài đặt thành phẩm sẽ được lưu tại thư mục `release/`.*

---

## 📁 Cấu Trúc Thư Mục Chính

* `docs/`: Bộ tài liệu kỹ thuật toàn diện của dự án (IPC, Architecture, Features, Services).
* `src/main/`: Mã nguồn tiến trình Electron Main và 35 Services chạy nền.
* `src/main/workers/`: Các worker tiến trình độc lập xử lý tải game (`prepareWorker.ts`) và khởi chạy game (`launchWorker.ts`).
* `src/renderer/`: Giao diện người dùng (React, components, 15 màn hình screens, custom hooks).
* `src/shared/`: Định nghĩa kiểu dữ liệu (Types) dùng chung giữa Main và Renderer.
* `public/`: Tài nguyên tĩnh phục vụ dev & build.
