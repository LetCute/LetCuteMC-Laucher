import type {
  LauncherProfile,
  LauncherSettings,
  PrepareGameProgress,
  PreparedProfileState,
  LauncherLogLevel,
} from '../../shared/types'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getVersionManifestCacheDir } from '../services/system/storageService'
import { ensureJavaRuntime } from '../services/launcher/javaResolver'
import {
  ensureVersionMetadata,
  syncModpackVersionFolder,
  ensureLibrariesAndAssets,
} from '../services/launcher/versionResolver'
import { writeErrorLog } from '../services/media/errorLogService'
import { autoFixModDependencies, inspectModDependencies, detectLoaderFromVersion } from '../services/content/modDependencyService'
import { initGlobalHttpDispatcher } from '../services/system/httpAgent'

const parentPort = (process as any).parentPort
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
  profileId: string,
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
    const rawVersionJson = await ensureVersionMetadata(version, mcRootDir, postLog)
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Tải thông tin phiên bản',
      message: 'Đã sẵn sàng metadata phiên bản.',
      percent: 25,
    })

    // 2. Modpack version folder sync
    await syncModpackVersionFolder(version, mcRootDir, gameDir, postLog)

    // 3. Resolve XMCL Version & Tải Libraries / Assets
    postProgress(profileId, version, {
      status: 'downloading',
      title: 'Kiểm tra thư viện & tài nguyên',
      message: 'Đang xác thực thư viện...',
      percent: 35,
    })
    const { Version } = await import('@xmcl/core')
    const resolved = await Version.parse(mcRootDir, version)
    await ensureLibrariesAndAssets(resolved, mcRootDir, (percent) => {
      postProgress(profileId, version, {
        status: 'downloading',
        title: 'Tải thư viện & tài nguyên',
        message: `Đang tải tài nguyên (${percent}%)...`,
        percent: 35 + Math.round(percent * 0.35),
      })
    })

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

    postFinished(profileId, finalState, true, 'Prepared successfully.')
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    postLog('error', `Prepare failed: ${errMessage}`)
    void writeErrorLog('prepareWorker', error, { profileId, version, gameDir })
    postProgress(profileId, version, {
      status: 'failed',
      title: 'Lỗi chuẩn bị game',
      message: errMessage,
      percent: 100,
    })
    postFinished(profileId, null, false, errMessage)
  }
}

parentPort.on('message', (e: any) => {
  const message = e.data
  if (message.type === 'start') {
    void startPrepare(message.profile, message.settings, message.forceRepair)
  }
})
