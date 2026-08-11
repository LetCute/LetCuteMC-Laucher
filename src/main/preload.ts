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

  getFabricVersions(): Promise<ModLoaderVersion[]> {
    return ipcRenderer.invoke('modloader:get-fabric-versions')
  },

  getQuiltVersions(): Promise<ModLoaderVersion[]> {
    return ipcRenderer.invoke('modloader:get-quilt-versions')
  },

  installFabric(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
    return ipcRenderer.invoke('modloader:install-fabric', mcVersion, loaderVersion, gameDir)
  },

  installQuilt(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
    return ipcRenderer.invoke('modloader:install-quilt', mcVersion, loaderVersion, gameDir)
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

  selectAccount(accountId: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:select', accountId)
  },

  addLocalAccount(username: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:add-local', username)
  },

  removeAccount(accountId: string): Promise<AccountState> {
    return ipcRenderer.invoke('account:remove', accountId)
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

  uploadMojangSkin(accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim'): Promise<void> {
    return ipcRenderer.invoke('mojang:upload-skin', accessToken, fileBuffer, variant)
  },

  changeMojangCape(accessToken: string, capeId: string): Promise<void> {
    return ipcRenderer.invoke('mojang:change-cape', accessToken, capeId)
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

  getStoreInstallations(gameDir: string): Promise<import('../shared/types').StoreInstallation[]> {
    return ipcRenderer.invoke('store:get-installations', gameDir)
  },

  installStoreMod(versionId: string, gameDir: string): Promise<boolean> {
    return ipcRenderer.invoke('store:install-mod', { versionId, gameDir })
  },

  uninstallStoreItem(projectId: string, gameDir: string): Promise<boolean> {
    return ipcRenderer.invoke('store:uninstall-item', { projectId, gameDir })
  }
}

contextBridge.exposeInMainWorld('launcherApi', launcherApi)
export type LauncherApi = typeof launcherApi
