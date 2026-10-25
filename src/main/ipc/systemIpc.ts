import { BrowserWindow, shell, dialog } from 'electron'
import { handleIpc } from './ipcHelper'
import { detectMinecraftDirectory } from '../services/launcher/minecraftDirectoryService'
import { scanMinecraftDirectory } from '../services/launcher/minecraftScannerService'
import { getMinecraftVersionCatalog } from '../services/launcher/versionService'
import {
  getSettings,
  updateSettings,
  getEffectivePerformanceSettings,
} from '../services/system/settingsService'
import { getSystemPerformanceInfo } from '../services/system/systemInfoService'
import {
  scanJavaRuntimes,
  selectBestJavaRuntime,
  verifyJavaPath,
} from '../services/launcher/javaScannerService'
import { autoInstallJava, getDefaultJavaInstallDir } from '../services/launcher/javaInstallerService'
import { optimizerService } from '../services/system/optimizerService'
import { taskManagerService } from '../services/system/taskManagerService'
import { setCustomActivity } from '../services/system/discordRpcService'
import { checkForUpdates, quitAndInstallUpdate } from '../services/system/autoUpdaterService'
import type { LauncherSettings, OptimizeVideoSettingsOptions } from '../../shared/types'

export function registerSystemIpc(): void {
  // Settings & System
  handleIpc('minecraft:detect-directory', detectMinecraftDirectory)
  handleIpc('minecraft:scan-directory', scanMinecraftDirectory)
  handleIpc('versions:get-catalog', getMinecraftVersionCatalog)
  handleIpc('settings:get', getSettings)
  handleIpc('settings:update', async (input: Partial<LauncherSettings>) => {
    return await updateSettings(input)
  })
  handleIpc('system:performance-info', () => getSystemPerformanceInfo())
  handleIpc('settings:effective-performance', () => getEffectivePerformanceSettings())

  // Java Environment
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
  handleIpc('java:auto-install', (javaVersion: number) =>
    autoInstallJava(javaVersion, getDefaultJavaInstallDir())
  )
  handleIpc('java:verify-path', (javaPath: string, requiredMajor: number) =>
    verifyJavaPath(javaPath, requiredMajor)
  )

  // Optimizer & Cache Cleaner
  handleIpc('optimizer:get-presets', () => optimizerService.getJvmPresets())
  handleIpc('optimizer:scan-cache', (gameDir?: string) => optimizerService.scanCache(gameDir))
  handleIpc('optimizer:clean-cache', (gameDir?: string, targetKeys?: string[]) =>
    optimizerService.cleanCache(gameDir, targetKeys)
  )
  handleIpc('optimizer:optimize-video-settings', (options: OptimizeVideoSettingsOptions) =>
    optimizerService.optimizeInGameVideoSettings(options)
  )
  handleIpc('optimizer:check-low-end-status', (gameDir?: string) =>
    optimizerService.checkLowEndOptimizationStatus(gameDir)
  )
  handleIpc('optimizer:install-essential-mod', (gameDir: string | undefined, modSlug: string, mcVersion?: string, loader?: string) =>
    optimizerService.installEssentialMod(gameDir, modSlug, mcVersion, loader)
  )
  handleIpc('optimizer:install-all-essential-mods', (gameDir: string | undefined, mcVersion?: string, loader?: string) =>
    optimizerService.installAllMissingEssentialMods(gameDir, mcVersion, loader)
  )

  // Version Folder management
  handleIpc('versions:open-folder', async (versionPath: string) => {
    if (!versionPath || typeof versionPath !== 'string') return false
    await shell.openPath(versionPath)
    return true
  })
  handleIpc('versions:delete', async (versionPath: string) => {
    if (!versionPath || typeof versionPath !== 'string') {
      throw new Error('Đường dẫn phiên bản không hợp lệ.')
    }
    const pathMod = await import('node:path')
    const parentDir = pathMod.basename(pathMod.dirname(versionPath)).toLowerCase()
    if (parentDir !== 'versions') {
      throw new Error('Chỉ được phép xóa thư mục phiên bản hợp lệ nằm trong versions.')
    }
    const fs = await import('node:fs/promises')
    await fs.rm(versionPath, { recursive: true, force: true })
    return true
  })

  // Window Controls
  handleIpc('window:open-external', async (url: string) => {
    if (!url || typeof url !== 'string') return
    const normalized = url.trim()
    if (normalized.startsWith('https://') || normalized.startsWith('http://')) {
      await shell.openExternal(normalized)
    }
  })
  handleIpc('window:minimize', () => {
    BrowserWindow.getAllWindows()[0]?.minimize()
  })
  handleIpc('window:close', () => {
    BrowserWindow.getAllWindows()[0]?.close()
  })
  handleIpc('window:maximize', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (!w) return
    w.isMaximized() ? w.unmaximize() : w.maximize()
  })

  // Native Dialogs
  handleIpc('dialog:open-file', async (filters?: { name: string; extensions: string[] }[]) => {
    const w = BrowserWindow.getAllWindows()[0]
    const openOpts: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
    }
    const res = w ? await dialog.showOpenDialog(w, openOpts) : await dialog.showOpenDialog(openOpts)
    return res.canceled ? null : res.filePaths[0] ?? null
  })
  handleIpc('dialog:save-file', async (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const w = BrowserWindow.getAllWindows()[0]
    const saveOpts: Electron.SaveDialogOptions = {
      defaultPath: options?.defaultPath,
      filters: options?.filters ?? [{ name: 'Zip Archive', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }],
    }
    const res = w ? await dialog.showSaveDialog(w, saveOpts) : await dialog.showSaveDialog(saveOpts)
    return res.canceled ? null : res.filePath ?? null
  })

  // Task Manager
  handleIpc('tasks:get-all', () => taskManagerService.getAllTasks())
  handleIpc('tasks:cancel', async (taskId: string) => {
    return taskManagerService.cancelTask(taskId)
  })
  handleIpc('tasks:clear-completed', () => {
    taskManagerService.clearCompletedTasks()
  })

  // Discord RPC
  handleIpc('discord:set-activity', async ({ details, state }: { details: string; state: string }) => {
    setCustomActivity(details, state)
    return true
  })

  // Auto Updater
  handleIpc('updater:check', () => checkForUpdates())
  handleIpc('updater:quit-and-install', () => {
    quitAndInstallUpdate()
  })

  // Utilities
  handleIpc('utils:read-local-image-base64', async (filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return null
    try {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const normalized = path.normalize(filePath)
      const ext = path.extname(normalized).toLowerCase().substring(1)
      const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
      if (!allowedExts.includes(ext)) return null

      const buffer = await fs.readFile(normalized)
      return `data:image/${ext};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  })
}
