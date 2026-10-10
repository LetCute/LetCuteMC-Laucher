# Danh Mục IPC Channel & Reference API (`window.launcherApi`)

Tài liệu này cung cấp bảng tra cứu toàn bộ các kênh IPC (Inter-Process Communication) được lắng nghe tại `src/main/ipc/` và được expose sang Renderer Process thông qua `src/main/preload.ts` dưới đối tượng `window.launcherApi`.

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

### `profiles:export-package`
- **Phương thức Frontend**: `window.launcherApi.exportProfilePackage(options: ExportProfilePackageOptions)`
- **Mô tả**: Xuất profile thành file `.letcutepack` để chia sẻ.
- **Trả về**: `Promise<ExportProfileResult>`

### `profiles:read-package-info`
- **Phương thức Frontend**: `window.launcherApi.readProfilePackageInfo(packageFilePath: string)`
- **Mô tả**: Đọc thông tin preview từ file `.letcutepack` trước khi import.
- **Trả về**: `Promise<PackagePreviewInfo>`

### `profiles:import-package`
- **Phương thức Frontend**: `window.launcherApi.importProfilePackage(packageFilePath: string, customName?: string)`
- **Mô tả**: Import profile từ file `.letcutepack`.
- **Trả về**: `Promise<ImportProfileResult>`

---

## 3. Thư Mục Minecraft & Quản Lý Phiên Bản (Versions & Directory)

### `minecraft:detect-directory`
- **Phương thức Frontend**: `window.launcherApi.detectMinecraftDirectory()`
- **Mô tả**: Tự động dò tìm thư mục `.minecraft` mặc định của hệ điều hành.
- **Trả về**: `Promise<MinecraftDirectoryResult>`

### `minecraft:scan-directory`
- **Phương thức Frontend**: `window.launcherApi.scanMinecraftDirectory(gameDir: string)`
- **Mô tả**: Quét thư mục game để lấy dữ liệu về phiên bản, mods, resourcepacks, shaderpacks, file save.
- **Trả về**: `Promise<MinecraftScanResult>`

### `versions:get-catalog`
- **Phương thức Frontend**: `window.launcherApi.getMinecraftVersionCatalog(gameDir: string)`
- **Mô tả**: Trả về catalog tổng hợp các phiên bản (Releases, Snapshots, Old Beta/Alpha và Manual installed).
- **Trả về**: `Promise<MinecraftVersionCatalog>`

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

### `java:auto-install`
- **Phương thức Frontend**: `window.launcherApi.autoInstallJava(...)`
- **Mô tả**: Tự động tải và cài đặt Java Runtime phù hợp vào thư mục `managed-java/`.
- **Trả về**: `Promise<...>`

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

## 6. Mod Dependencies & Conflicts

### `mods:inspect-dependencies`
- **Phương thức Frontend**: `window.launcherApi.inspectModDependencies(gameDir, mcVersion, loader?)`
- **Mô tả**: Quét và phân tích dependency giữa các mod đã cài.
- **Trả về**: `Promise<ModDependencyScanResult>`

### `mods:auto-fix-dependencies`
- **Phương thức Frontend**: `window.launcherApi.autoFixModDependencies(gameDir, mcVersion, loader?)`
- **Mô tả**: Tự động tải và cài đặt các mod dependency còn thiếu.
- **Trả về**: `Promise<AutoFixDependenciesResult>`

### `mod-conflict:check`
- **Phương thức Frontend**: `window.launcherApi.checkModConflicts(gameDir?, mcVersion?, loader?)`
- **Mô tả**: Kiểm tra xung đột giữa các mod (duplicate, incompatible).
- **Trả về**: `Promise<ModConflictCheckResult>`

### `mod-conflict:resolve`
- **Phương thức Frontend**: `window.launcherApi.resolveModConflict(gameDir, option, mcVersion?, loader?)`
- **Mô tả**: Giải quyết một xung đột mod cụ thể.
- **Trả về**: `Promise<ResolveConflictResult>`

### `mod-conflict:resolve-all-critical`
- **Phương thức Frontend**: `window.launcherApi.resolveAllCriticalConflicts(gameDir, conflicts, mcVersion?, loader?)`
- **Mô tả**: Giải quyết tất cả xung đột nghiêm trọng cùng lúc.
- **Trả về**: `Promise<ResolveConflictResult>`

---

## 7. Mod Loader Installation

### `modloader:get-fabric-versions` / `modloader:get-quilt-versions` / `modloader:get-forge-versions` / `modloader:get-neoforge-versions`
- **Phương thức Frontend**:
  - `window.launcherApi.getFabricVersions()`
  - `window.launcherApi.getQuiltVersions()`
  - `window.launcherApi.getForgeVersions()`
  - `window.launcherApi.getNeoForgeVersions()`
- **Mô tả**: Lấy danh sách phiên bản mod loader có sẵn.
- **Trả về**: `Promise<ModLoaderVersion[]>`

### `modloader:install-fabric` / `modloader:install-quilt` / `modloader:install-forge` / `modloader:install-neoforge`
- **Phương thức Frontend**:
  - `window.launcherApi.installFabric(mcVersion, loaderVersion, gameDir)`
  - `window.launcherApi.installQuilt(mcVersion, loaderVersion, gameDir)`
  - `window.launcherApi.installForge(mcVersion, loaderVersion, gameDir)`
  - `window.launcherApi.installNeoForge(mcVersion, loaderVersion, gameDir)`
- **Mô tả**: Cài đặt mod loader vào thư mục game.
- **Trả về**: `Promise<string>` (version ID đã cài)

---

## 8. Mod Auto-Updater

### `mod-updater:check`
- **Phương thức Frontend**: `window.launcherApi.checkForModUpdates(gameDir?, mcVersion?, loader?)`
- **Mô tả**: Kiểm tra bản cập nhật mới cho tất cả mod đã cài.
- **Trả về**: `Promise<ModUpdateCheckResult>`

### `mod-updater:update-single`
- **Phương thức Frontend**: `window.launcherApi.updateSingleMod(gameDir, item: ModUpdateItem)`
- **Mô tả**: Cập nhật một mod cụ thể lên phiên bản mới.
- **Trả về**: `Promise<UpdateSingleModResult>`

### `mod-updater:update-all`
- **Phương thức Frontend**: `window.launcherApi.updateAllMods(gameDir, items: ModUpdateItem[])`
- **Mô tả**: Cập nhật tất cả mod có bản mới cùng lúc.
- **Trả về**: `Promise<UpdateAllModsResult>`

---

## 9. Modrinth Store

### `modrinth:search`
- **Phương thức Frontend**: `window.launcherApi.searchModrinth(query, projectType, offset?, gameVersion?, loader?)`
- **Mô tả**: Tìm kiếm mod/modpack/resourcepack trên Modrinth.
- **Trả về**: `Promise<any>`

### `modrinth:get-versions`
- **Phương thức Frontend**: `window.launcherApi.getModrinthVersions(projectId: string)`
- **Mô tả**: Lấy danh sách phiên bản của một project Modrinth.
- **Trả về**: `Promise<any[]>`

### `modrinth:install-modpack`
- **Phương thức Frontend**: `window.launcherApi.installModrinthModpack(versionId, profileName)`
- **Mô tả**: Cài đặt modpack từ Modrinth (tạo profile mới).
- **Trả về**: `Promise<string>`

### `modrinth:install-local-modpack`
- **Phương thức Frontend**: `window.launcherApi.installLocalModrinthModpack(mrpackPath, profileName)`
- **Mô tả**: Cài đặt modpack từ file `.mrpack` local.
- **Trả về**: `Promise<string>`

### `store:get-installations`
- **Phương thức Frontend**: `window.launcherApi.getStoreInstallations(gameDir: string)`
- **Mô tả**: Lấy danh sách mod/resourcepack đã cài từ store.
- **Trả về**: `Promise<StoreInstallation[]>`

### `store:install-mod`
- **Phương thức Frontend**: `window.launcherApi.installStoreMod(versionId, gameDir)`
- **Mô tả**: Cài đặt mod từ Modrinth store vào thư mục game.
- **Trả về**: `Promise<boolean>`

### `store:uninstall-item`
- **Phương thức Frontend**: `window.launcherApi.uninstallStoreItem(projectId, gameDir)`
- **Mô tả**: Gỡ cài đặt item đã cài từ store.
- **Trả về**: `Promise<boolean>`

### `server-list:get`
- **Phương thức Frontend**: `window.launcherApi.getMinecraftServers(page?: number)`
- **Mô tả**: Lấy danh sách server Minecraft phổ biến.
- **Trả về**: `Promise<MinecraftServer[]>`

### `server-list:inject`
- **Phương thức Frontend**: `window.launcherApi.injectTopServers(profileId, page?)`
- **Mô tả**: Inject danh sách server vào file `servers.dat` của profile.
- **Trả về**: `Promise<boolean>`

---

## 10. Quản Lý Tài Khoản (Accounts Management)

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

### `account:rename-locally`
- **Phương thức Frontend**: `window.launcherApi.renameAccountLocally(accountId, newName)`
- **Mô tả**: Đổi tên hiển thị của tài khoản offline.
- **Trả về**: `Promise<AccountState>`

### `account:save-local-skin`
- **Phương thức Frontend**: `window.launcherApi.saveLocalSkin(accountId, skinUrl, skinModel, capeUrl)`
- **Mô tả**: Lưu skin/cape tùy chỉnh cho tài khoản offline.
- **Trả về**: `Promise<AccountState>`

### `account:save-microsoft`
- **Phương thức Frontend**: `window.launcherApi.saveMicrosoftAccount(account: any)`
- **Mô tả**: Lưu thông tin tài khoản Microsoft sau khi đăng nhập.
- **Trả về**: `Promise<AccountState>`

### `account:login-microsoft`
- **Phương thức Frontend**: `window.launcherApi.loginMicrosoft()`
- **Mô tả**: Kích hoạt luồng đăng nhập tài khoản Microsoft chính thức (OAuth2 PKCE).
- **Trả về**: `Promise<any>`

### `account:refresh-microsoft`
- **Phương thức Frontend**: `window.launcherApi.refreshMicrosoftAccount(accountId?: string)`
- **Mô tả**: Đổi mã Token Microsoft đã hết hạn.
- **Trả về**: `Promise<AccountState>`

### `account:lookup-player-skin`
- **Phương thức Frontend**: `window.launcherApi.lookupPlayerSkin(usernameOrUuid: string)`
- **Mô tả**: Tra cứu skin/cape của player theo username hoặc UUID.
- **Trả về**: `Promise<{ url, model, username, uuid?, capeUrl? } | null>`

---

## 11. Mojang API

### `mojang:get-profile`
- **Phương thức Frontend**: `window.launcherApi.getMojangProfile(accessToken: string)`
- **Mô tả**: Lấy thông tin profile Mojang (skin, cape, name).
- **Trả về**: `Promise<any>`

### `mojang:fetch-texture`
- **Phương thức Frontend**: `window.launcherApi.fetchMojangTexture(url: string)`
- **Mô tả**: Tải texture (skin/cape) từ Mojang CDN, trả về base64.
- **Trả về**: `Promise<string | null>`

### `mojang:upload-skin`
- **Phương thức Frontend**: `window.launcherApi.uploadMojangSkin(accessToken, fileBuffer, variant)`
- **Mô tả**: Upload skin mới lên tài khoản Mojang.
- **Trả về**: `Promise<void>`

### `mojang:change-cape`
- **Phương thức Frontend**: `window.launcherApi.changeMojangCape(accessToken, capeId)`
- **Mô tả**: Thay đổi cape đang sử dụng.
- **Trả về**: `Promise<void>`

### `mojang:check-name-change`
- **Phương thức Frontend**: `window.launcherApi.checkMojangNameChange(accessToken)`
- **Mô tả**: Kiểm tra xem tài khoản có được phép đổi tên không.
- **Trả về**: `Promise<{ createdAt, nameChangeAllowed }>`

### `mojang:change-name`
- **Phương thức Frontend**: `window.launcherApi.changeMojangName(accessToken, newName)`
- **Mô tả**: Đổi tên Minecraft của tài khoản.
- **Trả về**: `Promise<void>`

---

## 12. Chuẩn Bị & Khởi Chạy Game (Prepare & Launch Process)

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

### `cache:clear-manifest`
- **Phương thức Frontend**: `window.launcherApi.clearVersionManifestCache()`
- **Mô tả**: Xóa cache version manifest để buộc tải lại từ Mojang.
- **Trả về**: `Promise<boolean>`

### `cache:clear-prepared`
- **Phương thức Frontend**: `window.launcherApi.clearPreparedProfilesCache()`
- **Mô tả**: Xóa cache trạng thái prepared của tất cả profile.
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

### `launch:clear-logs`
- **Phương thức Frontend**: `window.launcherApi.clearLaunchLogs()`
- **Mô tả**: Xóa log của phiên launch hiện tại.
- **Trả về**: `Promise<boolean>`

### Legacy Launch API

### `minecraft:launch`
- **Phương thức Frontend**: `window.launcherApi.launchMinecraft(input, profile)`
- **Mô tả**: API launch cũ (blocking). Sử dụng `launch:start` thay thế.
- **Trả về**: `Promise<LaunchResult>`

### `launcher:get-status` / `launcher:get-progress` / `launcher:get-logs` / `launcher:clear-logs`
- **Phương thức Frontend**: `getLaunchStatus()`, `getLauncherProgress()`, `getLauncherLogs()`, `clearLauncherLogs()`
- **Mô tả**: Legacy API cho launch cũ. Sử dụng `launch:get-state` thay thế.

---

## 13. Lắng Nghe Sự Kiện Dòng (Event Listeners)

### `onPrepareGameProgress`
- **Phương thức Frontend**: `window.launcherApi.onPrepareGameProgress(callback)`
- **Channel**: `prepare:progress`
- **Mô tả**: Lắng nghe sự kiện phát ra để cập nhật thanh phần trăm tiến độ tải game trên UI.

### `onLauncherEvent`
- **Phương thức Frontend**: `window.launcherApi.onLauncherEvent(callback)`
- **Channel**: `launcher:event-batch`
- **Mô tả**: Lắng nghe sự kiện phát ra để cập nhật trạng thái game, phần trăm tiến độ và hiển thị các dòng nhật ký (logs) theo thời gian thực.

### `onTasksUpdate`
- **Phương thức Frontend**: `window.launcherApi.onTasksUpdate(callback)`
- **Channel**: `tasks:on-update`
- **Mô tả**: Lắng nghe cập nhật trạng thái background tasks (progress, completion, error).

### `onUpdateStatus`
- **Phương thức Frontend**: `window.launcherApi.onUpdateStatus(callback)`
- **Channel**: `auto-update:status`
- **Mô tả**: Lắng nghe trạng thái auto-updater (checking, downloading, ready).

### `onLanServersUpdated`
- **Phương thức Frontend**: `window.launcherApi.onLanServersUpdated(callback)`
- **Channel**: `lan-servers:updated`
- **Mô tả**: Lắng nghe khi danh sách LAN server thay đổi.

---

## 14. Cửa Sổ & Hội Thoại (Window & Dialogs)

### `window:minimize` / `window:maximize` / `window:close`
- **Phương thức Frontend**: `minimizeWindow()`, `maximizeWindow()`, `closeWindow()`
- **Mô tả**: Điều khiển cửa sổ không viền (frameless window).

### `window:open-external`
- **Phương thức Frontend**: `window.launcherApi.openExternal(url: string)`
- **Mô tả**: Mở URL trong trình duyệt mặc định.
- **Trả về**: `Promise<void>`

### `dialog:open-file`
- **Phương thức Frontend**: `window.launcherApi.openFileDialog(filters?)`
- **Mô tả**: Mở hộp thoại chọn file của HĐH.
- **Trả về**: `Promise<string | null>`

### `dialog:save-file`
- **Phương thức Frontend**: `window.launcherApi.saveFileDialog(options?)`
- **Mô tả**: Mở hộp thoại lưu file.
- **Trả về**: `Promise<string | null>`

---

## 15. Background Tasks

### `tasks:get-all`
- **Phương thức Frontend**: `window.launcherApi.getAllTasks()`
- **Mô tả**: Lấy danh sách tất cả background tasks đang chạy/hoàn thành.
- **Trả về**: `Promise<BackgroundTask[]>`

### `tasks:cancel`
- **Phương thức Frontend**: `window.launcherApi.cancelTask(taskId: string)`
- **Mô tả**: Hủy một background task.
- **Trả về**: `Promise<boolean>`

### `tasks:clear-completed`
- **Phương thức Frontend**: `window.launcherApi.clearCompletedTasks()`
- **Mô tả**: Xóa các task đã hoàn thành khỏi danh sách.
- **Trả về**: `Promise<void>`

---

## 16. Discord Rich Presence

### `discord:set-activity`
- **Phương thức Frontend**: `window.launcherApi.setDiscordActivity(details, state)`
- **Mô tả**: Cập nhật trạng thái Discord Rich Presence.
- **Trả về**: `Promise<boolean>`

---

## 17. Auto Updater

### `updater:check`
- **Phương thức Frontend**: `window.launcherApi.checkForUpdates()`
- **Mô tả**: Kiểm tra bản cập nhật mới cho launcher.
- **Trả về**: `Promise<any>`

### `updater:quit-and-install`
- **Phương thức Frontend**: `window.launcherApi.quitAndInstallUpdate()`
- **Mô tả**: Thoát launcher và cài đặt bản cập nhật.
- **Trả về**: `Promise<void>`

---

## 18. LAN Discovery

### `lan:start`
- **Phương thức Frontend**: `window.launcherApi.startLanDiscovery()`
- **Mô tả**: Bắt đầu quét mạng LAN tìm server Minecraft (UDP multicast 224.0.2.60:4445).
- **Trả về**: `Promise<boolean>`

### `lan:stop`
- **Phương thức Frontend**: `window.launcherApi.stopLanDiscovery()`
- **Mô tả**: Dừng quét LAN.
- **Trả về**: `Promise<boolean>`

### `lan:get-servers`
- **Phương thức Frontend**: `window.launcherApi.getLanServers()`
- **Mô tả**: Lấy danh sách LAN server đã phát hiện.
- **Trả về**: `Promise<LanServerInfo[]>`

---

## 19. Worlds & Saves

### `worlds:scan`
- **Phương thức Frontend**: `window.launcherApi.scanWorlds(gameDir?)`
- **Mô tả**: Quét tất cả world saves trong thư mục game.
- **Trả về**: `Promise<MinecraftWorld[]>`

### `worlds:backup`
- **Phương thức Frontend**: `window.launcherApi.backupWorld(gameDir, folderName)`
- **Mô tả**: Tạo bản backup cho một world.
- **Trả về**: `Promise<{ success, backupPath, fileName, sizeBytes, message? }>`

### `worlds:list-backups`
- **Phương thức Frontend**: `window.launcherApi.listWorldBackups(gameDir, folderName?)`
- **Mô tả**: Liệt kê các bản backup của world.
- **Trả về**: `Promise<WorldBackupItem[]>`

### `worlds:restore-backup`
- **Phương thức Frontend**: `window.launcherApi.restoreWorldBackup(gameDir, backupFilePath, targetFolderName?)`
- **Mô tả**: Khôi phục world từ bản backup.
- **Trả về**: `Promise<{ success, folderName }>`

### `worlds:delete-backup`
- **Phương thức Frontend**: `window.launcherApi.deleteWorldBackup(backupFilePath)`
- **Mô tả**: Xóa bản backup.
- **Trả về**: `Promise<boolean>`

### `worlds:export-zip`
- **Phương thức Frontend**: `window.launcherApi.exportWorldZip(gameDir, folderName, destinationZipPath)`
- **Mô tả**: Xuất world thành file ZIP.
- **Trả về**: `Promise<boolean>`

### `worlds:import-zip`
- **Phương thức Frontend**: `window.launcherApi.importWorldZip(gameDir, sourceZipPath)`
- **Mô tả**: Import world từ file ZIP.
- **Trả về**: `Promise<{ success, folderName, name }>`

### `worlds:duplicate`
- **Phương thức Frontend**: `window.launcherApi.duplicateWorld(gameDir, folderName, newWorldName?)`
- **Mô tả**: Nhân bản world.
- **Trả về**: `Promise<{ success, newFolderName }>`

### `worlds:rename`
- **Phương thức Frontend**: `window.launcherApi.renameWorld(gameDir, folderName, newLevelName)`
- **Mô tả**: Đổi tên world (sửa level.dat).
- **Trả về**: `Promise<boolean>`

### `worlds:delete`
- **Phương thức Frontend**: `window.launcherApi.deleteWorld(gameDir, folderName)`
- **Mô tả**: Xóa world.
- **Trả về**: `Promise<boolean>`

### `worlds:open-folder`
- **Phương thức Frontend**: `window.launcherApi.openWorldFolder(gameDir, folderName?)`
- **Mô tả**: Mở thư mục world trong File Explorer.
- **Trả về**: `Promise<boolean>`

---

## 20. Screenshots Gallery

### `screenshots:scan`
- **Phương thức Frontend**: `window.launcherApi.scanScreenshots(gameDir?)`
- **Mô tả**: Quét tất cả screenshot trong thư mục game.
- **Trả về**: `Promise<MinecraftScreenshot[]>`

### `screenshots:copy-clipboard`
- **Phương thức Frontend**: `window.launcherApi.copyScreenshotToClipboard(filePath)`
- **Mô tả**: Copy screenshot vào clipboard.
- **Trả về**: `Promise<boolean>`

### `screenshots:delete`
- **Phương thức Frontend**: `window.launcherApi.deleteScreenshot(filePath)`
- **Mô tả**: Xóa một screenshot.
- **Trả về**: `Promise<boolean>`

### `screenshots:delete-multiple`
- **Phương thức Frontend**: `window.launcherApi.deleteMultipleScreenshots(filePaths)`
- **Mô tả**: Xóa nhiều screenshot cùng lúc.
- **Trả về**: `Promise<boolean>`

### `screenshots:show-in-folder`
- **Phương thức Frontend**: `window.launcherApi.showScreenshotInFolder(filePath)`
- **Mô tả**: Hiển thị screenshot trong File Explorer.
- **Trả về**: `Promise<boolean>`

### `screenshots:open-folder`
- **Phương thức Frontend**: `window.launcherApi.openScreenshotsFolder(gameDir?)`
- **Mô tả**: Mở thư mục screenshots.
- **Trả về**: `Promise<boolean>`

---

## 21. Logs & Crash Reports

### `logs:list-files`
- **Phương thức Frontend**: `window.launcherApi.listLogFiles(gameDir?)`
- **Mô tả**: Liệt kê file log và crash report.
- **Trả về**: `Promise<{ activeLogs: LogFileInfo[]; crashReports: LogFileInfo[] }>`

### `logs:read-file`
- **Phương thức Frontend**: `window.launcherApi.readLogFile(filePath)`
- **Mô tả**: Đọc nội dung file log.
- **Trả về**: `Promise<string>`

### `logs:upload-mclogs`
- **Phương thức Frontend**: `window.launcherApi.uploadLogToMclogs(content)`
- **Mô tả**: Upload log lên mclo.gs để chia sẻ.
- **Trả về**: `Promise<MclogsUploadResult>`

### `logs:delete-file`
- **Phương thức Frontend**: `window.launcherApi.deleteLogFile(filePath)`
- **Mô tả**: Xóa file log.
- **Trả về**: `Promise<boolean>`

### `logs:clear-old`
- **Phương thức Frontend**: `window.launcherApi.clearOldLogs(gameDir?)`
- **Mô tả**: Xóa log cũ để giải phóng dung lượng.
- **Trả về**: `Promise<{ success, count, freedBytes }>`

### `logs:open-folder`
- **Phương thức Frontend**: `window.launcherApi.openLogsFolder(gameDir, type?)`
- **Mô tả**: Mở thư mục logs hoặc crash-reports.
- **Trả về**: `Promise<boolean>`

---

## 22. Playtime & In-game Statistics

### `stats:get-full-profile`
- **Phương thức Frontend**: `window.launcherApi.getFullProfileStats(gameDir, profileId, profileName?)`
- **Mô tả**: Lấy thống kê đầy đủ của profile (playtime, mining, mob, travel).
- **Trả về**: `Promise<ProfileFullStats>`

### `stats:record-session`
- **Phương thức Frontend**: `window.launcherApi.recordPlaySession(gameDir, profileId, durationSeconds, exitCode?)`
- **Mô tả**: Ghi nhận phiên chơi mới.
- **Trả về**: `Promise<ProfileLauncherStats>`

### `stats:open-folder`
- **Phương thức Frontend**: `window.launcherApi.openStatsFolder(gameDir?, worldFolder?)`
- **Mô tả**: Mở thư mục stats.
- **Trả về**: `Promise<boolean>`

---

## 23. JVM Optimizer & Cache Cleaner

### `optimizer:get-presets`
- **Phương thức Frontend**: `window.launcherApi.getJvmPresets()`
- **Mô tả**: Lấy danh sách JVM preset tối ưu.
- **Trả về**: `Promise<JvmPresetInfo[]>`

### `optimizer:scan-cache`
- **Phương thức Frontend**: `window.launcherApi.scanCache(gameDir?)`
- **Mô tả**: Quét cache game (logs, crash reports, temp files).
- **Trả về**: `Promise<CacheScanResult>`

### `optimizer:clean-cache`
- **Phương thức Frontend**: `window.launcherApi.cleanCache(gameDir?, targetKeys?)`
- **Mô tả**: Dọn dẹp cache đã quét.
- **Trả về**: `Promise<CacheCleanResult>`

### `optimizer:optimize-video-settings`
- **Phương thức Frontend**: `window.launcherApi.optimizeInGameVideoSettings(options)`
- **Mô tả**: Tối ưu cài đặt video trong game (options.txt).
- **Trả về**: `Promise<OptimizeVideoSettingsResult>`

### `optimizer:check-low-end-status`
- **Phương thức Frontend**: `window.launcherApi.checkLowEndOptimizationStatus(gameDir?)`
- **Mô tả**: Kiểm tra trạng thái tối ưu cho máy cấu hình thấp.
- **Trả về**: `Promise<LowEndBoostCheckResult>`

### `optimizer:install-essential-mod`
- **Phương thức Frontend**: `window.launcherApi.installEssentialMod(gameDir, modSlug, mcVersion?, loader?)`
- **Mô tả**: Cài đặt mod tối ưu hiệu năng (Sodium, Lithium, etc.).
- **Trả về**: `Promise<InstallEssentialModResult>`

### `optimizer:install-all-essential-mods`
- **Phương thức Frontend**: `window.launcherApi.installAllMissingEssentialMods(gameDir, mcVersion?, loader?)`
- **Mô tả**: Cài đặt tất cả mod tối ưu còn thiếu.
- **Trả về**: `Promise<InstallAllEssentialModsResult>`

---

## 24. Utilities

### `utils:read-local-image-base64`
- **Phương thức Frontend**: `window.launcherApi.readLocalImageBase64(filePath: string)`
- **Mô tả**: Đọc file ảnh local và trả về base64 string.
- **Trả về**: `Promise<string | null>`

### `getPathForFile` (Preload-only, không qua IPC)
- **Phương thức Frontend**: `window.launcherApi.getPathForFile(file: File)`
- **Mô tả**: Lấy đường dẫn thực của File object (sử dụng `webUtils.getPathForFile`).
- **Trả về**: `string | null`
