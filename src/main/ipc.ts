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
  inspectModDependencies,
  autoFixModDependencies,
} from './services/modDependencyService'

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
  installQuilt,
  getForgeVersions,
  getNeoForgeVersions,
  installForge,
  installNeoForge
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
  saveMicrosoftAccount,
  refreshMicrosoftAccountToken,
  renameAccountLocally,
} from './services/accountService'
import { loginWithMicrosoft } from './services/microsoftAuthService'
import {
  fetchMojangProfile,
  uploadMojangSkin,
  changeMojangCape,
  checkMojangNameChange,
  changeMojangName
} from './services/mojangApiService'
import { worldService } from './services/worldService'
import { screenshotService } from './services/screenshotService'
import { logService } from './services/logService'
import { statsService } from './services/statsService'
import { profilePackageService } from './services/profilePackageService'
import { optimizerService } from './services/optimizerService'
import { modUpdaterService } from './services/modUpdaterService'
import { modConflictService } from './services/modConflictService'

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
    

    
    return newSettings
  })
  handleIpc('system:performance-info', () => getSystemPerformanceInfo())
  handleIpc('settings:effective-performance', () => getEffectivePerformanceSettings())

  handleIpc('utils:read-local-image-base64', async (_, filePath: string) => {
    try {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const buffer = await fs.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase().substring(1) || 'png'
      return `data:image/${ext};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  })

  handleIpc('profiles:get', getProfiles)
  handleIpc('profiles:create', createProfile)
  handleIpc('profiles:update', updateProfile)
  handleIpc('profiles:delete', deleteProfile)
  handleIpc('profiles:set-active', setActiveProfile)

  handleIpc('versions:get-catalog', getMinecraftVersionCatalog)
  handleIpc('minecraft:scan-directory', scanMinecraftDirectory)

  // Modrinth API
  handleIpc('modrinth:search', async ({ query, projectType, offset }: { query: string, projectType: string, offset: number }) => {
    const { searchModrinth } = await import('./services/modrinthService.js')
    return searchModrinth(query, projectType, offset)
  })
  handleIpc('modrinth:get-versions', async ({ projectId }: { projectId: string }) => {
    const { getModrinthVersions } = await import('./services/modrinthService.js')
    return getModrinthVersions(projectId)
  })
  handleIpc('modrinth:install-modpack', async ({ versionId, profileName }: { versionId: string, profileName: string }) => {
    const { installModrinthModpack } = await import('./services/modrinthService.js')
    const { getSettings } = await import('./services/settingsService.js')
    const { getDefaultMinecraftDirectory } = await import('./services/storageService.js')
    
    // Dùng minecraftDirectory từ settings thực tế (người dùng có thể đã tùy chỉnh)
    const currentSettings = await getSettings()
    const mcRootDir = currentSettings.minecraftDirectory || getDefaultMinecraftDirectory()
    
    return await installModrinthModpack(versionId, profileName, mcRootDir)
  })
  handleIpc('modrinth:install-local-modpack', async ({ mrpackPath, profileName }: { mrpackPath: string, profileName: string }) => {
    const { installLocalModrinthModpack } = await import('./services/modrinthService.js')
    const { getSettings } = await import('./services/settingsService.js')
    const { getDefaultMinecraftDirectory } = await import('./services/storageService.js')
    
    const currentSettings = await getSettings()
    const mcRootDir = currentSettings.minecraftDirectory || getDefaultMinecraftDirectory()
    
    return await installLocalModrinthModpack(mrpackPath, profileName, mcRootDir)
  })
  // Store Management
  handleIpc('server-list:get', async ({ page }: { page?: number }) => {
    const { serverListService } = await import('./services/serverListService.js')
    return serverListService.getTopServers(page)
  })
  handleIpc('server-list:inject', async ({ profileId, page }: { profileId: string, page?: number }) => {
    const { serverListService } = await import('./services/serverListService.js')
    return serverListService.injectServersToProfile(profileId, page)
  })
  handleIpc('store:get-installations', async (gameDir: string) => {
    const { getStoreInstallations } = await import('./services/modrinthService.js')
    return getStoreInstallations(gameDir)
  })
  handleIpc('store:install-mod', async ({ versionId, gameDir }: { versionId: string, gameDir: string }) => {
    const { installModrinthMod } = await import('./services/modrinthService.js')
    await installModrinthMod(versionId, gameDir)
    return true
  })
  handleIpc('store:uninstall-item', async ({ projectId, gameDir }: { projectId: string, gameDir: string }) => {
    const { uninstallStoreItem } = await import('./services/modrinthService.js')
    return uninstallStoreItem(projectId, gameDir)
  })


  handleIpc('modloader:get-fabric-versions', getFabricVersions)
  handleIpc('modloader:get-quilt-versions', getQuiltVersions)
  handleIpc('modloader:install-fabric', installFabric)
  handleIpc('modloader:install-quilt', installQuilt)

  // Forge / NeoForge handlers
  handleIpc('modloader:get-forge-versions', getForgeVersions)
  handleIpc('modloader:get-neoforge-versions', getNeoForgeVersions)
  handleIpc('modloader:install-forge', installForge)
  handleIpc('modloader:install-neoforge', installNeoForge)

  handleIpc(
    'java:scan',
    (customScanDirs?: string[], forceRefresh?: boolean) =>
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
  handleIpc('mods:inspect-dependencies', async (gameDir: string, mcVersion: string, loader?: string) => inspectModDependencies(gameDir, mcVersion, loader))
  handleIpc('mods:auto-fix-dependencies', async (gameDir: string, mcVersion: string, loader?: string) => autoFixModDependencies(gameDir, mcVersion, loader))


  // Window controls (frameless)
  handleIpc('window:open-external', async (url: string) => { await shell.openExternal(url) })
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

  handleIpc('dialog:save-file', async (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const { dialog } = await import('electron')
    const w = BrowserWindow.getAllWindows()[0]
    const res = await dialog.showSaveDialog(w, {
      defaultPath: options?.defaultPath,
      filters: options?.filters ?? [{ name: 'Zip Archive', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }],
    })
    return res.canceled ? null : res.filePath ?? null
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

    // Inject top servers for this version automatically
    try {
      const { serverListService } = await import('./services/serverListService.js')
      serverListService.injectServersToProfile(profile.id, 1, input.version)
        .catch(err => console.error('[minecraft:launch] Failed to inject servers:', err))
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

  // ── NEW non-blocking launch API (Worker Thread based) ─────────────────────
  handleIpc('launch:start', safeStartLaunchJob)
  handleIpc('launch:cancel', cancelLaunchJob)
  handleIpc('launch:get-state', getLaunchState)
  handleIpc('launch:clear-logs', clearJobLogs)

  // ── NEW prepare game and caching API ────────────────────────────────────────
  handleIpc('mojang:fetch-texture', async (url: string) => {
    try {
      if (!url) return null
      if (url.startsWith('data:image')) return url

      let targetUrl = url.trim()
      const nmcSkinMatch = targetUrl.match(/namemc\.com\/skin\/([a-fA-F0-9]+)/i)
      const nmcTexMatch = targetUrl.match(/namemc\.com\/texture\/([a-fA-F0-9]+)/i)
      if (nmcSkinMatch) {
        targetUrl = `https://textures.minecraft.net/texture/${nmcSkinMatch[1]}`
      } else if (nmcTexMatch) {
        targetUrl = `https://textures.minecraft.net/texture/${nmcTexMatch[1]}`
      } else if (/^[a-fA-F0-9]{64}$/.test(targetUrl)) {
        targetUrl = `https://textures.minecraft.net/texture/${targetUrl}`
      }

      if (targetUrl.startsWith('http://textures.minecraft.net')) {
        targetUrl = targetUrl.replace('http://', 'https://')
      }

      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      })
      if (!res.ok) return null
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      return `data:image/png;base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  })

  handleIpc('account:lookup-player-skin', async (query: string) => {
    try {
      if (!query || !query.trim()) return null
      let cleanQuery = query.trim()

      const profMatch = cleanQuery.match(/namemc\.com\/profile\/([a-zA-Z0-9_.-]+)/i)
      if (profMatch) {
        cleanQuery = profMatch[1]
      }

      // 1. Try Mojang Official API
      try {
        const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanQuery)}`, {
          headers: { 'User-Agent': 'LetCuteMC-Launcher' },
        })
        if (profileRes.ok) {
          const profileData = (await profileRes.json()) as { id: string; name: string }
          if (profileData?.id) {
            const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${profileData.id}`, {
              headers: { 'User-Agent': 'LetCuteMC-Launcher' },
            })
            if (sessionRes.ok) {
              const sessionData = (await sessionRes.json()) as any
              const prop = sessionData.properties?.find((p: any) => p.name === 'textures')
              if (prop?.value) {
                const tex = JSON.parse(Buffer.from(prop.value, 'base64').toString())
                const skin = tex?.textures?.SKIN
                const cape = tex?.textures?.CAPE
                if (skin?.url) {
                  return {
                    url: skin.url.replace('http://', 'https://'),
                    model: (skin.metadata?.model === 'slim' ? 'slim' : 'default') as 'slim' | 'default',
                    capeUrl: cape?.url ? cape.url.replace('http://', 'https://') : undefined,
                    username: profileData.name,
                    uuid: profileData.id,
                  }
                }
              }
            }
          }
        }
      } catch {}

      // 2. Fallback: PlayerDB API
      try {
        const playerDbRes = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(cleanQuery)}`, {
          headers: { 'User-Agent': 'LetCuteMC-Launcher' },
        })
        if (playerDbRes.ok) {
          const dbData = (await playerDbRes.json()) as any
          if (dbData?.code === 'player.found' && dbData?.data?.player) {
            const p = dbData.data.player
            if (p.skin_texture) {
              return {
                url: p.skin_texture.replace('http://', 'https://'),
                model: 'default' as 'default',
                username: p.username || cleanQuery,
                uuid: p.id,
              }
            }
          }
        }
      } catch {}

      return null
    } catch {
      return null
    }
  })

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
  handleIpc('account:rename-locally', (accountId: string, newName: string) => renameAccountLocally(accountId, newName))
  handleIpc('account:save-local-skin', async (accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null) => {
    const { saveLocalSkin } = await import('./services/accountService')
    return saveLocalSkin(accountId, skinUrl, skinModel, capeUrl)
  })
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

  // Mojang API endpoints
  handleIpc('mojang:get-profile', (accessToken: string) => fetchMojangProfile(accessToken))
  handleIpc('mojang:upload-skin', (accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim') => 
    uploadMojangSkin(accessToken, Buffer.from(fileBuffer), variant)
  )
  handleIpc('mojang:change-cape', (accessToken: string, capeId: string) => changeMojangCape(accessToken, capeId))
  handleIpc('mojang:check-name-change', (accessToken: string) => checkMojangNameChange(accessToken))
  handleIpc('mojang:change-name', (accessToken: string, newName: string) => changeMojangName(accessToken, newName))

  // Task Manager endpoints
  handleIpc('tasks:get-all', async () => {
    const { taskManagerService } = await import('./services/taskManagerService.js')
    return taskManagerService.getAllTasks()
  })
  handleIpc('tasks:clear-completed', async () => {
    const { taskManagerService } = await import('./services/taskManagerService.js')
    taskManagerService.clearCompletedTasks()
  })

  // Discord RPC
  handleIpc('discord:set-activity', async ({ details, state }: { details: string, state: string }) => {
    const { setCustomActivity } = await import('./services/discordRpcService.js')
    setCustomActivity(details, state)
    return true
  })

  // Auto Updater
  handleIpc('updater:check', async () => {
    const { checkForUpdates } = await import('./services/autoUpdaterService.js')
    return checkForUpdates()
  })
  handleIpc('updater:quit-and-install', async () => {
    const { quitAndInstallUpdate } = await import('./services/autoUpdaterService.js')
    quitAndInstallUpdate()
  })

  // Worlds & Saves
  handleIpc('worlds:scan', (gameDir?: string) => worldService.scanWorlds(gameDir))
  handleIpc('worlds:backup', (gameDir: string | undefined, folderName: string) => worldService.backupWorld(gameDir, folderName))
  handleIpc('worlds:list-backups', (gameDir: string | undefined, folderName?: string) => worldService.listWorldBackups(gameDir, folderName))
  handleIpc('worlds:restore-backup', (gameDir: string | undefined, backupFilePath: string, targetFolderName?: string) => worldService.restoreWorldBackup(gameDir, backupFilePath, targetFolderName))
  handleIpc('worlds:delete-backup', (backupFilePath: string) => worldService.deleteWorldBackup(backupFilePath))
  handleIpc('worlds:export-zip', (gameDir: string | undefined, folderName: string, destinationZipPath: string) => worldService.exportWorldZip(gameDir, folderName, destinationZipPath))
  handleIpc('worlds:import-zip', (gameDir: string | undefined, sourceZipPath: string) => worldService.importWorldZip(gameDir, sourceZipPath))
  handleIpc('worlds:duplicate', (gameDir: string | undefined, folderName: string, newWorldName?: string) => worldService.duplicateWorld(gameDir, folderName, newWorldName))
  handleIpc('worlds:rename', (gameDir: string | undefined, folderName: string, newLevelName: string) => worldService.renameWorld(gameDir, folderName, newLevelName))
  handleIpc('worlds:delete', (gameDir: string | undefined, folderName: string) => worldService.deleteWorld(gameDir, folderName))
  handleIpc('worlds:open-folder', (gameDir: string | undefined, folderName?: string) => worldService.openWorldFolder(gameDir, folderName))

  // Screenshots Gallery
  handleIpc('screenshots:scan', (gameDir?: string) => screenshotService.scanScreenshots(gameDir))
  handleIpc('screenshots:copy-clipboard', (filePath: string) => screenshotService.copyScreenshotToClipboard(filePath))
  handleIpc('screenshots:delete', (filePath: string) => screenshotService.deleteScreenshot(filePath))
  handleIpc('screenshots:delete-multiple', (filePaths: string[]) => screenshotService.deleteMultipleScreenshots(filePaths))
  handleIpc('screenshots:show-in-folder', (filePath: string) => screenshotService.showScreenshotInFolder(filePath))
  handleIpc('screenshots:open-folder', (gameDir?: string) => screenshotService.openScreenshotsFolder(gameDir))

  // Logs & Crash Reports
  handleIpc('logs:list-files', (gameDir?: string) => logService.listLogFiles(gameDir))
  handleIpc('logs:read-file', (filePath: string) => logService.readLogFile(filePath))
  handleIpc('logs:upload-mclogs', (content: string) => logService.uploadLogToMclogs(content))
  handleIpc('logs:delete-file', (filePath: string) => logService.deleteLogFile(filePath))
  handleIpc('logs:clear-old', (gameDir?: string) => logService.clearOldLogs(gameDir))
  handleIpc('logs:open-folder', (gameDir: string | undefined, type?: 'logs' | 'crash-reports') => logService.openLogsFolder(gameDir, type))

  // Playtime & In-game Statistics
  handleIpc('stats:get-full-profile', (gameDir: string, profileId: string, profileName?: string) => statsService.getFullProfileStats(gameDir, profileId, profileName))
  handleIpc('stats:record-session', (gameDir: string, profileId: string, durationSeconds: number, exitCode?: number) => statsService.recordPlaySession(gameDir, profileId, durationSeconds, exitCode))
  handleIpc('stats:open-folder', (gameDir: string, worldFolder?: string) => statsService.openStatsFolder(gameDir, worldFolder))

  // Profile Package Export / Import & Sharing
  handleIpc('profiles:export-package', (options: import('../shared/types').ExportProfilePackageOptions) => profilePackageService.exportProfilePackage(options))
  handleIpc('profiles:read-package-info', (packageFilePath: string) => profilePackageService.readPackageInfo(packageFilePath))
  handleIpc('profiles:import-package', (packageFilePath: string, customName?: string) => profilePackageService.importProfilePackage(packageFilePath, customName))

  // JVM Optimizer, Low-End Boost & Cache Cleaner
  handleIpc('optimizer:get-presets', () => optimizerService.getJvmPresets())
  handleIpc('optimizer:scan-cache', (gameDir?: string) => optimizerService.scanCache(gameDir))
  handleIpc('optimizer:clean-cache', (gameDir?: string, targetKeys?: string[]) => optimizerService.cleanCache(gameDir, targetKeys))
  handleIpc('optimizer:optimize-video-settings', (options: import('../shared/types').OptimizeVideoSettingsOptions) => optimizerService.optimizeInGameVideoSettings(options))
  handleIpc('optimizer:check-low-end-status', (gameDir?: string) => optimizerService.checkLowEndOptimizationStatus(gameDir))
  handleIpc('optimizer:install-essential-mod', (gameDir: string | undefined, modSlug: string, mcVersion?: string, loader?: string) => optimizerService.installEssentialMod(gameDir, modSlug, mcVersion, loader))
  handleIpc('optimizer:install-all-essential-mods', (gameDir: string | undefined, mcVersion?: string, loader?: string) => optimizerService.installAllMissingEssentialMods(gameDir, mcVersion, loader))

  // Mod Auto-Updater
  handleIpc('mod-updater:check', (gameDir?: string, mcVersion?: string, loader?: string) => modUpdaterService.checkForModUpdates(gameDir, mcVersion, loader))
  handleIpc('mod-updater:update-single', (gameDir: string | undefined, item: import('../shared/types').ModUpdateItem) => modUpdaterService.updateSingleMod(gameDir, item))
  handleIpc('mod-updater:update-all', (gameDir: string | undefined, items: import('../shared/types').ModUpdateItem[]) => modUpdaterService.updateAllMods(gameDir, items))

  // Mod Conflict & Crash Predictor
  handleIpc('mod-conflict:check', (gameDir?: string, mcVersion?: string, loader?: string) => modConflictService.checkModConflicts(gameDir, mcVersion, loader))
  handleIpc('mod-conflict:resolve', (gameDir: string | undefined, option: import('../shared/types').ResolveConflictOption, mcVersion?: string, loader?: string) => modConflictService.resolveConflict(gameDir, option, mcVersion, loader))
  handleIpc('mod-conflict:resolve-all-critical', (gameDir: string | undefined, conflicts: import('../shared/types').ModConflictItem[], mcVersion?: string, loader?: string) => modConflictService.resolveAllCritical(gameDir, conflicts, mcVersion, loader))
}
