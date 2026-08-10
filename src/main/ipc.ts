import { ipcMain, shell, BrowserWindow } from 'electron'
import crypto from 'node:crypto'
import type {
  LaunchInput,
  LaunchResult,
  LauncherLog,
  LauncherLogLevel,
  LauncherProgress,
  LaunchStatus,
  LauncherProfile,
  GameContentType,
  LauncherSettings,
} from '../shared/types'
import { detectMinecraftDirectory } from './services/minecraftDirectoryService'
import { getSettings, updateSettings } from './services/settingsService'
import {
  createProfile,
  deleteProfile,
  getProfiles,
  setActiveProfile,
  updateProfile
} from './services/profileService'
import { getMinecraftVersionCatalog } from './services/versionService'
import { scanMinecraftDirectory } from './services/minecraftScannerService'
import {
  scanJavaRuntimes,
  selectBestJavaRuntime,
  verifyJavaPath
} from './services/javaScannerService'
import {
  deleteGameContent,
  disableGameContent,
  enableGameContent,
  importGameContent,
  resolveContentFolderPath,
  scanGameContent,
  scanMods,
  scanResourcePacks,
  scanShaderPacks,
  getModMetadata,
} from './services/gameContentService'
import {
  launchMinecraft as coreLaunch
} from './services/minecraftService'
import {
  startLaunchJob,
  safeStartLaunchJob,
  cancelLaunchJob,
  getLaunchState,
  clearJobLogs,
  isGameRunning,
  isLauncherHiddenForGame,
} from './services/launchManager'
import {
  checkPreparedProfile,
  prepareGameFiles,
  cancelPrepareGame,
  clearPreparedProfilesCache,
} from './services/prepareGameService'
import {
  clearVersionManifestCache,
} from './services/versionManifestCacheService'
import {
  getFabricVersions,
  getQuiltVersions,
  installFabric,
  installQuilt
} from './services/modLoaderService'
import {
  getSystemPerformanceInfo,
} from './services/systemInfoService'
import {
  getEffectivePerformanceSettings,
} from './services/settingsService'
import { autoInstallJava, getDefaultJavaInstallDir } from './services/javaInstallerService'
import {
  getAccountState,
  selectAccount,
  addLocalAccount,
  removeAccount,
  saveMicrosoftAccount
} from './services/accountService'
import { loginWithMicrosoft } from './services/microsoftAuthService'

// ─── In-memory launcher state ─────────────────────────────────────────────────

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

function handleIpc<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs) => {
    try {
      return await handler(...args)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unknown IPC error'

      throw new Error(message)
    }
  })
}

export function registerIpcHandlers(): void {
  handleIpc('minecraft:detect-directory', detectMinecraftDirectory)

  handleIpc('settings:get', getSettings)
  handleIpc('settings:update', async (_event, input) => {
    const oldSettings = await getSettings()
    const newSettings = await updateSettings(input as Partial<LauncherSettings>)
    
    if (oldSettings.enableDiscordRpc !== newSettings.enableDiscordRpc) {
      if (newSettings.enableDiscordRpc) {
        import('./services/discordRpcService.js').then(m => m.initDiscordRpc().catch(console.error))
      } else {
        import('./services/discordRpcService.js').then(m => m.stopDiscordRpc().catch(console.error))
      }
    }
    
    return newSettings
  })
  handleIpc('system:performance-info', () => getSystemPerformanceInfo())
  handleIpc('settings:effective-performance', () => getEffectivePerformanceSettings())

  handleIpc('profiles:get', getProfiles)
  handleIpc('profiles:create', createProfile)
  handleIpc('profiles:update', updateProfile)
  handleIpc('profiles:delete', deleteProfile)
  handleIpc('profiles:set-active', setActiveProfile)

  handleIpc('versions:get-catalog', getMinecraftVersionCatalog)
  handleIpc('minecraft:scan-directory', scanMinecraftDirectory)

  handleIpc('modloader:get-fabric-versions', getFabricVersions)
  handleIpc('modloader:get-quilt-versions', getQuiltVersions)
  handleIpc('modloader:install-fabric', installFabric)
  handleIpc('modloader:install-quilt', installQuilt)

  handleIpc('java:scan', (customScanDirs?: string[], forceRefresh?: boolean) =>
    scanJavaRuntimes(customScanDirs ?? [], forceRefresh === true)
  )
  handleIpc(
    'java:select-best',
    (
      minecraftVersion: string,
      customScanDirs?: string[],
      options?: {
        gameDir?: string
        allowNewer?: boolean
        preferredJavaPath?: string | null
        forceRefresh?: boolean
      }
    ) => selectBestJavaRuntime(minecraftVersion, customScanDirs ?? [], options)
  )
  handleIpc('java:auto-install', async (javaVersion: number) => {
    return autoInstallJava(javaVersion, getDefaultJavaInstallDir())
  })
  handleIpc('java:verify-path', async (javaPath: string, requiredMajor: number) => {
    return verifyJavaPath(javaPath, requiredMajor)
  })


  handleIpc('content:scan', scanGameContent)
  handleIpc('content:scan-mods', async (gameDir: string) => (await scanMods(gameDir)))
  handleIpc('content:scan-resourcepacks', async (gameDir: string) => (await scanResourcePacks(gameDir)))
  handleIpc('content:scan-shaderpacks', async (gameDir: string) => (await scanShaderPacks(gameDir)))
  handleIpc('content:get-mod-metadata', async (_gameDir: string, jarPath: string) => getModMetadata(jarPath))
  handleIpc('content:enable', async (_gameDir: string, itemPath: string) => enableGameContent(itemPath))

  // Window controls (frameless)
  handleIpc('window:minimize', () => { BrowserWindow.getAllWindows()[0]?.minimize() })
  handleIpc('window:close', () => { BrowserWindow.getAllWindows()[0]?.close() })
  handleIpc('window:maximize', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (!w) return
    w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  handleIpc('content:disable', async (_gameDir: string, itemPath: string) => disableGameContent(itemPath))
  handleIpc('content:delete', (_gameDir: string, itemPath: string) => deleteGameContent(_gameDir, itemPath))
  handleIpc('content:import', importGameContent)

  handleIpc('dialog:open-file', async (filters?: { name: string; extensions: string[] }[]) => {
    const { dialog } = await import('electron')
    const w = BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(w, {
      properties: ['openFile'],
      filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
    })
    return res.canceled ? null : res.filePaths[0] ?? null
  })

  handleIpc(
    'content:open-folder',
    async (gameDir: string, type: GameContentType) => {
      const folderPath = await resolveContentFolderPath(gameDir, type)
      await shell.openPath(folderPath)
      return true
    }
  )

  handleIpc('versions:open-folder', async (versionPath: string) => {
    await shell.openPath(versionPath)
    return true
  })

  handleIpc('versions:delete', async (versionPath: string) => {
    const fs = await import('node:fs/promises')
    await fs.rm(versionPath, { recursive: true, force: true })
    return true
  })

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

  // ── NEW non-blocking launch API (Worker Thread based) ─────────────────────
  handleIpc('launch:start', safeStartLaunchJob)
  handleIpc('launch:cancel', cancelLaunchJob)
  handleIpc('launch:get-state', getLaunchState)
  handleIpc('launch:clear-logs', clearJobLogs)

  // ── NEW prepare game and caching API ────────────────────────────────────────
  handleIpc('prepare:check', (profile: LauncherProfile, settings: LauncherSettings) => checkPreparedProfile(profile, settings))
  handleIpc('prepare:start', (profile: LauncherProfile, settings: LauncherSettings, forceRepair?: boolean) => prepareGameFiles(profile, settings, forceRepair))
  handleIpc('prepare:cancel', () => cancelPrepareGame())
  handleIpc('cache:clear-manifest', () => clearVersionManifestCache())
  handleIpc('cache:clear-prepared', () => clearPreparedProfilesCache())

  // ── Legacy polling API (kept for backward compat) ─────────────────────────
  handleIpc('launcher:get-status', () => launcherState.status)
  handleIpc('launcher:get-progress', () => launcherState.progress)
  handleIpc('launcher:get-logs', () => [...launcherState.logs])
  handleIpc('launcher:clear-logs', () => {
    launcherState.logs = []
    return true
  })

  handleIpc('account:get', getAccountState)
  handleIpc('account:select', (accountId: string) => selectAccount(accountId))
  handleIpc('account:add-local', (username: string) => addLocalAccount(username))
  handleIpc('account:remove', (accountId: string) => removeAccount(accountId))
  handleIpc('account:save-microsoft', (account: any) => saveMicrosoftAccount(account))
  handleIpc('account:login-microsoft', async () => {
    return loginWithMicrosoft()
  })

  // Non-blocking refresh for MS token — called on demand (launch / explicit)
  handleIpc('account:refresh-microsoft', async (accountId: string) => {
    const { refreshMicrosoftAccountToken } = await import('./services/accountService')
    return refreshMicrosoftAccountToken(accountId)
  })
}
