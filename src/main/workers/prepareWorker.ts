import type {
  LauncherProfile,
  LauncherSettings,
  PrepareGameProgress,
  PreparedProfileState,
  LauncherLogLevel,
} from '../../shared/types'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getVersionManifestCacheDir, applyDefaultGameOptions } from '../services/system/storageService'
import { ensureJavaRuntime } from '../services/launcher/javaResolver'
import {
  ensureVersionMetadata,
  syncModpackVersionFolder,
  ensureLibrariesAndAssets,
} from '../services/launcher/versionResolver'
import { writeErrorLog } from '../services/media/errorLogService'
import { autoFixModDependencies, inspectModDependencies, detectLoaderFromVersion } from '../services/content/modDependencyService'
import { initGlobalHttpDispatcher } from '../services/system/httpAgent'

const parentPort: Electron.MessagePortMain | undefined = (process as unknown as { parentPort?: Electron.MessagePortMain }).parentPort
if (!parentPort) {
  throw new Error('prepareWorker must run inside a utilityProcess.')
}

let latestProgressKey = ''

function postLog(level: LauncherLogLevel, message: string): void {
  parentPort?.postMessage({ type: 'log', level, message })
}

function postProgress(
  profileId: string,
  version: string,
  progress: Omit<PrepareGameProgress, 'updatedAt' | 'profileId' | 'version'>
): void {
  const key = `${progress.status}:${Math.floor(progress.percent)}:${progress.message}`
  if (key === latestProgressKey) return
  latestProgressKey = key
  parentPort?.postMessage({
    type: 'progress',
    progress: {
      profileId,
      version,
      ...progress,
      updatedAt: new Date().toISOString(),
    },
  })
}

function postFinished(
  _profileId: string,
  state: PreparedProfileState | null,
  ok: boolean,
  message?: string
): void {
  parentPort?.postMessage({
    type: 'finished',
    ok,
    state,
    message,
  })
}

async function startPrepare(
  profile: LauncherProfile,
  settings: LauncherSettings,
  _forceRepair = false
): Promise<void> {
  initGlobalHttpDispatcher()
  const profileId = profile.id
  const version = profile.minecraftVersion
  const gameDir = profile.gameDir || settings.minecraftDirectory
  const mcRootDir = profile.mcRootDir || settings.minecraftDirectory

  try {
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Kiểm tra phiên bản',
      message: 'Đang nạp manifest phiên bản...',
      percent: 10,
    })
    await fs.mkdir(mcRootDir, { recursive: true })
    await fs.mkdir(getVersionManifestCacheDir(), { recursive: true })

    // 1. Tải version metadata & giải quyết inheritsFrom
    await ensureVersionMetadata(version, mcRootDir, postLog)
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Tải thông tin phiên bản',
      message: 'Đã sẵn sàng metadata phiên bản.',
      percent: 25,
    })

    // 2. Resolve XMCL Version & Tải Libraries / Assets (Client jar được lưu vào đúng version gốc)
    postProgress(profileId, version, {
      status: 'downloading',
      title: 'Kiểm tra thư viện & tài nguyên',
      message: 'Đang xác thực thư viện...',
      percent: 35,
    })
    const { Version } = await import('@xmcl/core')
    let resolved
    try {
      resolved = await Version.parse(mcRootDir, version)
    } catch (parseErr) {
      const errStr = parseErr instanceof Error ? parseErr.message : String(parseErr)
      if (errStr.includes('ENOENT') || errStr.toLowerCase().includes('cannot find')) {
        throw new Error(
          `Không tìm thấy tệp thông tin phiên bản "${version}.json" trong thư mục: ${path.join(mcRootDir, 'versions', version)}. Vui lòng cài lại phiên bản hoặc tải lại qua Mod Loader.`
        )
      }
      throw new Error(`Tệp thông tin phiên bản "${version}.json" bị hỏng hoặc không thể đọc: ${errStr}`)
    }
    await ensureLibrariesAndAssets(resolved, mcRootDir, (percent) => {
      postProgress(profileId, version, {
        status: 'downloading',
        title: 'Tải thư viện & tài nguyên',
        message: `Đang tải tài nguyên (${percent}%)...`,
        percent: 35 + Math.round(percent * 0.35),
      })
    })

    // 3. Modpack version folder sync (Đồng bộ cả metadata và client jar vào gameDir)
    await syncModpackVersionFolder(version, mcRootDir, gameDir, postLog)

    // 4. Java Runtime resolution & Auto-install
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Kiểm tra Java Runtime',
      message: 'Đang xác định Java phù hợp...',
      percent: 75,
    })
    const javaResult = await ensureJavaRuntime({
      mcVersion: version,
      customJavaPath: profile.javaPath,
      log: postLog,
    })
    postLog('info', `Java runtime đã sẵn sàng: ${javaResult.javaPath} (Java ${javaResult.majorVersion})`)
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Java Runtime sẵn sàng',
      message: `Đã xác nhận Java ${javaResult.majorVersion}.`,
      percent: 85,
    })

    // 5. Mod dependencies check & auto-fix
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Kiểm tra phụ thuộc Mod',
      message: 'Đang rà soát thư mục mods...',
      percent: 88,
    })
    try {
      const loader = detectLoaderFromVersion(version)
      const inspection = await inspectModDependencies(gameDir, version, loader)
      if (inspection.missingDependencies.length > 0) {
        postLog('warn', `Phát hiện ${inspection.missingDependencies.length} mod còn thiếu phụ thuộc. Đang tự tải bổ sung...`)
        const fixResult = await autoFixModDependencies(gameDir, version, loader, (msg) => postLog('info', msg))
        postLog('info', `Đã tự động tải thành công ${fixResult.downloadedMods.length} mod phụ thuộc.`)
      }
    } catch (modErr) {
      postLog('warn', `Bỏ qua kiểm tra mod dependencies: ${modErr instanceof Error ? modErr.message : String(modErr)}`)
    }

    // 5b. Thiết lập ngôn ngữ Tiếng Việt và tùy chọn mặc định cho profile
    try {
      await applyDefaultGameOptions(gameDir, version)
    } catch {
      // Non-blocking
    }

    // 6. Hoàn tất
    const finalState: PreparedProfileState = {
      profileId,
      version,
      gameDir,
      isReady: true,
      checkedAt: new Date().toISOString(),
      versionJsonReady: true,
      librariesReady: true,
      assetsReady: true,
      javaReady: true,
      missingFiles: 0,
      message: 'Phiên bản đã sẵn sàng khởi động!',
    }

    postProgress(profileId, version, {
      status: 'ready',
      title: 'Hoàn tất chuẩn bị',
      message: 'Trò chơi đã sẵn sàng.',
      percent: 100,
    })

    // Đảm bảo options.txt và yosbr chuẩn tiếng Việt khi hoàn tất chuẩn bị
    if (gameDir) {
      await applyDefaultGameOptions(gameDir, version).catch(() => {})
    }

    postFinished(profileId, finalState, true, 'Prepared successfully.')
  } catch (error) {
    const rawErr = error instanceof Error ? error.message : String(error)
    let friendlyErr = rawErr
    if (rawErr.includes('ENOENT') && (rawErr.includes('.json') || rawErr.includes('versions'))) {
      friendlyErr = `Không tìm thấy tệp cấu hình phiên bản (${version}.json) trong thư mục cấu hình game (${gameDir}). Vui lòng kiểm tra lại cấu hình hoặc cài đặt lại phiên bản.`
    }
    postLog('error', `Prepare failed: ${friendlyErr}`)
    void writeErrorLog('prepareWorker', error, { profileId, version, gameDir })
    postProgress(profileId, version, {
      status: 'failed',
      title: 'Lỗi chuẩn bị game',
      message: friendlyErr,
      percent: 100,
    })
    postFinished(profileId, null, false, friendlyErr)
  }
}

parentPort.on('message', (e: { data?: { type?: string; profile?: LauncherProfile; settings?: LauncherSettings; forceRepair?: boolean } }) => {
  const message = e.data
  if (message?.type === 'start' && message.profile && message.settings) {
    void startPrepare(message.profile, message.settings, message.forceRepair)
  }
})
