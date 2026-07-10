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
  AccountMode,
  MicrosoftAccount,
  StartLaunchResult,
  CancelLaunchResult,
  LaunchJobState,
  LauncherEvent,
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

      scanJavaRuntimes(customScanDirs?: string[]): Promise<JavaScanResult>
      selectBestJavaRuntime(
        minecraftVersion: string,
        customScanDirs?: string[]
      ): Promise<JavaRuntimeSelectionResult>
      autoInstallJava(
        javaVersion: number
      ): Promise<{ success: boolean; javaPath: string; message: string }>

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
      setAccountMode(mode: AccountMode): Promise<AccountState>
      updateLocalAccount(username: string): Promise<AccountState>
      saveMicrosoftAccount(account: MicrosoftAccount): Promise<AccountState>
      logoutMicrosoftAccount(): Promise<AccountState>
      loginMicrosoft(): Promise<MicrosoftAccount>

      // New non-blocking launch API
      startLaunch(input: LaunchInput): Promise<StartLaunchResult>
      cancelLaunch(): Promise<CancelLaunchResult>
      getLaunchState(): Promise<LaunchJobState>
      clearLaunchLogs(): Promise<boolean>
      onLauncherEvent(callback: (events: LauncherEvent[]) => void): () => void

      // New prepare game and caching API
      prepareGame(profile: LauncherProfile, settings: LauncherSettings): Promise<PrepareGameResult>
      checkPreparedProfile(profile: LauncherProfile, settings: LauncherSettings): Promise<PreparedProfileState>
      cancelPrepareGame(): Promise<boolean>
      clearVersionManifestCache(): Promise<boolean>
      clearPreparedProfilesCache(): Promise<boolean>
      onPrepareGameProgress(callback: (progress: PrepareGameProgress) => void): () => void
    }
  }
}

export { }
