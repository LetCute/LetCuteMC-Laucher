import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  CreateProfileInput,
  GameContentItem,
  GameContentScanResult,
  GameContentType,
  ImportGameContentInput,
  JavaRuntimeSelectionResult,
  JavaScanResult,
  JavaPathVerification,
  LaunchInput,
  LauncherLog,
  LauncherProgress,
  LauncherProfile,
  LauncherSettings,
  LaunchResult,
  LaunchStatus,
  MinecraftDirectoryResult,
  MinecraftScanResult,
  MinecraftVersionCatalog,
  ProfilesStore,
  UpdateProfileInput,
  AccountState,
  ModLoaderVersion,
  // New Worker-based launch types
  StartLaunchResult,
  CancelLaunchResult,
  LaunchJobState,
  LauncherEvent,
  PrepareGameResult,
  PreparedProfileState,
  PrepareGameProgress,
  ModDependencyScanResult,
  AutoFixDependenciesResult,
} from '../shared/types'

const launcherApi = {
  readLocalImageBase64(filePath: string): Promise<string | null> {
    return ipcRenderer.invoke('utils:read-local-image-base64', filePath)
  },

  detectMinecraftDirectory(): Promise<MinecraftDirectoryResult> {
    return ipcRenderer.invoke('minecraft:detect-directory')
  },

  getSettings(): Promise<LauncherSettings> {
    return ipcRenderer.invoke('settings:get')
  },

  updateSettings(
    input: Partial<LauncherSettings>
  ): Promise<LauncherSettings> {
    return ipcRenderer.invoke('settings:update', input)
  },

  getSystemPerformanceInfo(): Promise<import('../shared/types').SystemPerformanceInfo> {
    return ipcRenderer.invoke('system:performance-info')
  },

  getEffectivePerformanceSettings(): Promise<import('../shared/types').EffectivePerformanceSettings> {
    return ipcRenderer.invoke('settings:effective-performance')
  },

  getProfiles(): Promise<ProfilesStore> {
    return ipcRenderer.invoke('profiles:get')
  },

  createProfile(
    input: CreateProfileInput
  ): Promise<LauncherProfile> {
    return ipcRenderer.invoke('profiles:create', input)
  },

  updateProfile(
    profileId: string,
    input: UpdateProfileInput
  ): Promise<LauncherProfile> {
    return ipcRenderer.invoke('profiles:update', profileId, input)
  },

  deleteProfile(profileId: string): Promise<boolean> {
    return ipcRenderer.invoke('profiles:delete', profileId)
  },

  setActiveProfile(profileId: string): Promise<boolean> {
    return ipcRenderer.invoke('profiles:set-active', profileId)
  },

  getMinecraftVersionCatalog(gameDir: string): Promise<MinecraftVersionCatalog> {
    return ipcRenderer.invoke('versions:get-catalog', gameDir)
  },

  scanMinecraftDirectory(gameDir: string): Promise<MinecraftScanResult> {
    return ipcRenderer.invoke('minecraft:scan-directory', gameDir)
  },

  getFabricVersions(): Promise<ModLoaderVersion[]> {
    return ipcRenderer.invoke('modloader:get-fabric-versions')
  },

  getQuiltVersions(): Promise<ModLoaderVersion[]> {
    return ipcRenderer.invoke('modloader:get-quilt-versions')
  },

  getForgeVersions(): Promise<ModLoaderVersion[]> {
    return ipcRenderer.invoke('modloader:get-forge-versions')
  },

  getNeoForgeVersions(): Promise<ModLoaderVersion[]> {
    return ipcRenderer.invoke('modloader:get-neoforge-versions')
  },

  installFabric(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
    return ipcRenderer.invoke('modloader:install-fabric', mcVersion, loaderVersion, gameDir)
  },

  installQuilt(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
    return ipcRenderer.invoke('modloader:install-quilt', mcVersion, loaderVersion, gameDir)
  },

  installForge(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
    return ipcRenderer.invoke('modloader:install-forge', mcVersion, loaderVersion, gameDir)
  },

  installNeoForge(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
    return ipcRenderer.invoke('modloader:install-neoforge', mcVersion, loaderVersion, gameDir)
  },

  scanJavaRuntimes(customScanDirs?: string[], forceRefresh?: boolean): Promise<JavaScanResult> {
    return ipcRenderer.invoke('java:scan', customScanDirs, forceRefresh === true)
  },

  selectBestJavaRuntime(
    minecraftVersion: string,
    customScanDirs?: string[],
    options?: {
      gameDir?: string
      allowNewer?: boolean
      preferredJavaPath?: string | null
      forceRefresh?: boolean
    }
  ): Promise<JavaRuntimeSelectionResult> {
    return ipcRenderer.invoke('java:select-best', minecraftVersion, customScanDirs, options)
  },

  verifyJavaPath(javaPath: string, requiredMajor: number): Promise<JavaPathVerification> {
    return ipcRenderer.invoke('java:verify-path', javaPath, requiredMajor)
  },



  scanGameContent(gameDir: string): Promise<GameContentScanResult> {
    return ipcRenderer.invoke('content:scan', gameDir)
  },
  scanMods(gameDir: string): Promise<GameContentItem[]> {
    return ipcRenderer.invoke('content:scan-mods', gameDir)
  },
  scanResourcePacks(gameDir: string): Promise<GameContentItem[]> {
    return ipcRenderer.invoke('content:scan-resourcepacks', gameDir)
  },
  scanShaderPacks(gameDir: string): Promise<GameContentItem[]> {
    return ipcRenderer.invoke('content:scan-shaderpacks', gameDir)
  },
  getModMetadata(jarPath: string): Promise<import('../shared/types').GameContentMetadata> {
    return ipcRenderer.invoke('content:get-mod-metadata', '', jarPath)
  },
  inspectModDependencies(gameDir: string, mcVersion: string, loader?: string): Promise<ModDependencyScanResult> {
    return ipcRenderer.invoke('mods:inspect-dependencies', gameDir, mcVersion, loader)
  },
  autoFixModDependencies(gameDir: string, mcVersion: string, loader?: string): Promise<AutoFixDependenciesResult> {
    return ipcRenderer.invoke('mods:auto-fix-dependencies', gameDir, mcVersion, loader)
  },


  enableGameContent(
    gameDir: string,
    itemPath: string
  ): Promise<GameContentItem> {
    return ipcRenderer.invoke('content:enable', gameDir, itemPath)
  },

  disableGameContent(
    gameDir: string,
    itemPath: string
  ): Promise<GameContentItem> {
    return ipcRenderer.invoke('content:disable', gameDir, itemPath)
  },

  deleteGameContent(gameDir: string, itemPath: string): Promise<boolean> {
    return ipcRenderer.invoke('content:delete', gameDir, itemPath)
  },

  importGameContent(input: ImportGameContentInput): Promise<GameContentItem> {
    return ipcRenderer.invoke('content:import', input)
  },

  openContentFolder(gameDir: string, type: GameContentType): Promise<boolean> {
    return ipcRenderer.invoke('content:open-folder', gameDir, type)
  },

  openExternal(url: string): Promise<void> { return ipcRenderer.invoke('window:open-external', url) },
  minimizeWindow(): Promise<void> { return ipcRenderer.invoke('window:minimize') },
  closeWindow(): Promise<void> { return ipcRenderer.invoke('window:close') },
  maximizeWindow(): Promise<void> { return ipcRenderer.invoke('window:maximize') },
  openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null> { return ipcRenderer.invoke('dialog:open-file', filters) },
  saveFileDialog(options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> { return ipcRenderer.invoke('dialog:save-file', options) },
  getPathForFile(file: File): string | null { return webUtils.getPathForFile(file) ?? null },

  openVersionFolder(versionPath: string): Promise<boolean> {
    return ipcRenderer.invoke('versions:open-folder', versionPath)
  },

  deleteVersion(versionPath: string): Promise<boolean> {
    return ipcRenderer.invoke('versions:delete', versionPath)
  },

  launchMinecraft(input: LaunchInput, profile: LauncherProfile): Promise<LaunchResult> {
    return ipcRenderer.invoke('minecraft:launch', input, profile)
  },

  getLaunchStatus(): Promise<LaunchStatus> {
    return ipcRenderer.invoke('launcher:get-status')
  },

  getLauncherProgress(): Promise<LauncherProgress> {
    return ipcRenderer.invoke('launcher:get-progress')
  },

  getLauncherLogs(): Promise<LauncherLog[]> {
    return ipcRenderer.invoke('launcher:get-logs')
  },

  clearLauncherLogs(): Promise<boolean> {
    return ipcRenderer.invoke('launcher:clear-logs')
  },

  getMinecraftServers(page?: number): Promise<import('../shared/types').MinecraftServer[]> {
    return ipcRenderer.invoke('server-list:get', { page })
  },
  
  injectTopServers(profileId: string, page?: number): Promise<boolean> {
    return ipcRenderer.invoke('server-list:inject', { profileId, page })
  },

  // ── New non-blocking launch API ────────────────────────────────────────────

  startLaunch(input: LaunchInput): Promise<StartLaunchResult> {
    return ipcRenderer.invoke('launch:start', input)
  },

  cancelLaunch(): Promise<CancelLaunchResult> {
    return ipcRenderer.invoke('launch:cancel')
  },

  getLaunchState(): Promise<LaunchJobState> {
    return ipcRenderer.invoke('launch:get-state')
  },

  clearLaunchLogs(): Promise<boolean> {
    return ipcRenderer.invoke('launch:clear-logs')
  },

  onLauncherEvent(callback: (events: LauncherEvent[]) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, events: LauncherEvent[]) => {
      callback(events)
    }
    ipcRenderer.on('launcher:event-batch', listener)
    return () => {
      ipcRenderer.removeListener('launcher:event-batch', listener)
    }
  },

  // ── New prepare game and caching API ────────────────────────────────────────

  prepareGame(profile: LauncherProfile, settings: LauncherSettings, forceRepair?: boolean): Promise<PrepareGameResult> {
    return ipcRenderer.invoke('prepare:start', profile, settings, forceRepair)
  },

  checkPreparedProfile(profile: LauncherProfile, settings: LauncherSettings): Promise<PreparedProfileState> {
    return ipcRenderer.invoke('prepare:check', profile, settings)
  },

  cancelPrepareGame(): Promise<boolean> {
    return ipcRenderer.invoke('prepare:cancel')
  },

  clearVersionManifestCache(): Promise<boolean> {
    return ipcRenderer.invoke('cache:clear-manifest')
  },

  clearPreparedProfilesCache(): Promise<boolean> {
    return ipcRenderer.invoke('cache:clear-prepared')
  },

  onPrepareGameProgress(callback: (progress: PrepareGameProgress) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, progress: PrepareGameProgress) => {
      callback(progress)
    }
    ipcRenderer.on('prepare:progress', listener)
    return () => {
      ipcRenderer.removeListener('prepare:progress', listener)
    }
  },

  getAccountState(): Promise<AccountState> {
    return ipcRenderer.invoke('account:get')
  },

  selectAccount(accountId: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:select', accountId)
  },

  addLocalAccount(username: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:add-local', username)
  },

  removeAccount(accountId: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:remove', accountId)
  },

  renameAccountLocally(accountId: string, newName: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:rename-locally', accountId, newName)
  },

  saveLocalSkin(accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null): Promise<AccountState> {
    return ipcRenderer.invoke('account:save-local-skin', accountId, skinUrl, skinModel, capeUrl)
  },

  saveMicrosoftAccount(account: any): Promise<AccountState> {
    return ipcRenderer.invoke('account:save-microsoft', account)
  },

  loginMicrosoft(): Promise<any> {
    return ipcRenderer.invoke('account:login-microsoft')
  },

  refreshMicrosoftAccount(accountId?: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:refresh-microsoft', accountId)
  },

  getMojangProfile(accessToken: string): Promise<any> {
    return ipcRenderer.invoke('mojang:get-profile', accessToken)
  },

  fetchMojangTexture(url: string): Promise<string | null> {
    return ipcRenderer.invoke('mojang:fetch-texture', url)
  },

  lookupPlayerSkin(usernameOrUuid: string): Promise<{ url: string; model: 'default' | 'slim'; username: string; uuid?: string; capeUrl?: string } | null> {
    return ipcRenderer.invoke('account:lookup-player-skin', usernameOrUuid)
  },

  uploadMojangSkin(accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim'): Promise<void> {
    return ipcRenderer.invoke('mojang:upload-skin', accessToken, fileBuffer, variant)
  },

  changeMojangCape(accessToken: string, capeId: string): Promise<void> {
    return ipcRenderer.invoke('mojang:change-cape', accessToken, capeId)
  },

  checkMojangNameChange(accessToken: string): Promise<{ createdAt: string; nameChangeAllowed: boolean }> {
    return ipcRenderer.invoke('mojang:check-name-change', accessToken)
  },

  changeMojangName(accessToken: string, newName: string): Promise<void> {
    return ipcRenderer.invoke('mojang:change-name', accessToken, newName)
  },

  searchModrinth(query: string, projectType: string, offset?: number): Promise<any> {
    return ipcRenderer.invoke('modrinth:search', { query, projectType, offset })
  },

  getModrinthVersions(projectId: string): Promise<any[]> {
    return ipcRenderer.invoke('modrinth:get-versions', { projectId })
  },

  installModrinthModpack(versionId: string, profileName: string): Promise<string> {
    return ipcRenderer.invoke('modrinth:install-modpack', { versionId, profileName })
  },

  installLocalModrinthModpack(mrpackPath: string, profileName: string): Promise<string> {
    return ipcRenderer.invoke('modrinth:install-local-modpack', { mrpackPath, profileName })
  },

  getStoreInstallations(gameDir: string): Promise<import('../shared/types').StoreInstallation[]> {
    return ipcRenderer.invoke('store:get-installations', gameDir)
  },

  installStoreMod(versionId: string, gameDir: string): Promise<boolean> {
    return ipcRenderer.invoke('store:install-mod', { versionId, gameDir })
  },

  uninstallStoreItem(projectId: string, gameDir: string): Promise<boolean> {
    return ipcRenderer.invoke('store:uninstall-item', { projectId, gameDir })
  },

  getAllTasks(): Promise<import('../shared/types').BackgroundTask[]> {
    return ipcRenderer.invoke('tasks:get-all')
  },

  cancelTask(taskId: string): Promise<boolean> {
    return ipcRenderer.invoke('tasks:cancel', taskId)
  },

  clearCompletedTasks(): Promise<void> {
    return ipcRenderer.invoke('tasks:clear-completed')
  },

  onTasksUpdate(callback: (events: import('../shared/types').TaskManagerEvent) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, events: import('../shared/types').TaskManagerEvent) => {
      callback(events)
    }
    ipcRenderer.on('tasks:on-update', listener)
    return () => {
      ipcRenderer.removeListener('tasks:on-update', listener)
    }
  },

  setDiscordActivity(details: string, state: string): Promise<boolean> {
    return ipcRenderer.invoke('discord:set-activity', { details, state })
  },

  // Auto Updater
  checkForUpdates(): Promise<any> {
    return ipcRenderer.invoke('updater:check')
  },
  quitAndInstallUpdate(): Promise<void> {
    return ipcRenderer.invoke('updater:quit-and-install')
  },
  onUpdateStatus(callback: (status: { type: string, message: string, data?: any }) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, status: any) => callback(status)
    ipcRenderer.on('auto-update:status', listener)
    return () => ipcRenderer.removeListener('auto-update:status', listener)
  },

  // LAN Discovery
  startLanDiscovery(): Promise<boolean> {
    return ipcRenderer.invoke('lan:start')
  },
  stopLanDiscovery(): Promise<boolean> {
    return ipcRenderer.invoke('lan:stop')
  },
  getLanServers(): Promise<import('../shared/types').LanServerInfo[]> {
    return ipcRenderer.invoke('lan:get-servers')
  },
  onLanServersUpdated(callback: (servers: import('../shared/types').LanServerInfo[]) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, servers: import('../shared/types').LanServerInfo[]) => callback(servers)
    ipcRenderer.on('lan-servers:updated', handler)
    return () => ipcRenderer.removeListener('lan-servers:updated', handler)
  },

  // Worlds & Saves
  scanWorlds(gameDir?: string): Promise<import('../shared/types').MinecraftWorld[]> {
    return ipcRenderer.invoke('worlds:scan', gameDir)
  },
  backupWorld(gameDir: string | undefined, folderName: string): Promise<{ success: boolean; backupPath: string; fileName: string; sizeBytes: number; message?: string }> {
    return ipcRenderer.invoke('worlds:backup', gameDir, folderName)
  },
  listWorldBackups(gameDir: string | undefined, folderName?: string): Promise<import('../shared/types').WorldBackupItem[]> {
    return ipcRenderer.invoke('worlds:list-backups', gameDir, folderName)
  },
  restoreWorldBackup(gameDir: string | undefined, backupFilePath: string, targetFolderName?: string): Promise<{ success: boolean; folderName: string }> {
    return ipcRenderer.invoke('worlds:restore-backup', gameDir, backupFilePath, targetFolderName)
  },
  deleteWorldBackup(backupFilePath: string): Promise<boolean> {
    return ipcRenderer.invoke('worlds:delete-backup', backupFilePath)
  },
  exportWorldZip(gameDir: string | undefined, folderName: string, destinationZipPath: string): Promise<boolean> {
    return ipcRenderer.invoke('worlds:export-zip', gameDir, folderName, destinationZipPath)
  },
  importWorldZip(gameDir: string | undefined, sourceZipPath: string): Promise<{ success: boolean; folderName: string; name: string }> {
    return ipcRenderer.invoke('worlds:import-zip', gameDir, sourceZipPath)
  },
  duplicateWorld(gameDir: string | undefined, folderName: string, newWorldName?: string): Promise<{ success: boolean; newFolderName: string }> {
    return ipcRenderer.invoke('worlds:duplicate', gameDir, folderName, newWorldName)
  },
  renameWorld(gameDir: string | undefined, folderName: string, newLevelName: string): Promise<boolean> {
    return ipcRenderer.invoke('worlds:rename', gameDir, folderName, newLevelName)
  },
  deleteWorld(gameDir: string | undefined, folderName: string): Promise<boolean> {
    return ipcRenderer.invoke('worlds:delete', gameDir, folderName)
  },
  openWorldFolder(gameDir: string | undefined, folderName?: string): Promise<boolean> {
    return ipcRenderer.invoke('worlds:open-folder', gameDir, folderName)
  },

  // Screenshots Gallery
  scanScreenshots(gameDir?: string): Promise<import('../shared/types').MinecraftScreenshot[]> {
    return ipcRenderer.invoke('screenshots:scan', gameDir)
  },
  copyScreenshotToClipboard(filePath: string): Promise<boolean> {
    return ipcRenderer.invoke('screenshots:copy-clipboard', filePath)
  },
  deleteScreenshot(filePath: string): Promise<boolean> {
    return ipcRenderer.invoke('screenshots:delete', filePath)
  },
  deleteMultipleScreenshots(filePaths: string[]): Promise<boolean> {
    return ipcRenderer.invoke('screenshots:delete-multiple', filePaths)
  },
  showScreenshotInFolder(filePath: string): Promise<boolean> {
    return ipcRenderer.invoke('screenshots:show-in-folder', filePath)
  },
  openScreenshotsFolder(gameDir?: string): Promise<boolean> {
    return ipcRenderer.invoke('screenshots:open-folder', gameDir)
  },

  // Logs & Crash Reports
  listLogFiles(gameDir?: string): Promise<{ activeLogs: import('../shared/types').LogFileInfo[]; crashReports: import('../shared/types').LogFileInfo[] }> {
    return ipcRenderer.invoke('logs:list-files', gameDir)
  },
  readLogFile(filePath: string): Promise<string> {
    return ipcRenderer.invoke('logs:read-file', filePath)
  },
  uploadLogToMclogs(content: string): Promise<import('../shared/types').MclogsUploadResult> {
    return ipcRenderer.invoke('logs:upload-mclogs', content)
  },
  deleteLogFile(filePath: string): Promise<boolean> {
    return ipcRenderer.invoke('logs:delete-file', filePath)
  },
  clearOldLogs(gameDir?: string): Promise<{ success: boolean; count: number; freedBytes: number }> {
    return ipcRenderer.invoke('logs:clear-old', gameDir)
  },
  openLogsFolder(gameDir: string | undefined, type?: 'logs' | 'crash-reports'): Promise<boolean> {
    return ipcRenderer.invoke('logs:open-folder', gameDir, type)
  },

  // Playtime & In-game Statistics
  getFullProfileStats(gameDir: string, profileId: string, profileName?: string): Promise<import('../shared/types').ProfileFullStats> {
    return ipcRenderer.invoke('stats:get-full-profile', gameDir, profileId, profileName)
  },
  recordPlaySession(gameDir: string, profileId: string, durationSeconds: number, exitCode?: number): Promise<import('../shared/types').ProfileLauncherStats> {
    return ipcRenderer.invoke('stats:record-session', gameDir, profileId, durationSeconds, exitCode)
  },
  openStatsFolder(gameDir?: string, worldFolder?: string): Promise<boolean> {
    return ipcRenderer.invoke('stats:open-folder', gameDir, worldFolder)
  },

  // Profile Package Export / Import & Sharing
  exportProfilePackage(options: import('../shared/types').ExportProfilePackageOptions): Promise<import('../shared/types').ExportProfileResult> {
    return ipcRenderer.invoke('profiles:export-package', options)
  },
  readProfilePackageInfo(packageFilePath: string): Promise<import('../shared/types').PackagePreviewInfo> {
    return ipcRenderer.invoke('profiles:read-package-info', packageFilePath)
  },
  importProfilePackage(packageFilePath: string, customName?: string): Promise<import('../shared/types').ImportProfileResult> {
    return ipcRenderer.invoke('profiles:import-package', packageFilePath, customName)
  },

  // JVM Optimizer & Cache Cleaner
  getJvmPresets(): Promise<import('../shared/types').JvmPresetInfo[]> {
    return ipcRenderer.invoke('optimizer:get-presets')
  },
  scanCache(gameDir?: string): Promise<import('../shared/types').CacheScanResult> {
    return ipcRenderer.invoke('optimizer:scan-cache', gameDir)
  },
  cleanCache(gameDir?: string, targetKeys?: string[]): Promise<import('../shared/types').CacheCleanResult> {
    return ipcRenderer.invoke('optimizer:clean-cache', gameDir, targetKeys)
  },
  optimizeInGameVideoSettings(options: import('../shared/types').OptimizeVideoSettingsOptions): Promise<import('../shared/types').OptimizeVideoSettingsResult> {
    return ipcRenderer.invoke('optimizer:optimize-video-settings', options)
  },
  checkLowEndOptimizationStatus(gameDir?: string): Promise<import('../shared/types').LowEndBoostCheckResult> {
    return ipcRenderer.invoke('optimizer:check-low-end-status', gameDir)
  },
  installEssentialMod(gameDir: string | undefined, modSlug: string, mcVersion?: string, loader?: string): Promise<import('../shared/types').InstallEssentialModResult> {
    return ipcRenderer.invoke('optimizer:install-essential-mod', gameDir, modSlug, mcVersion, loader)
  },
  installAllMissingEssentialMods(gameDir: string | undefined, mcVersion?: string, loader?: string): Promise<import('../shared/types').InstallAllEssentialModsResult> {
    return ipcRenderer.invoke('optimizer:install-all-essential-mods', gameDir, mcVersion, loader)
  },

  // Mod Auto-Updater
  checkForModUpdates(gameDir?: string, mcVersion?: string, loader?: string): Promise<import('../shared/types').ModUpdateCheckResult> {
    return ipcRenderer.invoke('mod-updater:check', gameDir, mcVersion, loader)
  },
  updateSingleMod(gameDir: string | undefined, item: import('../shared/types').ModUpdateItem): Promise<import('../shared/types').UpdateSingleModResult> {
    return ipcRenderer.invoke('mod-updater:update-single', gameDir, item)
  },
  updateAllMods(gameDir: string | undefined, items: import('../shared/types').ModUpdateItem[]): Promise<import('../shared/types').UpdateAllModsResult> {
    return ipcRenderer.invoke('mod-updater:update-all', gameDir, items)
  },

  // Mod Conflict & Crash Predictor
  checkModConflicts(gameDir?: string, mcVersion?: string, loader?: string): Promise<import('../shared/types').ModConflictCheckResult> {
    return ipcRenderer.invoke('mod-conflict:check', gameDir, mcVersion, loader)
  },
  resolveModConflict(gameDir: string | undefined, option: import('../shared/types').ResolveConflictOption, mcVersion?: string, loader?: string): Promise<import('../shared/types').ResolveConflictResult> {
    return ipcRenderer.invoke('mod-conflict:resolve', gameDir, option, mcVersion, loader)
  },
  resolveAllCriticalConflicts(gameDir: string | undefined, conflicts: import('../shared/types').ModConflictItem[], mcVersion?: string, loader?: string): Promise<import('../shared/types').ResolveConflictResult> {
    return ipcRenderer.invoke('mod-conflict:resolve-all-critical', gameDir, conflicts, mcVersion, loader)
  }
}

contextBridge.exposeInMainWorld('launcherApi', launcherApi)
export type LauncherApi = typeof launcherApi
