/// <reference types="vite/client" />

import type {
  CreateProfileInput,
  GameContentItem,
  GameContentMetadata,
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
  ModLoaderVersion,
  ModDependencyScanResult,
  AutoFixDependenciesResult,
} from '../shared/types'


declare global {
  interface Window {
    launcherApi: {
      readLocalImageBase64(filePath: string): Promise<string | null>
      detectMinecraftDirectory(): Promise<MinecraftDirectoryResult>

      getSettings(): Promise<LauncherSettings>
      updateSettings(
        input: Partial<LauncherSettings>
      ): Promise<LauncherSettings>
      getSystemPerformanceInfo(): Promise<import('../shared/types').SystemPerformanceInfo>
      getEffectivePerformanceSettings(): Promise<import('../shared/types').EffectivePerformanceSettings>

      getProfiles(): Promise<ProfilesStore>
      createProfile(
        input: CreateProfileInput
      ): Promise<LauncherProfile>
      updateProfile(
        profileId: string,
        input: UpdateProfileInput
      ): Promise<LauncherProfile>
      deleteProfile(profileId: string): Promise<boolean>
      setActiveProfile(profileId: string): Promise<boolean>

      getMinecraftVersionCatalog(gameDir: string): Promise<MinecraftVersionCatalog>
      scanMinecraftDirectory(gameDir: string): Promise<MinecraftScanResult>

      scanJavaRuntimes(customScanDirs?: string[], forceRefresh?: boolean): Promise<JavaScanResult>
      selectBestJavaRuntime(
        minecraftVersion: string,
        customScanDirs?: string[],
        options?: {
          gameDir?: string
          allowNewer?: boolean
          preferredJavaPath?: string | null
          forceRefresh?: boolean
        }
      ): Promise<JavaRuntimeSelectionResult>
      autoInstallJava(
        javaVersion: number
      ): Promise<{ success: boolean; javaPath: string; message: string }>
      verifyJavaPath(
        javaPath: string,
        requiredMajor: number
      ): Promise<JavaPathVerification>

      scanGameContent(gameDir: string): Promise<GameContentScanResult>
      scanMods(gameDir: string): Promise<GameContentItem[]>
      scanResourcePacks(gameDir: string): Promise<GameContentItem[]>
      scanShaderPacks(gameDir: string): Promise<GameContentItem[]>
      getModMetadata(jarPath: string): Promise<GameContentMetadata>
      enableGameContent(
        gameDir: string,
        itemPath: string
      ): Promise<GameContentItem>
      disableGameContent(
        gameDir: string,
        itemPath: string
      ): Promise<GameContentItem>
      deleteGameContent(gameDir: string, itemPath: string): Promise<boolean>
      importGameContent(input: ImportGameContentInput): Promise<GameContentItem>
      openContentFolder(gameDir: string, type: GameContentType): Promise<boolean>
      inspectModDependencies(gameDir: string, mcVersion: string, loader?: string): Promise<ModDependencyScanResult>
      autoFixModDependencies(gameDir: string, mcVersion: string, loader?: string): Promise<AutoFixDependenciesResult>


      openExternal(url: string): Promise<void>
      minimizeWindow(): Promise<void>
      closeWindow(): Promise<void>
      maximizeWindow(): Promise<void>

      openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null>

      getPathForFile(file: File): string | null

      openVersionFolder(versionPath: string): Promise<boolean>
      deleteVersion(versionPath: string): Promise<boolean>

      launchMinecraft(input: LaunchInput, profile: LauncherProfile): Promise<LaunchResult>
      getLaunchStatus(): Promise<LaunchStatus>
      getLauncherProgress(): Promise<LauncherProgress>
      getLauncherLogs(): Promise<LauncherLog[]>
      clearLauncherLogs(): Promise<boolean>
      
      getMinecraftServers(page?: number): Promise<import('../shared/types').MinecraftServer[]>
      injectTopServers(profileId: string, page?: number): Promise<boolean>

      getAccountState(): Promise<AccountState>
      selectAccount(accountId: string): Promise<AccountState>
      addLocalAccount(username: string): Promise<AccountState>
      removeAccount(accountId: string): Promise<AccountState>
      renameAccountLocally(accountId: string, newName: string): Promise<AccountState>
      saveLocalSkin(accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null): Promise<AccountState>
      saveMicrosoftAccount(account: MicrosoftAccount): Promise<AccountState>
      loginMicrosoft(): Promise<MicrosoftAccount>
      refreshMicrosoftAccount(accountId?: string): Promise<AccountState>
      
      // Mojang API
      getMojangProfile(accessToken: string): Promise<import('../shared/types').MojangProfile>
      fetchMojangTexture(url: string): Promise<string | null>
      lookupPlayerSkin(usernameOrUuid: string): Promise<{ url: string; model: 'default' | 'slim'; username: string; uuid?: string; capeUrl?: string } | null>
      uploadMojangSkin(accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim'): Promise<void>
      changeMojangCape(accessToken: string, capeId: string): Promise<void>
      checkMojangNameChange(accessToken: string): Promise<{ createdAt: string; nameChangeAllowed: boolean }>
      changeMojangName(accessToken: string, newName: string): Promise<void>

      // New non-blocking launch API
      startLaunch(input: LaunchInput): Promise<StartLaunchResult>
      cancelLaunch(): Promise<CancelLaunchResult>
      getLaunchState(): Promise<LaunchJobState>
      clearLaunchLogs(): Promise<boolean>
      onLauncherEvent(callback: (events: LauncherEvent[]) => void): () => void

      // New prepare game and caching API
      prepareGame(profile: LauncherProfile, settings: LauncherSettings, forceRepair?: boolean): Promise<PrepareGameResult>
      checkPreparedProfile(profile: LauncherProfile, settings: LauncherSettings): Promise<PreparedProfileState>
      cancelPrepareGame(): Promise<boolean>
      clearVersionManifestCache(): Promise<boolean>
      clearPreparedProfilesCache(): Promise<boolean>
      onPrepareGameProgress(callback: (progress: PrepareGameProgress) => void): () => void

      // Mod Loader API
      getFabricVersions(): Promise<ModLoaderVersion[]>
      getQuiltVersions(): Promise<ModLoaderVersion[]>
      getForgeVersions(): Promise<ModLoaderVersion[]>
      getNeoForgeVersions(): Promise<ModLoaderVersion[]>
      installFabric(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string>
      installQuilt(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string>
      installForge(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string>
      installNeoForge(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string>

      // Modrinth API
      searchModrinth(query: string, projectType: string, offset: number): Promise<import('../shared/types').ModrinthSearchResult>
      getModrinthVersions(projectId: string): Promise<import('../shared/types').ModrinthVersion[]>
      installModrinthModpack(versionId: string, profileName: string): Promise<string>
      installLocalModrinthModpack(mrpackPath: string, profileName: string): Promise<string>
      
      // Store Management
      getStoreInstallations(gameDir: string): Promise<import('../shared/types').StoreInstallation[]>
      installStoreMod(versionId: string, gameDir: string): Promise<boolean>
      uninstallStoreItem(projectId: string, gameDir: string): Promise<boolean>

      // Task Manager API
      getAllTasks(): Promise<import('../shared/types').BackgroundTask[]>
      clearCompletedTasks(): Promise<void>
      onTasksUpdate(callback: (events: import('../shared/types').TaskManagerEvent) => void): () => void

      // Discord RPC
      setDiscordActivity(details: string, state: string): Promise<boolean>

      // Auto Updater
      checkForUpdates(): Promise<any>
      quitAndInstallUpdate(): Promise<void>
      onUpdateStatus(callback: (status: { type: string, message: string, data?: any }) => void): () => void

      // File Dialogs
      saveFileDialog(options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>

      // Worlds & Saves API
      scanWorlds(gameDir?: string): Promise<import('../shared/types').MinecraftWorld[]>
      backupWorld(gameDir: string | undefined, folderName: string): Promise<{ success: boolean; backupPath: string; fileName: string; sizeBytes: number; message?: string }>
      listWorldBackups(gameDir: string | undefined, folderName?: string): Promise<import('../shared/types').WorldBackupItem[]>
      restoreWorldBackup(gameDir: string | undefined, backupFilePath: string, targetFolderName?: string): Promise<{ success: boolean; folderName: string }>
      deleteWorldBackup(backupFilePath: string): Promise<boolean>
      exportWorldZip(gameDir: string | undefined, folderName: string, destinationZipPath: string): Promise<boolean>
      importWorldZip(gameDir: string | undefined, sourceZipPath: string): Promise<{ success: boolean; folderName: string; name: string }>
      duplicateWorld(gameDir: string | undefined, folderName: string, newWorldName?: string): Promise<{ success: boolean; newFolderName: string }>
      renameWorld(gameDir: string | undefined, folderName: string, newLevelName: string): Promise<boolean>
      deleteWorld(gameDir: string | undefined, folderName: string): Promise<boolean>
      openWorldFolder(gameDir: string | undefined, folderName?: string): Promise<boolean>

      // Screenshots Gallery API
      scanScreenshots(gameDir?: string): Promise<import('../shared/types').MinecraftScreenshot[]>
      copyScreenshotToClipboard(filePath: string): Promise<boolean>
      deleteScreenshot(filePath: string): Promise<boolean>
      deleteMultipleScreenshots(filePaths: string[]): Promise<boolean>
      showScreenshotInFolder(filePath: string): Promise<boolean>
      openScreenshotsFolder(gameDir?: string): Promise<boolean>

      // Logs & Crash Reports API
      listLogFiles(gameDir?: string): Promise<{ activeLogs: import('../shared/types').LogFileInfo[]; crashReports: import('../shared/types').LogFileInfo[] }>
      readLogFile(filePath: string): Promise<string>
      uploadLogToMclogs(content: string): Promise<import('../shared/types').MclogsUploadResult>
      deleteLogFile(filePath: string): Promise<boolean>
      clearOldLogs(gameDir?: string): Promise<{ success: boolean; count: number; freedBytes: number }>
      openLogsFolder(gameDir: string | undefined, type?: 'logs' | 'crash-reports'): Promise<boolean>

      // Playtime & In-game Statistics API
      getFullProfileStats(gameDir: string, profileId: string, profileName?: string): Promise<import('../shared/types').ProfileFullStats>
      recordPlaySession(gameDir: string, profileId: string, durationSeconds: number, exitCode?: number): Promise<import('../shared/types').ProfileLauncherStats>
      openStatsFolder(gameDir?: string, worldFolder?: string): Promise<boolean>

      // Profile Package Export / Import API
      exportProfilePackage(options: import('../shared/types').ExportProfilePackageOptions): Promise<import('../shared/types').ExportProfileResult>
      readProfilePackageInfo(packageFilePath: string): Promise<import('../shared/types').PackagePreviewInfo>
      importProfilePackage(packageFilePath: string, customName?: string): Promise<import('../shared/types').ImportProfileResult>

      // JVM Optimizer & Cache Cleaner API
      getJvmPresets(): Promise<import('../shared/types').JvmPresetInfo[]>
      scanCache(gameDir?: string): Promise<import('../shared/types').CacheScanResult>
      cleanCache(gameDir?: string, targetKeys?: string[]): Promise<import('../shared/types').CacheCleanResult>
      optimizeInGameVideoSettings(options: import('../shared/types').OptimizeVideoSettingsOptions): Promise<import('../shared/types').OptimizeVideoSettingsResult>
      checkLowEndOptimizationStatus(gameDir?: string): Promise<import('../shared/types').LowEndBoostCheckResult>
      installEssentialMod(gameDir: string | undefined, modSlug: string, mcVersion?: string, loader?: string): Promise<import('../shared/types').InstallEssentialModResult>
      installAllMissingEssentialMods(gameDir: string | undefined, mcVersion?: string, loader?: string): Promise<import('../shared/types').InstallAllEssentialModsResult>

      // Mod Auto-Updater API
      checkForModUpdates(gameDir?: string, mcVersion?: string, loader?: string): Promise<import('../shared/types').ModUpdateCheckResult>
      updateSingleMod(gameDir: string | undefined, item: import('../shared/types').ModUpdateItem): Promise<import('../shared/types').UpdateSingleModResult>
      updateAllMods(gameDir: string | undefined, items: import('../shared/types').ModUpdateItem[]): Promise<import('../shared/types').UpdateAllModsResult>

      // Mod Conflict & Crash Predictor API
      checkModConflicts(gameDir?: string, mcVersion?: string, loader?: string): Promise<import('../shared/types').ModConflictCheckResult>
      resolveModConflict(gameDir: string | undefined, option: import('../shared/types').ResolveConflictOption, mcVersion?: string, loader?: string): Promise<import('../shared/types').ResolveConflictResult>
      resolveAllCriticalConflicts(gameDir: string | undefined, conflicts: import('../shared/types').ModConflictItem[], mcVersion?: string, loader?: string): Promise<import('../shared/types').ResolveConflictResult>
    }
  }
}

export { }
