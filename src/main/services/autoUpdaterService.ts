import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'

export function initAutoUpdater() {
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

export function checkForUpdates() {
  console.log('[AutoUpdater] Kiểm tra bản cập nhật mới...')
  
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Chế độ lập trình (Dev Mode) - Bỏ qua cập nhật.')
    sendUpdateEvent('update-not-available', 'Đang ở chế độ lập trình, bỏ qua kiểm tra.')
    return Promise.resolve(null)
  }

  return autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[AutoUpdater] Lỗi khi checkForUpdatesAndNotify:', err)
    sendUpdateEvent('update-error', 'Lỗi kiểm tra cập nhật.', err.message)
    return null
  })
}

export function quitAndInstallUpdate() {
  console.log('[AutoUpdater] Cài đặt bản cập nhật và khởi động lại...')
  autoUpdater.quitAndInstall()
}

function sendUpdateEvent(type: string, message: string, data?: any) {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('auto-update:status', { type, message, data })
  }
}
