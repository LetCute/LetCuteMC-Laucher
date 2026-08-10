# Danh Mục IPC Channel & Reference API (`window.launcherApi`)

Tài liệu này cung cấp bảng tra cứu toàn bộ các kênh IPC (Inter-Process Communication) được lắng nghe tại `src/main/ipc.ts` và được expose sang Renderer Process thông qua `src/main/preload.ts` dưới đối tượng `window.launcherApi`.

---

## 1. Cài Đặt & Khả Năng Hệ Thống (Settings & Performance)

### `settings:get`
- **Phương thức Frontend**: `window.launcherApi.getSettings()`
- **Mô tả**: Lấy toàn bộ thiết lập hiện tại của launcher từ `settings.json`.
- **Trả về**: `Promise<LauncherSettings>`

### `settings:update`
- **Phương thức Frontend**: `window.launcherApi.updateSettings(input: Partial<LauncherSettings>)`
- **Mô tả**: Cập nhật một phần hoặc toàn bộ cài đặt ứng dụng.
- **Trả về**: `Promise<LauncherSettings>`

### `system:performance-info`
- **Phương thức Frontend**: `window.launcherApi.getSystemPerformanceInfo()`
- **Mô tả**: Lấy thông tin tổng quan về phần cứng (CPU cores, RAM total, Platform, Tier performance).
- **Trả về**: `Promise<SystemPerformanceInfo>`

### `settings:effective-performance`
- **Phương thức Frontend**: `window.launcherApi.getEffectivePerformanceSettings()`
- **Mô tả**: Lấy thiết lập hiệu năng thực tế (sau khi đã kết hợp tính toán Auto Performance nếu chế độ Auto bật).
- **Trả về**: `Promise<EffectivePerformanceSettings>`

---

## 2. Quản Lý Hồ Sơ Chơi (Profiles Management)

### `profiles:get`
- **Phương thức Frontend**: `window.launcherApi.getProfiles()`
- **Mô tả**: Lấy danh sách tất cả các profiles và ID của profile đang active.
- **Trả về**: `Promise<ProfilesStore>`

### `profiles:create`
- **Phương thức Frontend**: `window.launcherApi.createProfile(input: CreateProfileInput)`
- **Mô tả**: Tạo một profile cấu hình game mới.
- **Trả về**: `Promise<LauncherProfile>`

### `profiles:update`
- **Phương thức Frontend**: `window.launcherApi.updateProfile(profileId: string, input: UpdateProfileInput)`
- **Mô tả**: Cập nhật thông tin profile (Tên, phiên bản Minecraft, đường dẫn gameDir, RAM, Java path).
- **Trả về**: `Promise<LauncherProfile>`

### `profiles:delete`
- **Phương thức Frontend**: `window.launcherApi.deleteProfile(profileId: string)`
- **Mô tả**: Xóa profile theo ID.
- **Trả về**: `Promise<boolean>`

### `profiles:set-active`
- **Phương thức Frontend**: `window.launcherApi.setActiveProfile(profileId: string)`
- **Mô tả**: Đặt profile làm profile mặc định khởi chạy.
- **Trả về**: `Promise<boolean>`

---

## 3. Thư Mục Minecraft & Quản Lý Phiên Bản (Versions & Directory)

### `minecraft:detect-directory`
- **Phương thức Frontend**: `window.launcherApi.detectMinecraftDirectory()`
- **Mô tả**: Tự động dò tìm thư mục `.minecraft` mặc định của hệ điều hành.
- **Trả về**: `Promise<MinecraftDirectoryResult>`

### `versions:get-catalog`
- **Phương thức Frontend**: `window.launcherApi.getMinecraftVersionCatalog(gameDir: string)`
- **Mô tả**: Trả về catalog tổng hợp các phiên bản (Releases, Snapshots, Old Beta/Alpha và Manual installed).
- **Trả về**: `Promise<MinecraftVersionCatalog>`

### `minecraft:scan-directory`
- **Phương thức Frontend**: `window.launcherApi.scanMinecraftDirectory(gameDir: string)`
- **Mô tả**: Quét thư mục game để lấy dữ liệu về phiên bản, mods, resourcepacks, shaderpacks, file save.
- **Trả về**: `Promise<MinecraftScanResult>`

### `versions:open-folder`
- **Phương thức Frontend**: `window.launcherApi.openVersionFolder(versionPath: string)`
- **Mô tả**: Mở thư mục của phiên bản bằng File Explorer.
- **Trả về**: `Promise<boolean>`

### `versions:delete`
- **Phương thức Frontend**: `window.launcherApi.deleteVersion(versionPath: string)`
- **Mô tả**: Xóa thư mục phiên bản đã tải.
- **Trả về**: `Promise<boolean>`

---

## 4. Quản Lý Java Runtime (Java Management)

### `java:scan`
- **Phương thức Frontend**: `window.launcherApi.scanJavaRuntimes(customScanDirs?: string[], forceRefresh?: boolean)`
- **Mô tả**: Quét hệ thống để phát hiện tất cả các đường dẫn Java Runtime có sẵn.
- **Trả về**: `Promise<JavaScanResult>`

### `java:select-best`
- **Phương thức Frontend**: `window.launcherApi.selectBestJavaRuntime(minecraftVersion: string, customScanDirs?: string[], options?: object)`
- **Mô tả**: Phân tích phiên bản Minecraft và tự động chọn bản Java Runtime tương thích nhất.
- **Trả về**: `Promise<JavaRuntimeSelectionResult>`

### `java:verify-path`
- **Phương thức Frontend**: `window.launcherApi.verifyJavaPath(javaPath: string, requiredMajor: number)`
- **Mô tả**: Kiểm tra xem một đường dẫn `java.exe` có tồn tại và đúng phiên bản major hay không.
- **Trả về**: `Promise<JavaPathVerification>`

---

## 5. Quản Lý Nội Dung Mở Rộng (Mods, Resource Packs, Shader Packs)

### `content:scan`
- **Phương thức Frontend**: `window.launcherApi.scanGameContent(gameDir: string)`
- **Mô tả**: Quét và trả về danh sách tổng hợp tất cả các Mods, Resource Packs và Shader Packs.
- **Trả về**: `Promise<GameContentScanResult>`

### `content:scan-mods` / `content:scan-resourcepacks` / `content:scan-shaderpacks`
- **Phương thức Frontend**:
  - `window.launcherApi.scanMods(gameDir)`
  - `window.launcherApi.scanResourcePacks(gameDir)`
  - `window.launcherApi.scanShaderPacks(gameDir)`
- **Mô tả**: Quét chi tiết từng danh mục tài nguyên mở rộng.
- **Trả về**: `Promise<GameContentItem[]>`

### `content:get-mod-metadata`
- **Phương thức Frontend**: `window.launcherApi.getModMetadata(jarPath: string)`
- **Mô tả**: Đọc tệp `.jar` của mod để trích xuất tên mod, id, version, description và loader tương thích.
- **Trả về**: `Promise<GameContentMetadata>`

### `content:enable` / `content:disable`
- **Phương thức Frontend**:
  - `window.launcherApi.enableGameContent(gameDir, itemPath)`
  - `window.launcherApi.disableGameContent(gameDir, itemPath)`
- **Mô tả**: Thao tác bật/tắt mod hoặc gói tài nguyên (bằng cách xóa/thêm hậu tố `.disabled`).
- **Trả về**: `Promise<GameContentItem>`

### `content:delete`
- **Phương thức Frontend**: `window.launcherApi.deleteGameContent(gameDir, itemPath)`
- **Mô tả**: Xóa hẳn tệp mod hoặc gói tài nguyên khỏi ổ đĩa.
- **Trả về**: `Promise<boolean>`

### `content:import`
- **Phương thức Frontend**: `window.launcherApi.importGameContent(input: ImportGameContentInput)`
- **Mô tả**: Nhập tệp mod/resourcepack từ bên ngoài vào thư mục tương ứng của game.
- **Trả về**: `Promise<GameContentItem>`

### `content:open-folder`
- **Phương thức Frontend**: `window.launcherApi.openContentFolder(gameDir: string, type: GameContentType)`
- **Mô tả**: Mở thư mục `mods`, `resourcepacks` hoặc `shaderpacks` trên File Explorer.
- **Trả về**: `Promise<boolean>`

---

## 6. Quản Lý Tài Khoản (Accounts Management)

### `account:get`
- **Phương thức Frontend**: `window.launcherApi.getAccountState()`
- **Mô tả**: Lấy danh sách tài khoản và ID tài khoản đang chọn.
- **Trả về**: `Promise<AccountState>`

### `account:select`
- **Phương thức Frontend**: `window.launcherApi.selectAccount(accountId: string)`
- **Mô tả**: Đặt tài khoản đang hoạt động.
- **Trả về**: `Promise<AccountState>`

### `account:add-local`
- **Phương thức Frontend**: `window.launcherApi.addLocalAccount(username: string)`
- **Mô tả**: Thêm tài khoản ngoại tuyến (chơi Offline / Tài khoản ảo).
- **Trả về**: `Promise<AccountState>`

### `account:remove`
- **Phương thức Frontend**: `window.launcherApi.removeAccount(accountId: string)`
- **Mô tả**: Xóa một tài khoản khỏi danh sách.
- **Trả về**: `Promise<AccountState>`

### `account:login-microsoft`
- **Phương thức Frontend**: `window.launcherApi.loginMicrosoft()`
- **Mô tả**: Kích hoạt luồng đăng nhập tài khoản Microsoft chính thức.
- **Trả về**: `Promise<any>`

### `account:refresh-microsoft`
- **Phương thức Frontend**: `window.launcherApi.refreshMicrosoftAccount(accountId?: string)`
- **Mô tả**: Đổi mã Token Microsoft đã hết hạn.
- **Trả về**: `Promise<AccountState>`

---

## 7. Chuẩn Bị & Khởi Chạy Game (Prepare & Launch Process)

### `prepare:check`
- **Phương thức Frontend**: `window.launcherApi.checkPreparedProfile(profile, settings)`
- **Mô tả**: Kiểm tra nhanh xem phiên bản đã sẵn sàng khởi chạy chưa hay cần tải thêm dữ liệu.
- **Trả về**: `Promise<PreparedProfileState>`

### `prepare:start`
- **Phương thức Frontend**: `window.launcherApi.prepareGame(profile, settings, forceRepair?: boolean)`
- **Mô tả**: Bắt đầu quá trình kiểm tra mã băm SHA-1 và tải tệp game còn thiếu trong Worker Thread.
- **Trả về**: `Promise<PrepareGameResult>`

### `prepare:cancel`
- **Phương thức Frontend**: `window.launcherApi.cancelPrepareGame()`
- **Mô tả**: Hủy tiến trình chuẩn bị game.
- **Trả về**: `Promise<boolean>`

### `launch:start`
- **Phương thức Frontend**: `window.launcherApi.startLaunch(input: LaunchInput)`
- **Mô tả**: Kích hoạt `launchWorker.ts` để thực thi khởi chạy tiến trình Minecraft.
- **Trả về**: `Promise<StartLaunchResult>`

### `launch:cancel`
- **Phương thức Frontend**: `window.launcherApi.cancelLaunch()`
- **Mô tả**: Hủy tiến trình khởi chạy game.
- **Trả về**: `Promise<CancelLaunchResult>`

### `launch:get-state`
- **Phương thức Frontend**: `window.launcherApi.getLaunchState()`
- **Mô tả**: Lấy trạng thái công việc khởi chạy và danh sách log hiện tại.
- **Trả về**: `Promise<LaunchJobState>`

---

## 8. Lắng Nghe Sự Kiện Dòng (Event Listeners)

### `onPrepareGameProgress`
- **Phương thức Frontend**: `window.launcherApi.onPrepareGameProgress(callback)`
- **Mô tả**: Lắng nghe sự kiện phát ra từ kênh `prepare:progress` để cập nhật thanh phần trăm tiến độ tải game trên UI.

### `onLauncherEvent`
- **Phương thức Frontend**: `window.launcherApi.onLauncherEvent(callback)`
- **Mô tả**: Lắng nghe sự kiện phát ra từ kênh `launcher:event-batch` để cập nhật trạng thái game, phần trăm tiến độ và hiển thị các dòng nhật ký (logs) theo thời gian thực.

---

## 9. Cửa Sổ Không Viền & Hội Thoại Tệp (Frameless Window & Dialogs)

- `window.launcherApi.minimizeWindow()`: Thu nhỏ cửa sổ ứng dụng.
- `window.launcherApi.maximizeWindow()`: Phóng to hoặc khôi phục kích thước cửa sổ.
- `window.launcherApi.closeWindow()`: Đóng ứng dụng.
- `window.launcherApi.openFileDialog(filters?)`: Mở hộp thoại chọn file của HĐH.
