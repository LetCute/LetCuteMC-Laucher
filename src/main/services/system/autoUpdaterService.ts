import { app, BrowserWindow } from 'electron'

// electron-updater is lazy-loaded to reduce startup cost
let _autoUpdater: typeof import('electron-updater').autoUpdater | null = null
async function getAutoUpdater() {
  if (!_autoUpdater) {
    const { autoUpdater } = await import('electron-updater')
    _autoUpdater = autoUpdater
  }
  return _autoUpdater
}

export async function initAutoUpdater() {
  const autoUpdater = await getAutoUpdater()
  // Config autoUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // We can configure logger here if we want (e.g., electron-log)
  // autoUpdater.logger = log
  // autoUpdater.logger.transports.file.level = 'info'

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent('update-checking', 'Đang kiểm tra cập nhật...')
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdateEvent('update-available', 'Đã tìm thấy bản cập nhật mới! Đang tải xuống...', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateEvent('update-not-available', 'Bạn đang dùng phiên bản mới nhất.', info)
  })

  autoUpdater.on('error', (err) => {
    sendUpdateEvent('update-error', 'Lỗi khi kiểm tra cập nhật.', err.message)
    console.error('[AutoUpdater] Lỗi:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateEvent('update-progress', 'Đang tải bản cập nhật...', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent('update-downloaded', 'Đang cài đặt bản cập nhật...', info)
  })
}

export async function checkForUpdates() {
  if (!app.isPackaged) {
    sendUpdateEvent('update-not-available', 'Đang ở chế độ lập trình, bỏ qua kiểm tra.')
    return Promise.resolve(null)
  }

  const autoUpdater = await getAutoUpdater()
  return autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[AutoUpdater] Lỗi khi checkForUpdatesAndNotify:', err)
    sendUpdateEvent('update-error', 'Lỗi kiểm tra cập nhật.', err.message)
    return null
  })
}

export async function quitAndInstallUpdate() {
  console.log('[AutoUpdater] Cài đặt bản cập nhật và khởi động lại...')
  const autoUpdater = await getAutoUpdater()
  autoUpdater.quitAndInstall(true, true)
}

function sendUpdateEvent(type: string, message: string, data?: any) {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('auto-update:status', { type, message, data })
  }
}
