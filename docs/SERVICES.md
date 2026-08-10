# Tài Liệu Chi Tiết Các Dịch Vụ Backend (Services & Workers)

Thư mục `src/main/services/` và `src/main/workers/` chứa toàn bộ mã nguồn xử lý logic nghiệp vụ nền của **LetCuteMC Launcher**. Tài liệu này tổng hợp chức năng, nhiệm vụ và phương thức chính của từng Service.

---

## 1. Danh Mục Dịch Vụ Core (Main Services)

### 1.1 `accountService.ts` - Quản lý Tài khoản
- **Nhiệm vụ**: Quản lý danh sách tài khoản người dùng (Offline/Virtual và Microsoft Premium).
- **Chức năng chính**:
  - `getAccountState()`: Lấy danh sách tài khoản và ID tài khoản đang kích hoạt.
  - `selectAccount(accountId)`: Thay đổi tài khoản hoạt động.
  - `addLocalAccount(username)`: Tạo tài khoản Offline mới với UUID ngẫu nhiên theo chuẩn Minecraft.
  - `removeAccount(accountId)`: Xóa tài khoản khỏi bộ nhớ.
  - `saveMicrosoftAccount(account)`: Lưu thông tin và Token tài khoản Microsoft.
  - `refreshMicrosoftAccountToken(accountId)`: Tự động làm mới Microsoft OAuth Refresh Token khi hết hạn.

### 1.2 `prepareGameService.ts` - Chuẩn bị & Kiểm tra Tệp Game
- **Nhiệm vụ**: Quản lý quy trình kiểm tra, xác minh mã băm SHA-1 và tải xuống các tệp tin Minecraft trước khi chơi.
- **Chức năng chính**:
  - `checkPreparedProfile(profile, settings)`: Quét nhanh trạng thái sẵn sàng của phiên bản game (Version JSON, Libraries, Assets, Java).
  - `prepareGameFiles(profile, settings, forceRepair)`: Khởi chạy `prepareWorker.ts` để kiểm tra toàn bộ mã băm và tải tệp thiếu. Supports tính năng Sửa lỗi (Repair).
  - `cancelPrepareGame()`: Dừng ngay lập tức công việc chuẩn bị đang chạy.

### 1.3 `launchManager.ts` - Điều phối Tiến trình Khởi chạy Game
- **Nhiệm vụ**: Quản lý vòng đời công việc khởi chạy game (Launch Job), kết nối với `launchWorker.ts` và quản lý log đệm.
- **Chức năng chính**:
  - `safeStartLaunchJob(input)`: Tạo công việc khởi chạy mới trong luồng Worker riêng biệt.
  - `cancelLaunchJob()`: Hủy tiến trình khởi chạy game.
  - `getLaunchState()`: Trả về trạng thái công việc hiện tại (`idle`, `downloading`, `launching`, `running`, `failed`).
  - `clearJobLogs()`: Xóa sạch bộ đệm nhật ký của tiến trình.

### 1.4 `javaScannerService.ts` - Quét & Kiểm tra Java Runtime
- **Nhiệm vụ**: Phát hiện tất cả các phiên bản Java Runtime đã cài đặt trên hệ thống của người dùng.
- **Chức năng chính**:
  - `scanJavaRuntimes(customDirs, forceRefresh)`: Quét Windows Registry (`HKLM/SOFTWARE/JavaSoft`), thư mục `Program Files`, `%LOCALAPPDATA%`, `JAVA_HOME`, và các đường dẫn tùy chỉnh.
  - `selectBestJavaRuntime(minecraftVersion, customDirs, options)`: Tự động phân tích phiên bản Java yêu cầu của Minecraft (Java 8, Java 17, Java 21...) và lựa chọn Java Runtime tương thích tối ưu nhất.
  - `verifyJavaPath(javaPath, requiredMajor)`: Kiểm tra tính hợp lệ và phiên bản major của một đường dẫn Java cụ thể.

### 1.5 `javaInstallerService.ts` - Tự động Cài đặt Java
- **Nhiệm vụ**: Tự động tải xuống và giải nén phiên bản Java phù hợp (Temurin / Adoptium OpenJDK) khi máy người dùng chưa có Java tương thích.
- **Chức năng chính**:
  - `autoInstallJava(javaVersion, targetDir)`: Tải bản phân phối nén `.zip`/`.tar.gz` của Java OpenJDK theo đúng kiến trúc CPU và phiên bản major, giải nén vào thư mục `managed-java/`.
  - `getDefaultJavaInstallDir()`: Trả về đường dẫn lưu trữ các bản Java được quản lý bởi launcher.

### 1.6 `gameContentService.ts` - Quản lý Mods, Resource Packs & Shader Packs
- **Nhiệm vụ**: Đọc, phân tích, bật/tắt và quản lý tài nguyên mở rộng của game.
- **Chức năng chính**:
  - `scanGameContent(gameDir)`: Quét tổng thể toàn bộ Mods, Resource Packs và Shader Packs trong thư mục game.
  - `scanMods(gameDir)`: Đọc thư mục `mods/`, phân tích tệp `.jar` để trích xuất metadata từ `fabric.mod.json`, `quilt.mod.json` hoặc `mcmod.info`.
  - `enableGameContent(itemPath)` / `disableGameContent(itemPath)`: Bật hoặc tắt tài nguyên bằng cách đổi tên đuôi tệp (thêm hoặc bỏ hậu tố `.disabled`).
  - `importGameContent(input)`: Sao chép tệp mod/resourcepack từ bên ngoài vào đúng thư mục game.
  - `deleteGameContent(gameDir, itemPath)`: Xóa vĩnh viễn tệp tài nguyên.

### 1.7 `versionService.ts` - Danh mục Phiên bản Game
- **Nhiệm vụ**: Hợp nhất danh sách phiên bản chính thức từ Mojang và các phiên bản đã cài thủ công (Modpack, Forge, Fabric, Quilt).
- **Chức năng chính**:
  - `getMinecraftVersionCatalog(gameDir)`: Trả về bảng phân loại các phiên bản bao gồm Releases, Snapshots, Old Beta, Old Alpha và các bản cài thủ công local.

### 1.8 `settingsService.ts` & `profileService.ts` - Cài đặt & Cấu hình
- **`settingsService.ts`**: Quản lý cài đặt chung (Đường dẫn `.minecraft`, số RAM mặc định, số luồng tải, chế độ hiệu năng Auto/Manual).
  - `getEffectivePerformanceSettings()`: Trả về cấu hình hiệu năng thực tế sau khi đã tính toán tự động tối ưu theo phần cứng máy tính.
- **`profileService.ts`**: Quản lý các hồ sơ cấu hình chơi Minecraft (Tên profile, phiên bản Minecraft chọn, tùy chỉnh RAM, tùy chỉnh Java path).

### 1.9 `performanceTunerService.ts`
- **`performanceTunerService.ts`**: Đánh giá cấu hình phần cứng (Số nhân CPU, dung lượng RAM) để đưa ra đề xuất cấu hình tự động (Auto Performance Recommendation).

### 1.10 Các Services Phụ trợ Khác
- `download-manager.ts`: Quản lý luồng tải xuống dữ liệu song song hỗ trợ HTTP range, nối file tạm `.part`.
- `microsoftAuthService.ts`: Xử lý luồng đăng nhập tài khoản Microsoft qua OAuth2.
- `versionManifestCacheService.ts`: Quản lý bộ nhớ đệm (cache TTL) cho tệp `version_manifest_v2.json` từ Mojang.
- `systemInfoService.ts`: Lấy thông tin cấu hình phần cứng máy tính.
- `storageService.ts`: Trợ lý đọc/ghi các tệp JSON lưu trữ dữ liệu an toàn.
- `errorLogService.ts`: Ghi nhận và quản lý nhật ký lỗi hệ thống.
- `minecraftDirectoryService.ts`: Tự động tìm kiếm thư mục `.minecraft` mặc định của hệ điều hành.
- `minecraftScannerService.ts`: Quét danh mục lưu trữ game (Saves, Logs, Options).

---

## 2. Danh Mục Worker Threads (Workers)

### 2.1 `prepareWorker.ts`
- **Vị trí**: `src/main/workers/prepareWorker.ts`
- **Cách thức hoạt động**: Chạy trong một Worker Thread riêng biệt thông qua module `worker_threads`.
- **Nhiệm vụ**:
  1. Tải về hoặc đọc tệp tin phiên bản JSON (ví dụ: `1.20.4.json`).
  2. Tải tệp chỉ mục tài sản (Asset Index JSON).
  3. Quét kiểm tra mã băm SHA-1 của từng tệp thư viện (Libraries) và từng tài sản (Assets).
  4. Tạo danh sách các tệp bị thiếu/hỏng và thực hiện tải xuống song song với số luồng cấu hình (`downloadConcurrency`).
  5. Đổi tên tệp tạm `.part` thành tệp chính thức sau khi đối chiếu SHA-1 thành công.

### 2.2 `launchWorker.ts`
- **Vị trí**: `src/main/workers/launchWorker.ts`
- **Cách thức hoạt động**: Chạy trong một Worker Thread riêng biệt.
- **Nhiệm vụ**:
  1. Tiếp nhận tham số `LaunchInput` từ Tiến trình Main.
  2. Giải nén các tệp thư viện native (Natives `.dll`/`.so`) tương thích với phiên bản vào thư mục tạm.
  3. Xây dựng tham số dòng lệnh JVM hoàn chỉnh (Classpath, Main Class, Game Arguments, Memory Flags `-Xms`, `-Xmx`, RAM Tweak flags).
  4. Thực hiện kích hoạt tiến trình Java độc lập: `child_process.spawn(javaPath, args)`.
  5. Đọc luồng dữ liệu `stdout` và `stderr` từ tiến trình Java, đóng gói thành các đối tượng `LauncherLog` gửi về Tiến trình Main theo thời gian thực.
