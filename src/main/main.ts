import { app, BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import isDev from 'electron-is-dev'

// Suppress deprecated punycode warning from third-party dependencies
process.noDeprecation = true

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

// Trên Linux (đặc biệt là máy ảo), việc tắt hẳn Hardware Acceleration có thể gây lỗi trong suốt cửa sổ.
// Thay vào đó, ta dùng cờ ignore-gpu-blocklist để ép bật WebGL bằng software rendering (SwiftShader).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
}

// Giới hạn RAM V8 và tối ưu Chromium Process
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256')
app.commandLine.appendSwitch('disable-gpu-process-crash-limit')

let mainWindow: BrowserWindow | null = null
let isGameRunningFn: (() => boolean) | null = null
let isLauncherHiddenForGameFn: (() => boolean) | null = null

// Hide default menu bar (File / Edit / View / Help)
Menu.setApplicationMenu(null)

function getPreloadPath(): string {
  // Conforms to outDir: "dist-electron"
  return path.join(__dirname, 'preload.js')
}

function shouldKeepAliveForGame(): boolean {
  return Boolean(isGameRunningFn?.() || isLauncherHiddenForGameFn?.())
}

export function trimLauncherMemory(): void {
  if (global.gc) {
    try {
      global.gc()
    } catch { }
  }
}

function createWindow(): void {
  // Icon: dev uses src/public, prod uses dist-electron/main (copied by build)
  const iconPath = isDev
    ? path.join(__dirname, '../../public/logo.png')
    : path.join(__dirname, 'logo.png')

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    resizable: false,
    maximizable: false,
    title: 'LetCuteMC',
    icon: iconPath,
    backgroundColor: '#1c2127',
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Chặn điều hướng hoặc mở popup trái phép, chỉ mở link ngoài bằng trình duyệt hệ thống nếu là https/http
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void import('electron').then(({ shell }) => shell.openExternal(url))
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isDev && (url.startsWith('http://127.0.0.1:5173') || url.startsWith('http://localhost:5173'))) {
      return
    }
    e.preventDefault()
  })

  mainWindow.webContents.on('will-attach-webview', (e) => {
    e.preventDefault()
  })

  // While MC runs: X / close → hide to background (keep process alive to detect MC exit)
  mainWindow.on('close', (e) => {
    if (!shouldKeepAliveForGame()) return
    e.preventDefault()
    mainWindow?.hide()
    mainWindow?.setSkipTaskbar(true)
  })

  mainWindow.webContents.on('console-message', (event: any) => {
    console.log(`[Renderer] ${event.message} (${event.sourceId}:${event.line})`)
  })

  if (isDev) {
    void mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  // dist/renderer/index.html relative to dist-electron/main/main.js
  const rendererPath = path.join(__dirname, '../../dist/renderer/index.html')
  void mainWindow.loadFile(rendererPath)
}

app.whenReady().then(() => {
  // Paint window first — register heavy IPC after
  createWindow()

  void Promise.all([
    import('./ipc/index'),
    import('./services/launcher/launchManager'),
  ]).then(([{ registerIpcHandlers }, launchManager]) => {
    registerIpcHandlers()
    isGameRunningFn = launchManager.isGameRunning
    isLauncherHiddenForGameFn = launchManager.isLauncherHiddenForGame
  })

  import('./services/system/discordRpcService').then(m => m.initDiscordRpc().catch(console.error))
  import('./services/system/autoUpdaterService').then(m => {
    m.initAutoUpdater()
    // Update check is now triggered manually by the renderer via IPC
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      return
    }
    if (!mainWindow || mainWindow.isDestroyed() || isGameRunningFn?.()) return
    mainWindow.setSkipTaskbar(false)
    mainWindow.show()
  })
})

app.on('window-all-closed', () => {
  // Don't quit while MC is running (window only hidden)
  if (shouldKeepAliveForGame()) return
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  import('./services/system/discordRpcService').then(m => m.stopDiscordRpc().catch(console.error))
})
