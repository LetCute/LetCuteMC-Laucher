import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  CreateProfileInput,
  GameContentItem,
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
  // New Worker-based launch types
  StartLaunchResult,
  CancelLaunchResult,
  LaunchJobState,
  LauncherEvent,
  PrepareGameResult,
  PreparedProfileState,
  PrepareGameProgress,
} from '../shared/types'

const launcherApi = {
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

  scanJavaRuntimes(customScanDirs?: string[]): Promise<JavaScanResult> {
    return ipcRenderer.invoke('java:scan', customScanDirs)
  },

  selectBestJavaRuntime(
    minecraftVersion: string,
    customScanDirs?: string[]
  ): Promise<JavaRuntimeSelectionResult> {
    return ipcRenderer.invoke('java:select-best', minecraftVersion, customScanDirs)
  },

  autoInstallJava(javaVersion: number): Promise<{ success: boolean; javaPath: string; message: string }> {
    return ipcRenderer.invoke('java:auto-install', javaVersion)
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

  minimizeWindow(): Promise<void> { return ipcRenderer.invoke('window:minimize') },
  closeWindow(): Promise<void> { return ipcRenderer.invoke('window:close') },
  maximizeWindow(): Promise<void> { return ipcRenderer.invoke('window:maximize') },
  openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null> { return ipcRenderer.invoke('dialog:open-file', filters) },
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

  setAccountMode(mode: AccountMode): Promise<AccountState> {
    return ipcRenderer.invoke('account:set-mode', mode)
  },

  updateLocalAccount(username: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:update-local', username)
  },

  saveMicrosoftAccount(account: MicrosoftAccount): Promise<AccountState> {
    return ipcRenderer.invoke('account:save-microsoft', account)
  },

  logoutMicrosoftAccount(): Promise<AccountState> {
    return ipcRenderer.invoke('account:logout-microsoft')
  },

  loginMicrosoft(): Promise<MicrosoftAccount> {
    return ipcRenderer.invoke('account:login-microsoft')
  }
}

contextBridge.exposeInMainWorld('launcherApi', launcherApi)
export type LauncherApi = typeof launcherApi
