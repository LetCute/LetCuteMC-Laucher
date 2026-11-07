import { app, BrowserWindow } from 'electron'
import os from 'node:os'
import * as path from 'path'
import * as fs from 'fs'

// electron-updater is lazy-loaded to reduce startup cost
let _autoUpdater: typeof import('electron-updater').autoUpdater | null = null
let skippedVersion: string | null = null
let lastDownloadedVersion: string | null = null

function getPendingDir(): string {
  const cacheBase =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Caches')
        : process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')

  return path.join(cacheBase, 'letcutemc-updater', 'pending')
}

function getAttemptFilePath(): string {
  return path.join(app.getPath('userData'), 'last-update-attempt.json')
}

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '').split('-')[0] || ''
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

function isOlderOrEqualVersion(testVersion: string, currentVersion: string): boolean {
  const [a1, a2, a3] = parseSemver(testVersion)
  const [b1, b2, b3] = parseSemver(currentVersion)
  if (a1 !== b1) return a1 < b1
  if (a2 !== b2) return a2 < b2
  return a3 <= b3
}

async function getAutoUpdater() {
  if (!_autoUpdater) {
    const { autoUpdater } = await import('electron-updater')
    _autoUpdater = autoUpdater
  }
  return _autoUpdater
}

// Xoa pending update neu version da cai = version pending, hoac don dep neu update truoc do that bai
function cleanStalePendingUpdate() {
  const attemptFile = getAttemptFilePath()
  const pendingDir = getPendingDir()

  // 1. Kiem tra lan thu cai dat truoc do co that bai hay khong
  if (fs.existsSync(attemptFile)) {
    try {
      const content = fs.readFileSync(attemptFile, 'utf-8')
      const attempt = JSON.parse(content)
      const isRecent = attempt.time && Date.now() - attempt.time < 15 * 60 * 1000

      if (isRecent && attempt.version && attempt.version !== app.getVersion()) {
        console.warn(`[AutoUpdater] Phat hien cap nhat len v${attempt.version} that bai. Bo qua de tranh lap.`)
        skippedVersion = attempt.version
        if (fs.existsSync(pendingDir)) {
          fs.rmSync(pendingDir, { recursive: true, force: true })
        }
      }
    } catch (e) {
      console.warn('[AutoUpdater] Loi khi doc last-update-attempt:', e)
    } finally {
      try {
        if (fs.existsSync(attemptFile)) {
          fs.unlinkSync(attemptFile)
        }
      } catch {}
    }
  }

  // 2. Don pending update cu neu ban hien tai da cao hon hoac bang ban trong pending
  try {
    if (fs.existsSync(pendingDir)) {
      const infoPath = path.join(pendingDir, 'update-info.json')
      let pendingVersion = ''

      if (fs.existsSync(infoPath)) {
        try {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
          const fileName: string = info.fileName || ''
          const match = fileName.match(/-(\d+\.\d+\.\d+)-/)
          if (match && match[1]) {
            pendingVersion = match[1]
          } else if (info.version) {
            pendingVersion = info.version
          }
        } catch {}
      }

      if (pendingVersion && isOlderOrEqualVersion(pendingVersion, app.getVersion())) {
        console.log(`[AutoUpdater] Don dep cache update cu (v${pendingVersion} <= v${app.getVersion()})`)
        fs.rmSync(pendingDir, { recursive: true, force: true })
      }
    }
  } catch (err) {
    console.warn('[AutoUpdater] Loi khi don pending update:', err)
  }
}

export async function initAutoUpdater() {
  cleanStalePendingUpdate()
  const autoUpdater = await getAutoUpdater()

  // Config autoUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent('update-checking', 'Đang kiểm tra cập nhật...')
  })

  autoUpdater.on('update-available', (info) => {
    if (skippedVersion && info.version === skippedVersion) {
      console.warn(`[AutoUpdater] Bo qua v${info.version} do da that bai o lan cai truoc.`)
      sendUpdateEvent('update-not-available', 'Bỏ qua bản cập nhật bị lỗi trước đó, tiếp tục vào launcher.', info)
      return
    }
    sendUpdateEvent('update-available', 'Tìm thấy bản cập nhật mới. Đang tải về...', info)
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
    if (skippedVersion && info.version === skippedVersion) {
      sendUpdateEvent('update-not-available', 'Bỏ qua bản cập nhật bị lỗi trước đó, tiếp tục vào launcher.', info)
      return
    }
    lastDownloadedVersion = info?.version || null
    sendUpdateEvent('update-downloaded', 'Đã tải xong bản cập nhật. Chuẩn bị cài đặt...', info)
  })
}

export async function checkForUpdates() {
  cleanStalePendingUpdate()

  if (!app.isPackaged) {
    console.log('[AutoUpdater] Bo qua kiem tra cap nhat o moi truong dev.')
    sendUpdateEvent('update-not-available', 'Chế độ dev: không kiểm tra cập nhật.')
    return null
  }

  const autoUpdater = await getAutoUpdater()
  return autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    console.error('[AutoUpdater] Loi khi checkForUpdatesAndNotify:', err)
    const errorMsg = err instanceof Error ? err.message : String(err)
    sendUpdateEvent('update-error', 'Lỗi kiểm tra cập nhật.', errorMsg)
    return null
  })
}

export async function quitAndInstallUpdate() {
  console.log('[AutoUpdater] Cai dat ban cap nhat va khoi dong lai...')

  try {
    const pendingDir = getPendingDir()
    const infoPath = path.join(pendingDir, 'update-info.json')
    let targetVersion = lastDownloadedVersion || ''

    if (!targetVersion && fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
        const match = (info.fileName || '').match(/-(\d+\.\d+\.\d+)-/)
        if (match && match[1]) {
          targetVersion = match[1]
        } else if (info.version) {
          targetVersion = info.version
        }
      } catch {}
    }

    if (targetVersion) {
      fs.writeFileSync(
        getAttemptFilePath(),
        JSON.stringify({
          version: targetVersion,
          time: Date.now()
        }),
        'utf-8'
      )
    }
  } catch (err) {
    console.warn('[AutoUpdater] Loi ghi nhan lan thu cai update:', err)
  }

  const autoUpdater = await getAutoUpdater()
  autoUpdater.quitAndInstall(true, true)
}

function sendUpdateEvent(type: string, message: string, data?: any) {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0 && wins[0]) {
    wins[0].webContents.send('auto-update:status', { type, message, data })
  }
}