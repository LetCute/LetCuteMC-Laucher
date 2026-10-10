# LetCuteMC — Architecture & Development Rules

> **Mục tiêu:** Kiến trúc đơn giản, dễ bảo trì, ít abstraction, diff nhỏ và tận dụng tối đa code hiện có.

---

## 1. Priority Rules

Khi thực hiện bất kỳ task nào, ưu tiên theo thứ tự:

1. **Reuse** — Tận dụng code hiện có.
2. **YAGNI** — Không tạo thứ chưa cần.
3. **Shortest Diff** — Sửa ít nhất nhưng phải đúng.
4. **Keep Behavior** — Không phá behavior hiện tại ngoài phạm vi task.
5. **Type Safety** — Shared type phải nhất quán giữa Main và Renderer.
6. **Verify** — Build/typecheck sau khi sửa.

### Nguyên tắc bắt buộc

* Luôn phản hồi bằng tiếng Việt.
* Không viết lại logic đã tồn tại trong `src/main/services/`.
* Kiểm tra `docs/IPC_API.md` trước khi tạo IPC mới.
* Không tạo abstraction chỉ để "đúng kiến trúc".
* Không refactor ngoài phạm vi task.
* Không reformat file không liên quan.
* Không thêm dependency nếu Node.js API hoặc dependency hiện tại đã xử lý được.
* Không đoán API/service hiện tại. **Phải kiểm tra code trước khi sửa.**

---

# 2. Architecture

## 2.1 Dependency Direction

Luồng dependency bắt buộc:

```text
Renderer
(UI / Hooks)
    ↓
window.launcherApi
(Preload / Bridge)
    ↓
IPC Handlers
(src/main/ipc/)
    ↓
Services
(src/main/services/)
    ↓
Workers / Node.js APIs / External APIs
```

### Cấm

```text
Renderer → services
Renderer → Node.js APIs
Renderer → Electron IPC
Services → Renderer
Workers → Renderer
```

Renderer không được import:

```ts
fs
path
crypto
child_process
electron
ipcRenderer
```

Ngoại lệ: `preload.ts` được phép sử dụng Electron IPC và Node.js APIs cần thiết cho bridge.

---

# 3. Project Structure

## 3.1 Main Process

```text
src/main/
├── services/
│   ├── auth/
│   ├── launcher/
│   ├── content/
│   ├── profile/
│   ├── system/
│   └── media/
│
├── workers/
└── ipc/
```

### Auth

```text
services/auth/
├── accountService
├── microsoftAuthService
└── mojangApiService
```

`microsoftAuthService` sử dụng OAuth2 PKCE.

### Launcher

```text
services/launcher/
├── javaScannerService
├── javaInstallerService
├── javaResolver
├── versionService
├── versionResolver
├── versionManifestCacheService
├── prepareGameService
├── launchManager
├── crashDiagnostic
├── minecraftDirectoryService
└── minecraftScannerService
```

### Content

```text
services/content/
├── gameContentService
├── modrinthService
├── modLoaderService
├── modDependencyService
├── modConflictService
├── modUpdaterService
├── preLaunchIntegrityService
└── skinIntegrationService
```

Hỗ trợ:

* Mod
* Resource Pack
* Shader
* Modrinth
* Fabric
* Forge
* NeoForge
* Quilt

### Profile

```text
services/profile/
├── profileService
└── profilePackageService
```

### System

```text
services/system/
├── settingsService
├── storageService
├── optimizerService
├── performanceTunerService
├── downloadManager
├── mirrorService
├── taskManagerService
├── discordRpcService
├── autoUpdaterService
├── httpAgent
└── systemInfoService
```

### Media

```text
services/media/
├── screenshotService
├── worldService
├── serverListService
├── lanDiscoveryService
├── statsService
├── logService
└── errorLogService
```

### Workers

```text
workers/
├── prepareWorker.ts
└── launchWorker.ts
```

`prepareWorker.ts`:

* Quét file.
* Hash SHA-1 song song.
* Download song song.
* Sử dụng `.part`.
* Rename atomic sau khi hoàn tất.

`launchWorker.ts`:

* Chuẩn bị JVM classpath.
* Chuẩn bị native libraries.
* Xây dựng JVM arguments.
* Spawn Minecraft process độc lập.

---

## 3.2 IPC

IPC được đăng ký tập trung thông qua:

```text
src/main/ipc/ipcHelper.ts
```

Các domain IPC:

```text
accountIpc
contentIpc
launchIpc
modrinthIpc
profileIpc
systemIpc
statsIpc
```

IPC Handler chỉ nên:

```text
Validate input
    ↓
Call service
    ↓
Return result
```

Không đưa business logic lớn vào IPC Handler.

---

# 4. Preload / Bridge

File:

```text
src/main/preload.ts
```

Renderer chỉ giao tiếp với Main thông qua:

```ts
window.launcherApi
```

Không gọi:

```ts
ipcRenderer.invoke(...)
ipcRenderer.send(...)
```

trực tiếp trong Renderer.

Shared types đặt tại:

```text
src/shared/types.ts
src/shared/auth.ts
```

Không duplicate type trong Renderer.

---

# 5. Renderer

```text
src/renderer/
├── screens/
├── components/
└── hooks/
```

### Screens

```text
ProfilesScreen
ModsScreen
AccountsScreen
SettingsScreen
VersionsScreen
LogsScreen
SkinsScreen
WorldsScreen
ScreenshotsScreen
OptimizerScreen
```

### Components

Phân chia theo domain:

```text
accounts/
launcher/
mods/
profiles/
ui/
versions/
optimizer/
layout/
common/
```

### Hooks

Hook giao tiếp với backend thông qua `window.launcherApi`:

```text
useAccounts
useGameContent
useLauncherJob
usePrepareGame
useMods
useVersions
useTaskManager
useMinecraftVersions
```

Không tạo thêm Renderer Service Layer nếu chỉ forwarding API.

---

# 6. Feature Workflows

## 6.1 Java Runtime

Java được resolve theo Minecraft version:

```text
Minecraft < 1.17
    → Java 8

Minecraft 1.17 – 1.17.1
    → Java 16

Minecraft 1.18 – 1.20.4
    → Java 17

Minecraft 1.20.5 – 1.25.x
    → Java 21

Minecraft >= 26
    → Java 25
```

Flow:

```text
javaScannerService
        ↓
javaResolver
        ↓
Java tồn tại?
   ├── Yes → tiếp tục
   └── No  → javaInstallerService
```

Java managed được cài vào:

```text
managed-java/
```

---

## 6.2 Prepare Game

```text
prepareGameService
        ↓
prepareWorker
        ↓
downloadManager
        ↓
Download / SHA-1 / .part
        ↓
Atomic rename
```

---

## 6.3 Pre-launch Validation

Trước khi launch:

```text
preLaunchIntegrityService
        +
modDependencyService
        ↓
Validation
        ↓
Launch
```

Kiểm tra:

* File hỏng.
* File thiếu.
* Dependency mod.
* Conflict mod.
* Các điều kiện cần thiết trước launch.

---

## 6.4 Launch

```text
launchManager
      ↓
launchWorker
      ↓
JVM arguments
      ↓
Classpath
      ↓
Native libraries
      ↓
Spawn Minecraft
```

Minecraft chạy dưới process độc lập với launcher.

---

## 6.5 Crash

```text
Minecraft Process
      ↓
logService
      ↓
crashDiagnostic
      ↓
Crash result
```

Không để logic phân tích crash nằm trong Renderer.

---

# 7. Mods / Packs / Shaders

`gameContentService` chịu trách nhiệm đọc metadata từ file game content, bao gồm `.jar`.

Modrinth sử dụng:

```text
modrinthService
```

Các chức năng liên quan:

```text
modrinthService
modUpdaterService
modConflictService
modDependencyService
```

Không tạo lại Modrinth client/API nếu implementation đã tồn tại.

---

# 8. Accounts / Skin

Authentication:

```text
accountService
    ↓
microsoftAuthService
```

Hỗ trợ:

* Microsoft OAuth2 PKCE.
* Offline account.

Skin/Cape:

```text
mojangApiService
+
Custom Skin CDN
```

Không duplicate authentication logic trong Renderer.

---

# 9. Media / Worlds / Servers

```text
screenshotService
→ Screenshot

worldService
→ Minecraft Worlds

serverListService
→ Server list

lanDiscoveryService
→ LAN discovery
```

Renderer chỉ nhận dữ liệu thông qua IPC/Preload.

---

# 10. Zero-Bloat Rules

## 10.1 Không tạo Wrapper rỗng

Không tạo:

```text
SDK
 ↓
Adapter
 ↓
Wrapper
 ↓
Service
```

nếu wrapper chỉ forwarding call.

Nếu SDK/service hiện tại đã đủ dùng:

```text
Use it directly.
```

---

## 10.2 Không Abstraction trước nhu cầu

Không tạo:

```text
interface
Factory
Strategy
Generic
Adapter
Provider
Repository
Manager
```

chỉ vì "sau này có thể cần".

Chỉ abstraction khi có **nhu cầu thực tế hoặc ít nhất hai implementation/behavior khác nhau**.

---

## 10.3 Dependencies

Ưu tiên:

```text
Node.js stdlib
    ↓
Dependencies hiện tại
    ↓
Dependency mới
```

Không thêm package mới nếu vấn đề có thể giải quyết đơn giản bằng:

```text
fs/promises
path
crypto
child_process
```

hoặc dependency đã có trong `package.json`.

---

# 11. Blast Radius

Mỗi task chỉ thay đổi những file cần thiết.

### Không được tự ý:

* Refactor file bên cạnh.
* Rename class không liên quan.
* Reformat code.
* Đổi architecture không liên quan.
* Di chuyển file chỉ vì "đẹp hơn".
* Thay dependency hiện tại.
* Rewrite implementation đang hoạt động.

### Nguyên tắc

> **Task nhỏ → Diff nhỏ.**

Nếu một task có thể giải quyết bằng 1 file thì không sửa 5 file.

---

# 12. Standard Execution Pipeline

Mọi task phải thực hiện theo flow:

```text
1. Inspect
   ↓
2. Check existing service / IPC
   ↓
3. Reuse existing implementation
   ↓
4. Identify smallest correct change
   ↓
5. Modify
   ↓
6. Update shared type if contract changed
   ↓
7. Build / Typecheck
   ↓
8. Stop
```

### Inspect

Trước khi code:

```text
docs/IPC_API.md
src/main/services/
src/main/ipc/
src/main/preload.ts
src/shared/
```

Chỉ đọc những phần liên quan đến task.

### Modify

Sửa đúng layer:

```text
UI
→ src/renderer/

Backend logic
→ src/main/services/

IPC
→ src/main/ipc/

Bridge
→ src/main/preload.ts

Shared contract
→ src/shared/
```

### Verify

Ưu tiên:

```bash
npm run build:renderer
```

hoặc:

```bash
npm run build
```

Nếu project có typecheck riêng, chạy thêm typecheck phù hợp.

### Stop Condition

Sau khi:

```text
Implementation
+
Typecheck / Build
```

đã pass và task đạt yêu cầu:

> **Dừng. Không refactor thêm.**

---

# 13. Definition of Done

Một task được xem là hoàn thành khi:

* Đúng yêu cầu.
* Tận dụng code hiện có.
* Không tạo abstraction không cần thiết.
* Không phá dependency direction.
* Không duplicate type.
* Không thay đổi behavior ngoài phạm vi.
* Diff nhỏ nhất hợp lý.
* Build/typecheck pass.

> **Shortest correct implementation wins.**
