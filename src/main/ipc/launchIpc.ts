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
import {
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

  // Legacy single-thread launch API -> redirected to launch job
  handleIpc('minecraft:launch', async (input: LaunchInput, _profile: LauncherProfile): Promise<LaunchResult> => {
    const jobRes = await safeStartLaunchJob(input)
    return {
      ok: jobRes.ok,
      status: jobRes.ok ? 'running' : 'idle',
      message: jobRes.message,
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
