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
  MicrosoftAccount,
  StartLaunchResult,
  CancelLaunchResult,
  LaunchJobState,
  LauncherEvent,
  PrepareGameResult,
  PreparedProfileState,
  PrepareGameProgress,
  ModDependencyScanResult,
  AutoFixDependenciesResult,
  MinecraftWorld,
  WorldBackupItem,
  MinecraftScreenshot,
  LogFileInfo,
  MclogsUploadResult,
  ProfileFullStats,
  ProfileLauncherStats,
  ExportProfilePackageOptions,
  ExportProfileResult,
  PackagePreviewInfo,
  ImportProfileResult,
  JvmPresetInfo,
  CacheScanResult,
  CacheCleanResult,
  ModUpdateItem,
  ModUpdateCheckResult,
  UpdateSingleModResult,
  UpdateAllModsResult,
  ModConflictItem,
  ModConflictCheckResult,
  ResolveConflictOption,
  ResolveConflictResult,
  OptimizeVideoSettingsOptions,
  OptimizeVideoSettingsResult,
  LowEndBoostCheckResult,
  InstallEssentialModResult,
  InstallAllEssentialModsResult,
} from '@/shared/types'

function getApi() {
  if (!window.launcherApi) {
    throw new Error('Launcher API is not ready.')
  }

  return window.launcherApi
}

export const launcherClient = {
  openExternal(url: string): Promise<void> {
    const api = getApi()
    if (typeof api.openExternal === 'function') {
      return api.openExternal(url)
    }
    window.open(url, '_blank')
    return Promise.resolve()
  },

  detectMinecraftDirectory(): Promise<MinecraftDirectoryResult> {
    return getApi().detectMinecraftDirectory()
  },

  getSettings(): Promise<LauncherSettings> {
    return getApi().getSettings()
  },

  updateSettings(
    input: Partial<LauncherSettings>
  ): Promise<LauncherSettings> {
    return getApi().updateSettings(input)
  },

  getSystemPerformanceInfo(): Promise<import('../../shared/types').SystemPerformanceInfo> {
    return getApi().getSystemPerformanceInfo()
  },

  getEffectivePerformanceSettings(): Promise<import('../../shared/types').EffectivePerformanceSettings> {
    return getApi().getEffectivePerformanceSettings()
  },

  getProfiles(): Promise<ProfilesStore> {
    return getApi().getProfiles()
  },

  createProfile(
    input: CreateProfileInput
  ): Promise<LauncherProfile> {
    return getApi().createProfile(input)
  },

  updateProfile(
    profileId: string,
    input: UpdateProfileInput
  ): Promise<LauncherProfile> {
    return getApi().updateProfile(profileId, input)
  },

  deleteProfile(profileId: string): Promise<boolean> {
    return getApi().deleteProfile(profileId)
  },

  setActiveProfile(profileId: string): Promise<boolean> {
    return getApi().setActiveProfile(profileId)
  },

  getMinecraftVersionCatalog(gameDir: string): Promise<MinecraftVersionCatalog> {
    return getApi().getMinecraftVersionCatalog(gameDir)
  },

  scanMinecraftDirectory(gameDir: string): Promise<MinecraftScanResult> {
    return getApi().scanMinecraftDirectory(gameDir)
  },

  scanJavaRuntimes(customScanDirs?: string[], forceRefresh?: boolean): Promise<JavaScanResult> {
    return getApi().scanJavaRuntimes(customScanDirs, forceRefresh)
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
    return getApi().selectBestJavaRuntime(minecraftVersion, customScanDirs, options)
  },

  verifyJavaPath(
    javaPath: string,
    requiredMajor: number
  ): Promise<JavaPathVerification> {
    return getApi().verifyJavaPath(javaPath, requiredMajor)
  },

  scanGameContent(gameDir: string): Promise<GameContentScanResult> {
    return getApi().scanGameContent(gameDir)
  },
  scanMods(gameDir: string): Promise<GameContentItem[]> {
    return getApi().scanMods(gameDir)
  },
  scanResourcePacks(gameDir: string): Promise<GameContentItem[]> {
    return getApi().scanResourcePacks(gameDir)
  },
  scanShaderPacks(gameDir: string): Promise<GameContentItem[]> {
    return getApi().scanShaderPacks(gameDir)
  },
  getModMetadata(jarPath: string): Promise<import('../../shared/types').GameContentMetadata> {
    return getApi().getModMetadata(jarPath)
  },

  enableGameContent(
    gameDir: string,
    itemPath: string
  ): Promise<GameContentItem> {
    return getApi().enableGameContent(gameDir, itemPath)
  },

  disableGameContent(
    gameDir: string,
    itemPath: string
  ): Promise<GameContentItem> {
    return getApi().disableGameContent(gameDir, itemPath)
  },

  deleteGameContent(gameDir: string, itemPath: string): Promise<boolean> {
    return getApi().deleteGameContent(gameDir, itemPath)
  },

  importGameContent(input: ImportGameContentInput): Promise<GameContentItem> {
    return getApi().importGameContent(input)
  },

  openContentFolder(gameDir: string, type: GameContentType): Promise<boolean> {
    return getApi().openContentFolder(gameDir, type)
  },

  inspectModDependencies(gameDir: string, mcVersion: string, loader?: string): Promise<ModDependencyScanResult> {
    return getApi().inspectModDependencies(gameDir, mcVersion, loader)
  },

  autoFixModDependencies(gameDir: string, mcVersion: string, loader?: string): Promise<AutoFixDependenciesResult> {
    return getApi().autoFixModDependencies(gameDir, mcVersion, loader)
  },


  minimizeWindow(): Promise<void> { return getApi().minimizeWindow() },
  closeWindow(): Promise<void> { return getApi().closeWindow() },
  maximizeWindow(): Promise<void> { return getApi().maximizeWindow() },
  openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null> { return getApi().openFileDialog(filters) },
  getPathForFile(file: File): string | null { return getApi().getPathForFile(file) },

  openVersionFolder(versionPath: string): Promise<boolean> {
    return getApi().openVersionFolder(versionPath)
  },

  deleteVersion(versionPath: string): Promise<boolean> {
    return getApi().deleteVersion(versionPath)
  },

  launchMinecraft(input: LaunchInput, profile: LauncherProfile): Promise<LaunchResult> {
    return getApi().launchMinecraft(input, profile)
  },

  getLaunchStatus(): Promise<LaunchStatus> {
    return getApi().getLaunchStatus()
  },

  getLauncherProgress(): Promise<LauncherProgress> {
    return getApi().getLauncherProgress()
  },

  getLauncherLogs(): Promise<LauncherLog[]> {
    return getApi().getLauncherLogs()
  },

  clearLauncherLogs(): Promise<boolean> {
    return getApi().clearLauncherLogs()
  },
  
  getMinecraftServers(page?: number): Promise<import('../../shared/types').MinecraftServer[]> {
    return getApi().getMinecraftServers(page)
  },

  injectTopServers(profileId: string, page?: number): Promise<boolean> {
    return getApi().injectTopServers(profileId, page)
  },

  getAccountState(): Promise<AccountState> {
    return getApi().getAccountState()
  },

  selectAccount(accountId: string): Promise<AccountState> {
    return getApi().selectAccount(accountId)
  },

  addLocalAccount(username: string): Promise<AccountState> {
    return getApi().addLocalAccount(username)
  },

  removeAccount(accountId: string): Promise<AccountState> {
    return getApi().removeAccount(accountId)
  },

  renameAccountLocally(accountId: string, newName: string): Promise<AccountState> {
    return getApi().renameAccountLocally(accountId, newName)
  },

  saveMicrosoftAccount(account: MicrosoftAccount): Promise<AccountState> {
    return getApi().saveMicrosoftAccount(account)
  },

  loginMicrosoft(): Promise<MicrosoftAccount> {
    return getApi().loginMicrosoft()
  },

  refreshMicrosoftAccount(accountId?: string): Promise<AccountState> {
    return getApi().refreshMicrosoftAccount(accountId)
  },

  // ── Mojang API ─────────────────────────────────────────────────────────────

  getMojangProfile(accessToken: string): Promise<import('../../shared/types').MojangProfile> {
    return getApi().getMojangProfile(accessToken)
  },

  fetchMojangTexture(url: string): Promise<string | null> {
    return getApi().fetchMojangTexture(url)
  },

  lookupPlayerSkin(usernameOrUuid: string): Promise<{ url: string; model: 'default' | 'slim'; username: string; uuid?: string; capeUrl?: string } | null> {
    return getApi().lookupPlayerSkin(usernameOrUuid)
  },

  uploadMojangSkin(accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim'): Promise<void> {
    return getApi().uploadMojangSkin(accessToken, fileBuffer, variant)
  },

  changeMojangCape(accessToken: string, capeId: string): Promise<void> {
    return getApi().changeMojangCape(accessToken, capeId)
  },

  checkMojangNameChange(accessToken: string): Promise<{ createdAt: string; nameChangeAllowed: boolean }> {
    return getApi().checkMojangNameChange(accessToken)
  },

  changeMojangName(accessToken: string, newName: string): Promise<void> {
    return getApi().changeMojangName(accessToken, newName)
  },

  // ── New non-blocking launch API ────────────────────────────────────────────

  startLaunch(input: LaunchInput): Promise<StartLaunchResult> {
    return getApi().startLaunch(input)
  },

  cancelLaunch(): Promise<CancelLaunchResult> {
    return getApi().cancelLaunch()
  },

  getLaunchState(): Promise<LaunchJobState> {
    return getApi().getLaunchState()
  },

  clearLaunchLogs(): Promise<boolean> {
    return getApi().clearLaunchLogs()
  },

  onLauncherEvent(callback: (events: LauncherEvent[]) => void): () => void {
    return getApi().onLauncherEvent(callback)
  },

  // ── New prepare game and caching API ────────────────────────────────────────

  prepareGame(profile: LauncherProfile, settings: LauncherSettings, forceRepair?: boolean): Promise<PrepareGameResult> {
    return getApi().prepareGame(profile, settings, forceRepair)
  },

  checkPreparedProfile(profile: LauncherProfile, settings: LauncherSettings): Promise<PreparedProfileState> {
    return getApi().checkPreparedProfile(profile, settings)
  },

  cancelPrepareGame(): Promise<boolean> {
    return getApi().cancelPrepareGame()
  },

  clearVersionManifestCache(): Promise<boolean> {
    return getApi().clearVersionManifestCache()
  },

  clearPreparedProfilesCache(): Promise<boolean> {
    return getApi().clearPreparedProfilesCache()
  },

  onPrepareGameProgress(callback: (progress: PrepareGameProgress) => void): () => void {
    return getApi().onPrepareGameProgress(callback)
  },

  // ── Worlds & Saves API ───────────────────────────────────────────────────

  saveFileDialog(options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
    return getApi().saveFileDialog(options)
  },

  scanWorlds(gameDir?: string): Promise<MinecraftWorld[]> {
    return getApi().scanWorlds(gameDir)
  },

  backupWorld(gameDir: string | undefined, folderName: string): Promise<{ success: boolean; backupPath: string; fileName: string; sizeBytes: number; message?: string }> {
    return getApi().backupWorld(gameDir, folderName)
  },

  listWorldBackups(gameDir: string | undefined, folderName?: string): Promise<WorldBackupItem[]> {
    return getApi().listWorldBackups(gameDir, folderName)
  },

  restoreWorldBackup(gameDir: string | undefined, backupFilePath: string, targetFolderName?: string): Promise<{ success: boolean; folderName: string }> {
    return getApi().restoreWorldBackup(gameDir, backupFilePath, targetFolderName)
  },

  deleteWorldBackup(backupFilePath: string): Promise<boolean> {
    return getApi().deleteWorldBackup(backupFilePath)
  },

  exportWorldZip(gameDir: string | undefined, folderName: string, destinationZipPath: string): Promise<boolean> {
    return getApi().exportWorldZip(gameDir, folderName, destinationZipPath)
  },

  importWorldZip(gameDir: string | undefined, sourceZipPath: string): Promise<{ success: boolean; folderName: string; name: string }> {
    return getApi().importWorldZip(gameDir, sourceZipPath)
  },

  duplicateWorld(gameDir: string | undefined, folderName: string, newWorldName?: string): Promise<{ success: boolean; newFolderName: string }> {
    return getApi().duplicateWorld(gameDir, folderName, newWorldName)
  },

  renameWorld(gameDir: string | undefined, folderName: string, newLevelName: string): Promise<boolean> {
    return getApi().renameWorld(gameDir, folderName, newLevelName)
  },

  deleteWorld(gameDir: string | undefined, folderName: string): Promise<boolean> {
    return getApi().deleteWorld(gameDir, folderName)
  },

  openWorldFolder(gameDir: string | undefined, folderName?: string): Promise<boolean> {
    return getApi().openWorldFolder(gameDir, folderName)
  },

  // ── Screenshots Gallery API ──────────────────────────────────────────────

  scanScreenshots(gameDir?: string): Promise<MinecraftScreenshot[]> {
    const api = getApi()
    if (typeof api.scanScreenshots !== 'function') {
      console.warn('[launcherClient] scanScreenshots is not available in current Electron session. Please restart Launcher.')
      return Promise.resolve([])
    }
    return api.scanScreenshots(gameDir)
  },

  copyScreenshotToClipboard(filePath: string): Promise<boolean> {
    const api = getApi()
    if (typeof api.copyScreenshotToClipboard !== 'function') {
      console.warn('[launcherClient] copyScreenshotToClipboard is not available in current Electron session. Please restart Launcher.')
      return Promise.resolve(false)
    }
    return api.copyScreenshotToClipboard(filePath)
  },

  deleteScreenshot(filePath: string): Promise<boolean> {
    const api = getApi()
    if (typeof api.deleteScreenshot !== 'function') {
      return Promise.resolve(false)
    }
    return api.deleteScreenshot(filePath)
  },

  deleteMultipleScreenshots(filePaths: string[]): Promise<boolean> {
    const api = getApi()
    if (typeof api.deleteMultipleScreenshots !== 'function') {
      return Promise.resolve(false)
    }
    return api.deleteMultipleScreenshots(filePaths)
  },

  showScreenshotInFolder(filePath: string): Promise<boolean> {
    const api = getApi()
    if (typeof api.showScreenshotInFolder !== 'function') {
      return Promise.resolve(false)
    }
    return api.showScreenshotInFolder(filePath)
  },

  openScreenshotsFolder(gameDir?: string): Promise<boolean> {
    const api = getApi()
    if (typeof api.openScreenshotsFolder !== 'function') {
      return Promise.resolve(false)
    }
    return api.openScreenshotsFolder(gameDir)
  },

  // ── Logs & Crash Reports API ─────────────────────────────────────────────

  listLogFiles(gameDir?: string): Promise<{ activeLogs: LogFileInfo[]; crashReports: LogFileInfo[] }> {
    const api = getApi()
    if (typeof api.listLogFiles !== 'function') {
      return Promise.resolve({ activeLogs: [], crashReports: [] })
    }
    return api.listLogFiles(gameDir)
  },

  readLogFile(filePath: string): Promise<string> {
    const api = getApi()
    if (typeof api.readLogFile !== 'function') {
      return Promise.reject(new Error('readLogFile API is not available'))
    }
    return api.readLogFile(filePath)
  },

  uploadLogToMclogs(content: string): Promise<MclogsUploadResult> {
    const api = getApi()
    if (typeof api.uploadLogToMclogs !== 'function') {
      return Promise.resolve({ success: false, error: 'uploadLogToMclogs API is not available' })
    }
    return api.uploadLogToMclogs(content)
  },

  deleteLogFile(filePath: string): Promise<boolean> {
    const api = getApi()
    if (typeof api.deleteLogFile !== 'function') {
      return Promise.resolve(false)
    }
    return api.deleteLogFile(filePath)
  },

  clearOldLogs(gameDir?: string): Promise<{ success: boolean; count: number; freedBytes: number }> {
    const api = getApi()
    if (typeof api.clearOldLogs !== 'function') {
      return Promise.resolve({ success: false, count: 0, freedBytes: 0 })
    }
    return api.clearOldLogs(gameDir)
  },

  openLogsFolder(gameDir: string | undefined, type?: 'logs' | 'crash-reports'): Promise<boolean> {
    const api = getApi()
    if (typeof api.openLogsFolder !== 'function') {
      return Promise.resolve(false)
    }
    return api.openLogsFolder(gameDir, type)
  },

  // ── Playtime & In-game Statistics API ────────────────────────────────────

  getFullProfileStats(gameDir: string, profileId: string, profileName?: string): Promise<ProfileFullStats> {
    const api = getApi()
    if (typeof api.getFullProfileStats !== 'function') {
      return Promise.resolve({
        profileId,
        profileName: profileName || 'Mặc định',
        launcherStats: {
          profileId,
          totalPlaytimeSeconds: 0,
          lastPlayedTimestamp: 0,
          launchCount: 0,
          sessions: [],
        },
        aggregatedInGameStats: {
          totalInGameSeconds: 0,
          worldsCount: 0,
          topMining: [],
          totalBlocksMined: 0,
          topKills: [],
          totalMobKills: 0,
          travel: {
            walkMeters: 0,
            sprintMeters: 0,
            swimMeters: 0,
            flyElytraMeters: 0,
            boatMeters: 0,
            horseMeters: 0,
            minecartMeters: 0,
            totalDistanceMeters: 0,
            jumps: 0,
          },
          survival: {
            deaths: 0,
            mobKills: 0,
            playerKills: 0,
            damageDealt: 0,
            damageTaken: 0,
            timesSlept: 0,
            chestsOpened: 0,
            fishCaught: 0,
            animalsBred: 0,
            enchantedItems: 0,
            raidsWon: 0,
          },
        },
        worlds: [],
      })
    }
    return api.getFullProfileStats(gameDir, profileId, profileName)
  },

  recordPlaySession(gameDir: string, profileId: string, durationSeconds: number, exitCode?: number): Promise<ProfileLauncherStats> {
    const api = getApi()
    if (typeof api.recordPlaySession !== 'function') {
      return Promise.resolve({
        profileId,
        totalPlaytimeSeconds: durationSeconds,
        lastPlayedTimestamp: Date.now(),
        launchCount: 1,
        sessions: [],
      })
    }
    return api.recordPlaySession(gameDir, profileId, durationSeconds, exitCode)
  },

  openStatsFolder(gameDir?: string, worldFolder?: string): Promise<boolean> {
    const api = getApi()
    if (typeof api.openStatsFolder !== 'function') {
      return Promise.resolve(false)
    }
    return api.openStatsFolder(gameDir, worldFolder)
  },

  // ── Profile Package Export / Import API ──────────────────────────────────

  exportProfilePackage(options: ExportProfilePackageOptions): Promise<ExportProfileResult> {
    const api = getApi()
    if (typeof api.exportProfilePackage !== 'function') {
      return Promise.resolve({ success: false, error: 'API xuất gói cấu hình không khả dụng.' })
    }
    return api.exportProfilePackage(options)
  },

  readProfilePackageInfo(packageFilePath: string): Promise<PackagePreviewInfo> {
    const api = getApi()
    if (typeof api.readProfilePackageInfo !== 'function') {
      return Promise.resolve({
        valid: false,
        fileName: '',
        filePath: packageFilePath,
        fileSizeBytes: 0,
        error: 'API đọc gói cấu hình không khả dụng.',
      })
    }
    return api.readProfilePackageInfo(packageFilePath)
  },

  importProfilePackage(packageFilePath: string, customName?: string): Promise<ImportProfileResult> {
    const api = getApi()
    if (typeof api.importProfilePackage !== 'function') {
      return Promise.resolve({ success: false, error: 'API nhập gói cấu hình không khả dụng.' })
    }
    return api.importProfilePackage(packageFilePath, customName)
  },

  // ── JVM Optimizer & Cache Cleaner API ────────────────────────────────────

  getJvmPresets(): Promise<JvmPresetInfo[]> {
    const api = getApi()
    if (typeof api.getJvmPresets !== 'function') {
      return Promise.resolve([])
    }
    return api.getJvmPresets()
  },

  scanCache(gameDir?: string): Promise<CacheScanResult> {
    const api = getApi()
    if (typeof api.scanCache !== 'function') {
      return Promise.resolve({ totalSizeBytes: 0, totalFileCount: 0, items: [] })
    }
    return api.scanCache(gameDir)
  },

  cleanCache(gameDir?: string, targetKeys?: string[]): Promise<CacheCleanResult> {
    const api = getApi()
    if (typeof api.cleanCache !== 'function') {
      return Promise.resolve({ success: false, freedBytes: 0, freedCount: 0, error: 'API không khả dụng' })
    }
    return api.cleanCache(gameDir, targetKeys)
  },

  optimizeInGameVideoSettings(options: OptimizeVideoSettingsOptions): Promise<OptimizeVideoSettingsResult> {
    const api = getApi()
    if (typeof api.optimizeInGameVideoSettings !== 'function') {
      return Promise.resolve({ success: false, optionsPath: '', changesApplied: [], sodiumConfigUpdated: false, message: 'API không khả dụng' })
    }
    return api.optimizeInGameVideoSettings(options)
  },

  checkLowEndOptimizationStatus(gameDir?: string): Promise<LowEndBoostCheckResult> {
    const api = getApi()
    if (typeof api.checkLowEndOptimizationStatus !== 'function') {
      return Promise.resolve({
        isOptimized: false,
        currentPreset: 'ultra_low_end',
        currentRenderDistance: 12,
        mipmapLevels: 4,
        cloudsEnabled: true,
        fastGraphics: false,
        essentialMods: [],
      })
    }
    return api.checkLowEndOptimizationStatus(gameDir)
  },

  installEssentialMod(gameDir: string | undefined, modSlug: string, mcVersion?: string, loader?: string): Promise<InstallEssentialModResult> {
    const api = getApi()
    if (typeof api.installEssentialMod !== 'function') {
      return Promise.resolve({ success: false, modId: modSlug, message: 'API không khả dụng' })
    }
    return api.installEssentialMod(gameDir, modSlug, mcVersion, loader)
  },

  installAllMissingEssentialMods(gameDir: string | undefined, mcVersion?: string, loader?: string): Promise<InstallAllEssentialModsResult> {
    const api = getApi()
    if (typeof api.installAllMissingEssentialMods !== 'function') {
      return Promise.resolve({ success: false, installedCount: 0, results: [], message: 'API không khả dụng' })
    }
    return api.installAllMissingEssentialMods(gameDir, mcVersion, loader)
  },

  // ── Mod Auto-Updater API ──────────────────────────────────────────────────

  checkForModUpdates(gameDir?: string, mcVersion?: string, loader?: string): Promise<ModUpdateCheckResult> {
    const api = getApi()
    if (typeof api.checkForModUpdates !== 'function') {
      return Promise.resolve({ totalMods: 0, upToDateCount: 0, updatesAvailableCount: 0, updates: [], error: 'API không khả dụng' })
    }
    return api.checkForModUpdates(gameDir, mcVersion, loader)
  },

  updateSingleMod(gameDir: string | undefined, item: ModUpdateItem): Promise<UpdateSingleModResult> {
    const api = getApi()
    if (typeof api.updateSingleMod !== 'function') {
      return Promise.resolve({ success: false, modId: item.modId, oldFileName: item.fileName, newFileName: item.newFileName, error: 'API không khả dụng' })
    }
    return api.updateSingleMod(gameDir, item)
  },

  updateAllMods(gameDir: string | undefined, items: ModUpdateItem[]): Promise<UpdateAllModsResult> {
    const api = getApi()
    if (typeof api.updateAllMods !== 'function') {
      return Promise.resolve({ success: false, totalUpdated: 0, failedCount: items.length, results: [] })
    }
    return api.updateAllMods(gameDir, items)
  },

  // ── Mod Conflict & Crash Predictor API ────────────────────────────────────

  checkModConflicts(gameDir?: string, mcVersion?: string, loader?: string): Promise<ModConflictCheckResult> {
    const api = getApi()
    if (typeof api.checkModConflicts !== 'function') {
      return Promise.resolve({
        totalMods: 0,
        hasCritical: false,
        criticalCount: 0,
        warningCount: 0,
        suggestionCount: 0,
        conflicts: [],
        error: 'API không khả dụng',
      })
    }
    return api.checkModConflicts(gameDir, mcVersion, loader)
  },

  resolveModConflict(gameDir: string | undefined, option: ResolveConflictOption, mcVersion?: string, loader?: string): Promise<ResolveConflictResult> {
    const api = getApi()
    if (typeof api.resolveModConflict !== 'function') {
      return Promise.resolve({ success: false, message: 'API không khả dụng', resolvedConflicts: [] })
    }
    return api.resolveModConflict(gameDir, option, mcVersion, loader)
  },

  resolveAllCriticalConflicts(gameDir: string | undefined, conflicts: ModConflictItem[], mcVersion?: string, loader?: string): Promise<ResolveConflictResult> {
    const api = getApi()
    if (typeof api.resolveAllCriticalConflicts !== 'function') {
      return Promise.resolve({ success: false, message: 'API không khả dụng', resolvedConflicts: [] })
    }
    return api.resolveAllCriticalConflicts(gameDir, conflicts, mcVersion, loader)
  },
}
