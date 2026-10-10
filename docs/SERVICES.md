# Backend Services & Workers Reference (`src/main/services/`)

Tài liệu tra cứu nhanh 44 backend services và 2 utility workers của LetCuteMC Launcher.

---

## Mục Lục Nhanh (Quick Index)

- [1. Auth Services](#1-auth-services-srcmainservicesauth) (3)
- [2. Content Services](#2-content-services-srcmainservicescontent) (8)
- [3. Launcher Services](#3-launcher-services-srcmainserviceslauncher) (11)
- [4. Media Services](#4-media-services-srcmainservicesmedia) (7)
- [5. Profile Services](#5-profile-services-srcmainservicesprofile) (2)
- [6. System Services](#6-system-services-srcmainservicessystem) (11)
- [7. Root Services](#7-root-services-srcmainservices) (2)
- [8. Utility Workers](#8-utility-workers-srcmainworkers) (2)

---

## 1. Auth Services (`src/main/services/auth/`)

### `accountService.ts`
- **Nhiệm vụ**: CRUD tài khoản người dùng (`accounts.json`), chọn tài khoản active, mã hóa token.
- **Hàm chính**:
  - `getAccountState()`: Lấy state danh sách tài khoản và active account ID.
  - `selectAccount(accountId)`: Đổi active account.
  - `addLocalAccount(username)`: Tạo tài khoản offline, sinh UUID v3 offline chuẩn Mojang.
  - `removeAccount(accountId)`: Xóa tài khoản.
  - `renameAccountLocally(accountId, newName)`: Đổi tên hiển thị local.
  - `saveLocalSkin(accountId, skinUrl, skinModel, capeUrl)`: Lưu custom skin/cape offline.
  - `saveMicrosoftAccount(account)`: Lưu thông tin Microsoft OAuth.
  - `refreshMicrosoftAccountToken(accountId)`: Refresh token khi hết hạn.
  - `generateOfflineUuid(username)`: Tạo UUID offline deterministically (`OfflinePlayer:<username>`).

### `microsoftAuthService.ts`
- **Nhiệm vụ**: Xác thực Microsoft OAuth2 PKCE cho Minecraft bản quyền.
- **Hàm chính**:
  - `loginWithMicrosoft()`: Mở flow login browser, lắng nghe callback qua local HTTP server (port 53248).
  - Trao đổi auth code lấy Live token -> Xbox Live token (XBL) -> XSTS token -> Mojang access token -> Minecraft profile.

### `mojangApiService.ts`
- **Nhiệm vụ**: Gọi trực tiếp REST API chính thức của Mojang.
- **Hàm chính**:
  - `fetchMojangProfile(accessToken)`: Lấy UUID, username, skins, capes hiện hành.
  - `uploadMojangSkin(accessToken, fileBuffer, variant)`: Tải skin mới lên Mojang servers.
  - `changeMojangCape(accessToken, capeId)`: Đổi active cape hoặc tắt cape.
  - `checkMojangNameChange(accessToken)`: Kiểm tra quyền và thời gian được phép đổi tên.
  - `changeMojangName(accessToken, newName)`: Thực hiện đổi tên Minecraft.

---

## 2. Content Services (`src/main/services/content/`)

### `gameContentService.ts`
- **Nhiệm vụ**: Quét, bật/tắt, xóa, import mods, resourcepacks, shaderpacks.
- **Hàm chính**:
  - `scanGameContent(gameDir)`: Quét tổng hợp cả 3 loại content.
  - `scanMods(gameDir)`, `scanResourcePacks(gameDir)`, `scanShaderPacks(gameDir)`: Quét từng loại riêng biệt.
  - `getModMetadata(jarPath)`: Đọc `.jar` trích xuất `fabric.mod.json`, `quilt.mod.json`, `mods.toml`, `mcmod.info`.
  - `enableGameContent(itemPath)` / `disableGameContent(itemPath)`: Toggle đuôi `.disabled`.
  - `deleteGameContent(gameDir, itemPath)`: Xóa file khỏi ổ đĩa.
  - `importGameContent(input)`: Copy file từ ngoài vào thư mục tương ứng.

### `modConflictService.ts`
- **Nhiệm vụ**: Phân tích xung đột mod (mod trùng duplicate ID, mod không tương thích, mod sai loader/MC version).
- **Hàm chính**:
  - `ModConflictService.checkConflicts(gameDir, mcVersion, loader)`: Quét và trả về danh sách xung đột.
  - `resolveConflict(gameDir, option)`: Xử lý xung đột (tắt mod cũ, giữ mod mới).
  - `resolveAllCritical(gameDir, conflicts)`: Tự động vô hiệu hóa toàn bộ mod gây crash critical.

### `modDependencyService.ts`
- **Nhiệm vụ**: Phân tích dependency graph giữa các mod, tự động tải dependency thiếu từ Modrinth.
- **Hàm chính**:
  - `inspectModDependencies(gameDir, mcVersion, loader)`: Đọc manifest từng mod, đối chiếu mod đã cài, tìm dependencies thiếu hoặc incompatible.
  - `autoFixModDependencies(gameDir, mcVersion, loader)`: Gọi Modrinth API tìm version tương thích của dependency thiếu và tự động tải về thư mục `mods/`.

### `modLoaderService.ts`
- **Nhiệm vụ**: Tra cứu và cài đặt mod loader (Fabric, Quilt, Forge, NeoForge).
- **Hàm chính**:
  - `getFabricVersions()`, `getQuiltVersions()`, `getForgeVersions()`, `getNeoForgeVersions()`: Lấy danh sách loader versions từ API chính thức / meta.
  - `installFabric(...)`, `installQuilt(...)`: Cài đặt qua meta API, sinh JSON profile tương ứng.
  - `installForge(...)`, `installNeoForge(...)`: Tải installer jar, phân giải client libraries.

### `modrinthService.ts`
- **Nhiệm vụ**: Client kết nối Modrinth API v2 (tải modpack, mod, shader, resourcepack).
- **Hàm chính**:
  - `searchModrinth(options)`: Tìm kiếm project với bộ lọc loader, game version, project type.
  - `getModrinthVersions(projectId)`: Lấy danh sách version release.
  - `installModrinthModpack(versionId, profileName)`: Tải `.mrpack`, giải nén overrides, tự động tạo profile mới và tải dependencies.
  - `installLocalModrinthModpack(mrpackPath, profileName)`: Cài đặt từ file `.mrpack` có sẵn trên máy.
  - `installModrinthMod(versionId, gameDir)`: Tải mod từ Modrinth vào thư mục game.

### `modUpdaterService.ts`
- **Nhiệm vụ**: Kiểm tra cập nhật mod tự động dựa trên SHA-1 hash và Modrinth version endpoint.
- **Hàm chính**:
  - `checkForModUpdates(gameDir, mcVersion, loader)`: Băm SHA-1 các file mod local, đối chiếu Modrinth API xem có bản build mới hơn không.
  - `updateSingleMod(gameDir, item)`: Tải bản mới, xóa/disable bản cũ.
  - `updateAllMods(gameDir, items)`: Cập nhật toàn bộ mod có bản mới cùng lúc.

### `preLaunchIntegrityService.ts`
- **Nhiệm vụ**: Kiểm tra tính toàn vẹn trước khi cho phép khởi chạy game.
- **Hàm chính**:
  - `runPreLaunchIntegrityCheck(input, profile)`: Kiểm tra file jar phiên bản, libraries cốt lõi, classpath và xung đột mod nghiêm trọng để ngăn chặn crash ngay từ đầu.

### `skinIntegrationService.ts`
- **Nhiệm vụ**: Tích hợp CustomSkinLoader vào phiên bản game để hiển thị skin cho tài khoản offline và skin custom.
- **Hàm chính**:
  - `setupCustomSkinLoaderForLaunch(gameDir, account, loader)`: Chuẩn bị file cấu hình CSL (`CustomSkinLoader.json`), đảm bảo skin CDN được định tuyến chính xác trong runtime game.

---

## 3. Launcher Services (`src/main/services/launcher/`)

### `crashDiagnostic.ts`
- **Nhiệm vụ**: Phân tích lỗi khi Minecraft bị crash (exit code khác 0, crash-reports).
- **Hàm chính**:
  - `diagnoseAndRecoverCrash(gameDir, exitCode, logLines)`: Quét log và crash report gần nhất, nhận diện nguyên nhân phổ biến (thiếu RAM, sai Java, xung đột mod cụ thể, driver GPU), đưa ra gợi ý giải quyết.

### `javaScannerService.ts`
- **Nhiệm vụ**: Dò tìm toàn bộ bản Java cài đặt trên máy người dùng.
- **Hàm chính**:
  - `scanJavaRuntimes(customScanDirs, forceRefresh)`: Quét Registry Windows, PATH, Program Files, JAVA_HOME, runtime thư mục managed.
  - `selectBestJavaRuntime(mcVersion, customScanDirs, options)`: Tự động chọn Java phù hợp theo version Minecraft:
    - MC < 1.17 -> Java 8
    - MC 1.17 - 1.17.1 -> Java 16
    - MC 1.18 - 1.20.4 -> Java 17
    - MC 1.20.5 - 1.25.x -> Java 21
    - MC >= 26 -> Java 25
  - `verifyJavaPath(javaPath, requiredMajor)`: Kiểm tra tính tồn tại và version major thực tế của file java.exe.

### `javaInstallerService.ts`
- **Nhiệm vụ**: Tự động tải và cài đặt OpenJDK (Temurin / Adoptium) vào thư mục `managed-java/`.
- **Hàm chính**:
  - `autoInstallJava(majorVersion, targetDir)`: Tải file nén Java runtime theo kiến trúc OS/CPU, giải nén atomic, cấp quyền thực thi.
  - `getDefaultJavaInstallDir()`: Trả về đường dẫn `managed-java/` trong launcher storage.

### `javaResolver.ts`
- **Nhiệm vụ**: Điều phối và giải quyết runtime Java cuối cùng trước khi launch hoặc worker chạy.
- **Hàm chính**:
  - `ensureJavaRuntime(options)`: Kết hợp giữa cấu hình profile, kết quả scan, và tự động gọi `javaInstallerService` nếu máy chưa có Java tương thích.

### `launchManager.ts`
- **Nhiệm vụ**: Điều phối toàn bộ vòng đời khởi chạy game, fork `launchWorker.ts`, theo dõi trạng thái.
- **Hàm chính**:
  - `safeStartLaunchJob(input)`: Kiểm tra trạng thái hiện tại, chuẩn bị input, fork `launchWorker` qua `utilityProcess.fork`.
  - `cancelLaunchJob()`: Hủy tiến trình launch đang chờ hoặc dừng worker.
  - `getLaunchState()`: Trả về `LaunchJobState` hiện tại (status, progress, logs buffer).
  - `clearJobLogs()`: Dọn dẹp log buffer của job hiện tại.
  - `isGameRunning()`: Boolean kiểm tra game Minecraft có đang chạy không.

### `minecraftDirectoryService.ts`
- **Nhiệm vụ**: Dò tìm thư mục `.minecraft` mặc định theo từng hệ điều hành.
- **Hàm chính**:
  - `detectMinecraftDirectory()`: Tự động phát hiện `%APPDATA%/.minecraft` trên Windows, `~/Library/Application Support/minecraft` trên macOS, `~/.minecraft` trên Linux.

### `minecraftScannerService.ts`
- **Nhiệm vụ**: Quét toàn diện thông tin một thư mục game Minecraft.
- **Hàm chính**:
  - `scanMinecraftDirectory(gameDir)`: Trả về danh sách version đã cài local, số lượng mods, saves, resourcepacks hiện diện.

### `prepareGameService.ts`
- **Nhiệm vụ**: Quản lý quy trình kiểm tra và tải tệp trước khi chơi, fork `prepareWorker.ts`.
- **Hàm chính**:
  - `checkPreparedProfile(profile, settings)`: Kiểm tra nhanh xem phiên bản đã đầy đủ file chưa hay cần tải thêm.
  - `prepareGameFiles(profile, settings, forceRepair)`: Fork `prepareWorker` qua `utilityProcess.fork` để hash và tải song song.
  - `cancelPrepareGame()`: Hủy tiến trình prepare.
  - `clearPreparedProfilesCache()`: Xóa bộ nhớ đệm trạng thái prepared.

### `versionManifestCacheService.ts`
- **Nhiệm vụ**: Cache tệp `version_manifest_v2.json` từ Mojang tránh gọi mạng liên tục.
- **Hàm chính**:
  - `getCachedVersionManifest(ttlMs)`: Đọc cache local nếu còn hạn, nếu hết hạn tải mới và ghi đè.
  - `clearVersionManifestCache()`: Xóa cache bắt buộc tải lại.

### `versionResolver.ts`
- **Nhiệm vụ**: Phân giải chi tiết tệp JSON phiên bản, xử lý kế thừa (inheritsFrom), xây dựng danh sách libraries và JVM arguments.
- **Hàm chính**:
  - `ensureVersionMetadata(gameDir, versionId)`: Tải/đọc version JSON, resolve chain kế thừa (ví dụ Fabric kế thừa Vanilla).
  - `ensureLibrariesAndAssets(...)`: Tạo danh sách libraries cần tải, lọc theo OS rule (`allow`/`disallow`).

### `versionService.ts`
- **Nhiệm vụ**: Cung cấp danh mục phiên bản Minecraft tổng hợp cho UI chọn lựa.
- **Hàm chính**:
  - `getMinecraftVersionCatalog(gameDir)`: Tổng hợp các bản Release, Snapshot, Beta, Alpha từ Mojang và các bản cài thủ công trong thư mục `versions/`.

---

## 4. Media Services (`src/main/services/media/`)

### `errorLogService.ts`
- **Nhiệm vụ**: Ghi nhận và lưu trữ log lỗi nội bộ của launcher.
- **Hàm chính**:
  - `writeErrorLog(category, error, context)`: Ghi log có format thời gian và stack trace vào `error-logs/`.
  - `getErrorLogDirectory()`: Trả về đường dẫn thư mục lưu error log.

### `lanDiscoveryService.ts`
- **Nhiệm vụ**: Tự động phát hiện các server Minecraft mở qua tính năng "Open to LAN" trong mạng nội bộ.
- **Hàm chính**:
  - `LanDiscoveryService.start()`: Bind socket UDP lắng nghe multicast tại `224.0.2.60:4445`.
  - `getDiscoveredServers()`: Trả về danh sách IP, port và MOTD của LAN servers đang online.
  - `stop()`: Đóng socket khi không dùng.

### `logService.ts`
- **Nhiệm vụ**: Quản lý tệp nhật ký game và crash reports.
- **Hàm chính**:
  - `listLogFiles(gameDir)`: Liệt kê các file trong `logs/` và `crash-reports/`.
  - `readLogFile(filePath)`: Đọc nội dung file log (hỗ trợ cả `.log` và `.log.gz`).
  - `uploadLogToMclogs(content)`: Đăng tải nội dung log lên dịch vụ `mclo.gs` để lấy link chia sẻ.
  - `clearOldLogs(gameDir)`: Dọn dẹp các file log cũ để giải phóng dung lượng.

### `screenshotService.ts`
- **Nhiệm vụ**: Quản lý thư viện ảnh chụp màn hình trong game.
- **Hàm chính**:
  - `scanScreenshots(gameDir)`: Quét toàn bộ ảnh trong `screenshots/`, sắp xếp theo thời gian mới nhất.
  - `copyScreenshotToClipboard(filePath)`: Đọc ảnh và đưa vào clipboard hệ thống.
  - `deleteScreenshot(filePath)` / `deleteMultipleScreenshots(filePaths)`: Xóa ảnh đơn hoặc hàng loạt.
  - `showScreenshotInFolder(filePath)`: Mở File Explorer focus vào ảnh.

### `serverListService.ts`
- **Nhiệm vụ**: Quản lý danh sách server Minecraft và inject server vào game.
- **Hàm chính**:
  - `getPinnedServers()`: Lấy danh sách server đối tác / server gợi ý.
  - `injectTopServers(profileId, servers)`: Đọc và ghi file `servers.dat` (định dạng NBT) của profile để thêm server vào danh sách in-game.

### `statsService.ts`
- **Nhiệm vụ**: Đọc thống kê in-game từ file `stats/*.json` trong saves.
- **Hàm chính**:
  - `getFullProfileStats(gameDir, profileId)`: Tổng hợp giờ chơi, số khối đã đào, số mob đã tiêu diệt, quãng đường di chuyển.
  - `recordPlaySession(gameDir, profileId, durationSeconds, exitCode)`: Ghi nhận thời gian chơi của phiên vừa kết thúc.

### `worldService.ts`
- **Nhiệm vụ**: Quản lý các thế giới (saves) của Minecraft.
- **Hàm chính**:
  - `scanWorlds(gameDir)`: Quét các thư mục trong `saves/`, đọc `level.dat` (NBT) lấy tên world, gamemode, last played, icon.
  - `backupWorld(gameDir, folderName)`: Đóng gói world thành tệp ZIP lưu vào `backups/`.
  - `restoreWorldBackup(...)`: Giải nén khôi phục world từ bản backup.
  - `duplicateWorld(...)`: Sao chép nhân bản world.
  - `renameWorld(gameDir, folderName, newLevelName)`: Sửa tên hiển thị của world trực tiếp trong file `level.dat`.
  - `exportWorldZip(...)` / `importWorldZip(...)`: Xuất/nhập file ZIP world chia sẻ.

---

## 5. Profile Services (`src/main/services/profile/`)

### `profileService.ts`
- **Nhiệm vụ**: Quản lý các hồ sơ cấu hình chơi Minecraft (`profiles.json`).
- **Hàm chính**:
  - `getProfiles()`: Lấy danh sách profiles và ID profile đang chọn.
  - `createProfile(input)`: Tạo profile mới với các thiết lập phiên bản, RAM, gameDir riêng.
  - `updateProfile(profileId, input)`: Cập nhật thông tin profile.
  - `deleteProfile(profileId)`: Xóa profile.
  - `setActiveProfile(profileId)`: Chọn profile mặc định để khởi chạy.

### `profilePackageService.ts`
- **Nhiệm vụ**: Xuất/nhập trọn gói profile thành tệp định dạng `.letcutepack` (ZIP nén).
- **Hàm chính**:
  - `exportProfilePackage(options)`: Đóng gói profile JSON, danh sách mods, configs, resourcepacks vào tệp `.letcutepack`.
  - `readProfilePackageInfo(packageFilePath)`: Đọc thông tin xem trước (tên pack, tác giả, icon, danh sách mods) trước khi import.
  - `importProfilePackage(packageFilePath, customName)`: Giải nén và tự động tạo profile mới đầy đủ dữ liệu từ file pack.

---

## 6. System Services (`src/main/services/system/`)

### `autoUpdaterService.ts`
- **Nhiệm vụ**: Kiểm tra và cập nhật launcher tự động qua `electron-updater`.
- **Hàm chính**:
  - `initAutoUpdater()`: Khởi tạo cấu hình và lắng nghe các event update.
  - `checkForUpdates()`: Kiểm tra xem có bản release mới trên GitHub/Server không.
  - `quitAndInstallUpdate()`: Khởi động lại launcher để áp dụng bản cập nhật.

### `discordRpcService.ts`
- **Nhiệm vụ**: Tích hợp Discord Rich Presence hiển thị trạng thái đang chơi trên Discord profile.
- **Hàm chính**:
  - `initDiscordRpc()`: Kết nối với Discord Client local.
  - `setCustomActivity(details, state)`: Cập nhật thông tin phiên bản, thời gian đã chơi.
  - `stopDiscordRpc()`: Đóng kết nối khi tắt launcher.

### `downloadManager.ts`
- **Nhiệm vụ**: Quản lý tải tệp đa luồng, xử lý retry, file tạm `.part` và xác minh SHA-1.
- **Hàm chính**:
  - `downloadTasks(tasks, options)`: Thực thi danh sách tác vụ tải song song theo `concurrency`, phát emit tiến độ tổng hợp, đổi tên atomic sau khi tải xong.

### `httpAgent.ts`
- **Nhiệm vụ**: Cấu hình HTTP Dispatcher tối ưu (`undici`) cho toàn bộ tiến trình tải mạng.
- **Hàm chính**:
  - `initGlobalHttpDispatcher()`: Thiết lập connection pool (64 connections), keep-alive, pipelining tăng tốc độ download.

### `mirrorService.ts`
- **Nhiệm vụ**: Cung cấp các đường link mirror (BMCLAPI) dự phòng cho các tài nguyên Mojang.
- **Hàm chính**:
  - `getUrlCandidates(originalUrl)`: Sinh ra danh sách URL dự phòng (gốc + mirror Asia) để tăng tốc tải và fallback khi bị chặn.

### `optimizerService.ts`
- **Nhiệm vụ**: Bộ công cụ tối ưu hóa hiệu năng game và dọn dẹp hệ thống.
- **Hàm chính**:
  - `getJvmPresets()`: Cung cấp các preset tham số Java tối ưu (Aikar Flags, Shenandoah GC, ZGC, Low-RAM flags).
  - `scanCache(gameDir)` / `cleanCache(gameDir, targetKeys)`: Quét và dọn dẹp các file rác, crash reports cũ, tệp tạm trong thư mục game.
  - `optimizeInGameVideoSettings(options)`: Đọc và tinh chỉnh file `options.txt` để đạt FPS tối đa trên máy yếu.
  - `installEssentialMod(...)`: Tự động tải và cài các mod tối ưu phổ biến (Sodium, Lithium, FerriteCore, Indium).

### `performanceTunerService.ts`
- **Nhiệm vụ**: Tự động đánh giá cấu hình máy và đưa ra gợi ý thiết lập tối ưu.
- **Hàm chính**:
  - `recommendPerformance(systemInfo)`: Phân tích số nhân CPU và RAM hệ thống để tính toán mức RAM cấp phát tối ưu (tránh cấp quá nhiều gây lag GC).
  - `resolveEffectivePerformance(settings, systemInfo)`: Phân giải cấu hình thực tế khi người dùng bật chế độ "Auto Performance".

### `settingsService.ts`
- **Nhiệm vụ**: Quản lý tệp cài đặt chính của launcher (`settings.json`).
- **Hàm chính**:
  - `getSettings()`: Lấy toàn bộ cấu hình hiện tại.
  - `updateSettings(input)`: Cập nhật và lưu cài đặt.
  - `getEffectivePerformanceSettings()`: Lấy cấu hình hiệu năng thực tế đã kết hợp tính toán tự động.

### `storageService.ts`
- **Nhiệm vụ**: Cung cấp các đường dẫn chuẩn và helper thao tác dữ liệu lưu trữ launcher.
- **Hàm chính**:
  - `getLauncherDataDirectory()`: Đường dẫn `%APPDATA%/letcutemc`.
  - `getDefaultMinecraftDirectory()`: Đường dẫn `%APPDATA%/.minecraft`.
  - `ensureLauncherDataDirectory()`: Đảm bảo các thư mục dữ liệu, cache, logs đã được khởi tạo.

### `systemInfoService.ts`
- **Nhiệm vụ**: Thu thập thông tin phần cứng hệ thống (OS, CPU cores, RAM).
- **Hàm chính**:
  - `getSystemPerformanceInfo()`: Trả về số core CPU, tổng RAM (GB), nền tảng OS và phân cấp hiệu năng (low, medium, high).

### `taskManagerService.ts`
- **Nhiệm vụ**: Quản lý hàng đợi và tiến độ các tác vụ chạy nền (Background Tasks).
- **Hàm chính**:
  - `registerTask(...)`, `updateTaskProgress(...)`, `completeTask(...)`, `failTask(...)`: CRUD vòng đời tác vụ.
  - `cancelTask(taskId)`: Hủy tác vụ đang chạy.
  - `getAllTasks()`: Lấy danh sách tác vụ đang chạy/hoàn thành để hiển thị trên màn hình Tasks.

---

## 7. Root Services (`src/main/services/`)

### `eventBus.ts`
- **Nhiệm vụ**: Hệ thống Pub/Sub nội bộ (`AppEventBus`) mở rộng từ Node.js `EventEmitter`.
- **Sự kiện chính**:
  - `game:launching`, `game:started`, `game:exited`, `game:crashed`
  - `profile:updated`, `profile:deleted`
  - Dùng để đồng bộ trạng thái giữa các service mà không tạo liên kết cứng (tight coupling).

### `index.ts`
- **Nhiệm vụ**: Barrel re-export tập trung toàn bộ 44 service để import thuận tiện trong toàn bộ Main process.

---

## 8. Utility Workers (`src/main/workers/`)

Cả 2 worker đều chạy dưới **Electron `utilityProcess`** (forked qua `workerResolver.ts`), hoàn toàn tách biệt khỏi Main Event Loop.

### `prepareWorker.ts`
- **Nhiệm vụ**: Quét cấu trúc phiên bản, kiểm tra mã băm SHA-1 và tải tệp game song song.
- **Luồng xử lý**:
  1. Nhận thông điệp `prepare` qua `parentPort`.
  2. Phân tích version JSON, asset index.
  3. Quét SHA-1 song song hàng nghìn file libraries và assets.
  4. Tự động kiểm tra và tải mod dependencies nếu cần.
  5. Tải tệp thiếu qua file tạm `.part` và đổi tên atomic sau khi khớp hash.
  6. Gửi sự kiện tiến độ phần trăm liên tục về Main process.

### `launchWorker.ts`
- **Nhiệm vụ**: Chuẩn bị môi trường JVM và kích hoạt tiến trình Minecraft độc lập.
- **Luồng xử lý**:
  1. Nhận thông điệp `launch` qua `parentPort`.
  2. Giải nén các thư viện native (`.dll`, `.so`, `.dylib`) vào thư mục tạm.
  3. Xây dựng JVM arguments hoàn chỉnh (Classpath, RAM flags, Auth session tokens, CustomSkinLoader flags).
  4. Kích hoạt tiến trình Java: `child_process.spawn(javaPath, args)`.
  5. Pipe luồng `stdout`/`stderr` từ game, phân tích dòng log, phát hiện exit code và gửi về `launchManager`.
