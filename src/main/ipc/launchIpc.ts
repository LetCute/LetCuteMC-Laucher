import { BrowserWindow } from 'electron'
import { handleIpc } from './ipcHelper'
import type {
  LaunchInput,
  LaunchResult,
  LauncherProfile,
  LauncherSettings,
  LauncherLog,
  LauncherProgress,
  LaunchStatus,
  LauncherLogLevel,
} from '../../shared/types'
import { launchMinecraft as coreLaunch } from '../services/launcher/minecraftService'
import {
  startLaunchJob,
  safeStartLaunchJob,
  cancelLaunchJob,
  getLaunchState,
  clearJobLogs,
} from '../services/launcher/launchManager'
import {
  checkPreparedProfile,
  prepareGameFiles,
  cancelPrepareGame,
  clearPreparedProfilesCache,
} from '../services/launcher/prepareGameService'
import { clearVersionManifestCache } from '../services/launcher/versionManifestCacheService'
import crypto from 'node:crypto'

// ─── Legacy In-memory launcher state ──────────────────────────────────────────

const launcherState = {
  status: 'idle' as LaunchStatus,
  logs: [] as LauncherLog[],
  progress: {
    stage: 'idle',
    title: 'Sẵn sàng',
    message: 'Chưa có gì để khởi động.',
    percent: 0,
    updatedAt: new Date().toISOString(),
  } as LauncherProgress,
}

export function setLauncherProgress(progress: Partial<LauncherProgress>): void {
  launcherState.progress = {
    ...launcherState.progress,
    ...progress,
    percent: Math.max(0, Math.min(100, progress.percent ?? launcherState.progress.percent)),
    updatedAt: new Date().toISOString(),
  }
}

export function appendLauncherLog(level: LauncherLogLevel, message: string): void {
  const latestLog = launcherState.logs.at(-1)
  if (latestLog?.level === level && latestLog.message === message) return

  const log: LauncherLog = {
    id: crypto.randomUUID(),
    level,
    message,
    createdAt: new Date().toISOString(),
  }
  launcherState.logs.push(log)
  if (launcherState.logs.length > 500) {
    launcherState.logs = launcherState.logs.slice(-500)
  }
}

export function setLaunchStatus(status: LaunchStatus): void {
  launcherState.status = status
}

export function registerLaunchIpc(): void {
  // Non-blocking launch API (Worker Thread based)
  handleIpc('launch:start', safeStartLaunchJob)
  handleIpc('launch:cancel', cancelLaunchJob)
  handleIpc('launch:get-state', getLaunchState)
  handleIpc('launch:clear-logs', clearJobLogs)

  // Prepare game and caching API
  handleIpc('prepare:check', (profile: LauncherProfile, settings: LauncherSettings) =>
    checkPreparedProfile(profile, settings)
  )
  handleIpc('prepare:start', (profile: LauncherProfile, settings: LauncherSettings, forceRepair?: boolean) =>
    prepareGameFiles(profile, settings, forceRepair)
  )
  handleIpc('prepare:cancel', () => cancelPrepareGame())
  handleIpc('cache:clear-manifest', () => clearVersionManifestCache())
  handleIpc('cache:clear-prepared', () => clearPreparedProfilesCache())

  // Legacy single-thread launch API
  handleIpc('minecraft:launch', async (input: LaunchInput, profile: LauncherProfile): Promise<LaunchResult> => {
    if (launcherState.status === 'launching' || launcherState.status === 'running') {
      return {
        ok: false,
        status: launcherState.status,
        message: 'Minecraft đang được khởi động hoặc đang chạy.',
      }
    }

    setLaunchStatus('launching')
    appendLauncherLog('info', `Khởi động profile: ${profile.name}`)
    setLauncherProgress({
      stage: 'checking',
      title: 'Chuẩn bị Minecraft',
      message: 'Đang kiểm tra cấu hình...',
      percent: 5,
    })

    try {
      const { serverListService } = await import('../services/media/serverListService.js')
      serverListService
        .injectServersToProfile(profile.id, 1, input.version)
        .catch((err: any) => console.error('[minecraft:launch] Failed to inject servers:', err))
    } catch (err) {
      console.error('[minecraft:launch] Failed to load serverListService:', err)
    }

    try {
      const result = await coreLaunch(
        input,
        profile,
        (level, msg) => appendLauncherLog(level, msg),
        (progress) => setLauncherProgress(progress),
        (_code) => {
          setLaunchStatus('idle')
          setLauncherProgress({
            stage: 'idle',
            title: 'Sẵn sàng',
            message: 'Minecraft đã kết thúc.',
            percent: 0,
            updatedAt: new Date().toISOString(),
          })
          const wins = BrowserWindow.getAllWindows()
          if (wins.length > 0) {
            wins[0].show()
          }
        }
      )

      setLaunchStatus(result.status)

      if (result.ok) {
        const wins = BrowserWindow.getAllWindows()
        if (wins.length > 0) {
          wins[0].minimize()
        }
      } else {
        setLaunchStatus('idle')
      }

      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      setLaunchStatus('idle')
      appendLauncherLog('error', errMsg)
      setLauncherProgress({
        stage: 'failed',
        title: 'Khởi động thất bại',
        message: errMsg,
        percent: 100,
      })
      return { ok: false, status: 'failed', message: errMsg }
    }
  })

  // Legacy polling API (kept for backward compat)
  handleIpc('launcher:get-status', () => launcherState.status)
  handleIpc('launcher:get-progress', () => launcherState.progress)
  handleIpc('launcher:get-logs', () => [...launcherState.logs])
  handleIpc('launcher:clear-logs', () => {
    launcherState.logs = []
    return true
  })
}
