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
} from '@/shared/types'

function getApi() {
  if (!window.launcherApi) {
    throw new Error('Launcher API is not ready.')
  }

  return window.launcherApi
}

export const launcherClient = {
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

  uploadMojangSkin(accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim'): Promise<void> {
    return getApi().uploadMojangSkin(accessToken, fileBuffer, variant)
  },

  changeMojangCape(accessToken: string, capeId: string): Promise<void> {
    return getApi().changeMojangCape(accessToken, capeId)
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
}
