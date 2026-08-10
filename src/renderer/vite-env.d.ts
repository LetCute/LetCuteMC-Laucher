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
} from '../shared/types'

declare global {
  interface Window {
    launcherApi: {
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

      getAccountState(): Promise<AccountState>
      selectAccount(accountId: string): Promise<AccountState>
      addLocalAccount(username: string): Promise<AccountState>
      removeAccount(accountId: string): Promise<AccountState>
      saveMicrosoftAccount(account: MicrosoftAccount): Promise<AccountState>
      loginMicrosoft(): Promise<MicrosoftAccount>
      refreshMicrosoftAccount(accountId?: string): Promise<AccountState>

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
      installFabric(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string>
      installQuilt(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string>

      // Modrinth API
      searchModrinth(query: string, projectType: string, offset: number): Promise<import('../shared/types').ModrinthSearchResult>
      getModrinthVersions(projectId: string): Promise<import('../shared/types').ModrinthVersion[]>
      installModrinthModpack(versionId: string, profileName: string): Promise<string>
      
      // Store Management
      getStoreInstallations(gameDir: string): Promise<import('../shared/types').StoreInstallation[]>
      installStoreMod(versionId: string, gameDir: string): Promise<boolean>
      uninstallStoreItem(projectId: string, gameDir: string): Promise<boolean>
    }
  }
}

export { }
