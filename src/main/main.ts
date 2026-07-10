import { app, BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import isDev from 'electron-is-dev'
import { registerIpcHandlers } from './ipc'
import { isGameRunning, isLauncherHiddenForGame } from './services/launchManager'

let mainWindow: BrowserWindow | null = null

// Hide default menu bar (File / Edit / View / Help)
Menu.setApplicationMenu(null)

function getPreloadPath(): string {
  // Conforms to outDir: "dist-electron"
  return path.join(__dirname, 'preload.js')
}

function createWindow(): void {
  // Icon: dev uses src/public, prod uses dist-electron/main (copied by build)
  const iconPath = isDev
    ? path.join(__dirname, '../../public/avatarv2-modified.png')
    : path.join(__dirname, 'avatarv2-modified.png')

  mainWindow = new BrowserWindow({
    width: 960,
    height: 600,
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

  // While MC runs: X / close → hide to background (keep process alive to detect MC exit)
  mainWindow.on('close', (e) => {
    if (isGameRunning() || isLauncherHiddenForGame()) {
      e.preventDefault()
      mainWindow?.hide()
      mainWindow?.setSkipTaskbar(true)
    }
  })

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`)
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
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow && !mainWindow.isDestroyed() && !isGameRunning()) {
      mainWindow.setSkipTaskbar(false)
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit while MC is running (window only hidden)
  if (isGameRunning() || isLauncherHiddenForGame()) return
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
