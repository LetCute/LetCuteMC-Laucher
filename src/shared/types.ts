// ─── Launch types ────────────────────────────────────────────────────────────

export type LaunchStatus =
  | 'idle'
  | 'validating'
  | 'preparing'
  | 'checking_java'
  | 'checking_version'
  | 'downloading'
  | 'launching'
  | 'running'
  | 'failed'
  | 'closed'
  | 'cancelled'
  // Legacy aliases kept for backward compat
  | 'checking'
  | 'extracting'

export type LauncherProgressStage =
  | 'idle'
  | 'checking'
  | 'downloading_java'
  | 'extracting_java'
  | 'verifying_java'
  | 'checking_minecraft'
  | 'preparing_libraries'
  | 'launching'
  | 'running'
  | 'failed'
  | 'completed'

export interface LauncherProgress {
  stage: LauncherProgressStage
  title: string
  message: string
  percent: number
  currentBytes?: number
  totalBytes?: number
  speedBytesPerSecond?: number
  updatedAt: string
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthSession {
  type: 'microsoft' | 'virtual'
  username: string
  uuid: string
  accessToken: string
  clientToken?: string
  expiresAt?: string
}

// ─── Launch ──────────────────────────────────────────────────────────────────

export interface LaunchInput {
  profileId: string
  version: string
  versionType: 'release' | 'snapshot' | 'old_beta' | 'old_alpha' | 'unknown'
  gameDir: string
  /** Thư mục chứa versions/libraries/assets (thường là .minecraft chính). Dùng cho profile modpack có gameDir riêng biệt. */
  resourcePath?: string | null
  javaPath?: string | null
  minMemoryMb: number
  maxMemoryMb: number
  serverAddress?: string
  auth?: AuthSession | null
  jvmPreset?: JvmPresetType
  customJvmArgs?: string
  enableDedicatedGpu?: boolean
}

export interface LaunchResult {
  ok: boolean
  status: LaunchStatus
  message: string
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export type LauncherLogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug'

export interface LauncherLog {
  id: string
  level: LauncherLogLevel
  message: string
  createdAt: string
}

// ─── New Worker-based Launch Job ─────────────────────────────────────────────

export interface LaunchJobProgress {
  status: LaunchStatus
  title: string
  message: string
  percent: number
  current?: number
  total?: number
  updatedAt: string
}

export interface LaunchJobState {
  jobId: string | null
  status: LaunchStatus
  progress: LaunchJobProgress
  logs: LauncherLog[]
  startedAt: string | null
  endedAt: string | null
  error: string | null
}

export interface StartLaunchResult {
  ok: boolean
  jobId: string | null
  message: string
}

export interface CancelLaunchResult {
  ok: boolean
  message: string
}

export type LauncherEvent =
  | { type: 'state'; state: LaunchJobState }
  | { type: 'progress'; jobId: string; progress: LaunchJobProgress }
  | { type: 'logs'; jobId: string; logs: LauncherLog[] }
  | { type: 'status'; jobId: string; status: LaunchStatus }
  | { type: 'finished'; jobId: string; state: LaunchJobState }

// ─── Worker Messages ──────────────────────────────────────────────────────────

export interface WorkerLaunchStartMessage {
  type: 'start'
  jobId: string
  input: LaunchInput
}

export interface WorkerLaunchCancelMessage {
  type: 'cancel'
  jobId: string
}

export type WorkerInputMessage =
  | WorkerLaunchStartMessage
  | WorkerLaunchCancelMessage

export type WorkerOutputMessage =
  | { type: 'progress'; jobId: string; progress: LaunchJobProgress }
  | { type: 'log'; jobId: string; log: LauncherLog }
  | { type: 'status'; jobId: string; status: LaunchStatus }
  | { type: 'finished'; jobId: string; ok: boolean; message: string }
  | { type: 'error'; jobId: string; message: string }

// ─── New Prepare Game Types ──────────────────────────────────────────────────

export type PrepareStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'downloading'
  | 'failed'
  | 'cancelled'

export interface PrepareGameProgress {
  profileId: string
  version: string
  status: PrepareStatus
  title: string
  message: string
  percent: number
  currentTask?: string
  current?: number
  total?: number
  updatedAt: string
}

export interface PreparedProfileState {
  profileId: string
  version: string
  gameDir: string
  isReady: boolean
  checkedAt: string
  versionJsonReady: boolean
  librariesReady: boolean
  assetsReady: boolean
  javaReady: boolean
  missingFiles: number
  message: string
}

export interface PrepareGameResult {
  ok: boolean
  state: PreparedProfileState | null
  message: string
}

export interface VersionManifestCacheMeta {
  updatedAt: string
  ttlMs: number
}

export interface MinecraftVersionManifest {
  latest: {
    release: string
    snapshot: string
  }
  versions: Array<{
    id: string
    type: string
    url: string
    time: string
    releaseTime: string
    sha1: string
    complianceLevel: number
  }>
}

// ─── Minecraft Directory ──────────────────────────────────────────────────────

export interface MinecraftDirectoryResult {
  path: string | null
  found: boolean
}

export type AccountType = 'microsoft' | 'local'
/** @deprecated use AccountType */
export type AccountMode = AccountType

export interface AccountItem {
  id: string
  type: AccountType
  username: string
  uuid: string
  avatarUrl?: string
  skinUrl?: string
  capeUrl?: string
  skinModel?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

/** Microsoft login payload (same shape as AccountItem fields used by auth) */
export type MicrosoftAccount = AccountItem

export interface AccountState {
  activeAccountId: string | null
  accounts: AccountItem[]
}

// ─── Profile types ───────────────────────────────────────────────────────────

export type MinecraftVersionType =
  | 'release'
  | 'snapshot'
  | 'old_beta'
  | 'old_alpha'
  | 'unknown'

export type ModLoaderType = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge'

export interface ModLoaderVersion {
  version: string
  stable: boolean
}

export interface LauncherProfile {
  id: string
  name: string
  minecraftVersion: string
  gameDir: string
  /** Thư mục chứa versions/libraries/assets. Dùng khi gameDir là thư mục profile riêng (modpack). */
  mcRootDir?: string | null
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla'
  loaderVersion?: string
  minMemoryMb: number
  maxMemoryMb: number
  javaPath?: string | null
  jvmArgs?: string | null
  description?: string
  author?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export interface ProfilesStore {
  activeProfileId: string | null
  profiles: LauncherProfile[]
}

export interface CreateProfileInput {
  name: string
  minecraftVersion: string
  gameDir?: string
  mcRootDir?: string | null
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla'
  loaderVersion?: string
  minMemoryMb?: number
  maxMemoryMb?: number
  javaPath?: string | null
  jvmArgs?: string | null
  description?: string
  author?: string
}

export interface UpdateProfileInput {
  name?: string
  minecraftVersion?: string
  gameDir?: string
  mcRootDir?: string | null
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla'
  loaderVersion?: string
  minMemoryMb?: number
  maxMemoryMb?: number
  javaPath?: string | null
  jvmArgs?: string | null
  description?: string
  author?: string
}

export interface MinecraftServer {
  id: string
  rank: number
  name: string
  ip: string
  bannerUrl?: string
  faviconUrl?: string
  description: string
  isOnline: boolean
  players: {
    online: number
    max: number
  }
  version: string
  tags: string[]
}

// ─── Settings types ───────────────────────────────────────────────────────────

export type PerformanceMode = 'auto' | 'manual'

export interface SystemPerformanceInfo {
  cpuCores: number
  totalRamGb: number
  platform: string
  isLowEnd: boolean
  isMidEnd: boolean
  isHighEnd: boolean
}

export interface AutoPerformanceRecommendation {
  recommendedMinRam: number
  recommendedMaxRam: number
  recommendedConcurrency: number
  reason: string
}

/** Runtime-resolved knobs (auto overrides manual). Shared main↔renderer. */
export interface EffectivePerformanceSettings {
  enableAutoPrepareGame: boolean
  downloadConcurrency: number
  fastLaunchMode: boolean
  enableOptimizedJvmArgs: boolean
  defaultMinMemoryMb: number
  defaultMaxMemoryMb: number
  performanceMode: PerformanceMode
  recommendation: AutoPerformanceRecommendation
  systemInfo: SystemPerformanceInfo
}

export interface LauncherSettings {
  minecraftDirectory: string
  customJavaScanDirs: string[]
  defaultMinMemoryMb: number
  defaultMaxMemoryMb: number
  checkJavaOnStartup: boolean
  checkVersionsOnStartup: boolean
  autoCloseLauncherAfterStart: boolean
  enableAutoPrepareGame: boolean
  downloadConcurrency: number
  manifestCacheTtlMs: number
  fastLaunchMode: boolean
  enableOptimizedJvmArgs: boolean
  // Auto Performance
  performanceMode: PerformanceMode
  // Integrations
  enableDiscordRpc: boolean
  // JVM Presets & Optimization
  jvmPreset?: JvmPresetType
  customJvmArgs?: string
  enableDedicatedGpu?: boolean
  // UI Graphics Quality & Effects (Performance control)
  uiGraphicQuality?: 'auto' | 'high' | 'medium' | 'low'
}

// ─── Minecraft Version Catalog ────────────────────────────────────────────────

export type VersionSource = 'official' | 'installed_manual'

export type InstalledVersionKind =
  | 'vanilla'
  | 'fabric'
  | 'forge'
  | 'quilt'
  | 'custom'
  | 'unknown'

export interface OfficialMinecraftVersion {
  id: string
  type: 'release'
  url: string
  releaseTime: string
  time: string
  installed: boolean
}

export interface InstalledManualVersion {
  id: string
  kind: InstalledVersionKind
  path: string
  inheritsFrom?: string | null
  mainClass?: string | null
  playable: false
  message: string
}

export interface VersionCatalogResult {
  official: OfficialMinecraftVersion[]
  manualInstalled: InstalledManualVersion[]
}

// Legacy catalog kept for backward compat in other screens
export interface MinecraftVersionItem {
  id: string
  name: string
  type: MinecraftVersionType
  loader: 'vanilla' | 'unknown'
  source: 'local' | 'online' | 'local_and_online'
  isInstalled: boolean
  path: string | null
  releaseTime?: string
  url?: string
  hasJar: boolean
  hasJson: boolean
}

export interface MinecraftVersionCatalog {
  releases: MinecraftVersionItem[]
  snapshots: MinecraftVersionItem[]
  oldBeta: MinecraftVersionItem[]
  oldAlpha: MinecraftVersionItem[]
  unknown: MinecraftVersionItem[]
  all: MinecraftVersionItem[]
}

// ─── Minecraft Scanner types ──────────────────────────────────────────────────

/** @deprecated Use MinecraftVersionItem from the catalog instead */
export interface LocalMinecraftVersion {
  id: string
  name: string
  path: string
  hasJar: boolean
  hasJson: boolean
  type: 'release' | 'snapshot' | 'unknown'
  loader: 'vanilla' | 'unknown'
}

export interface LocalMinecraftFileItem {
  name: string
  path: string
  sizeBytes: number
  updatedAt: string
}

export interface LocalMinecraftSave {
  name: string
  path: string
  updatedAt: string
}

export interface MinecraftScanResult {
  gameDir: string
  exists: boolean
  versions: LocalMinecraftVersion[]
  mods: LocalMinecraftFileItem[]
  resourcePacks: LocalMinecraftFileItem[]
  shaderPacks: LocalMinecraftFileItem[]
  saves: LocalMinecraftSave[]
  latestLogPath: string | null
  optionsPath: string | null
  launcherProfilesPath: string | null
}

// ─── Java types ───────────────────────────────────────────────────────────────

export type JavaRuntimeSource =
  | 'managed'
  | 'manual'
  | 'custom'
  | 'java_home'
  | 'minecraft'
  | 'system'
  | 'path'

/** Detected Java installation. majorVersion is always the actual runtime major. */
export interface DetectedJavaRuntime {
  id: string
  javaPath: string
  javaHome: string
  /** Display version string from the runtime (e.g. 21.0.10). */
  version: string
  /** Actual major of this runtime — never the Minecraft-required major. */
  majorVersion: number
  vendor?: string
  architecture?: string
  source: JavaRuntimeSource
  valid: boolean
  /** @deprecated use version */
  rawVersion: string
  /** @deprecated use valid */
  isValid: boolean
}

export interface JavaScanResult {
  runtimes: DetectedJavaRuntime[]
  message: string
}

/** Required major may be any positive int from metadata (8, 16, 17, 21, …). */
export type RequiredJavaVersion = number

export interface JavaCompatibility {
  runtime: DetectedJavaRuntime
  requiredMajor: number
  actualMajor: number
  compatible: boolean
  exactMatch: boolean
  reason?: string
}

export interface JavaRuntimeSelectionResult {
  found: boolean
  /** @deprecated use requiredMajor */
  requiredVersion: RequiredJavaVersion
  requiredMajor: number
  selectedRuntime: DetectedJavaRuntime | null
  candidates: DetectedJavaRuntime[]
  isExactMatch: boolean
  isFallback: boolean
  warning: string | null
  message: string
}

export interface JavaPathVerification {
  valid: boolean
  majorVersion: number | null
  version: string | null
  compatible: boolean
  requiredMajor: number
  message: string
}

export interface JavaVersionResult {
  ok: boolean
  majorVersion: number | null
  rawVersion: string | null
  rawOutput: string
  message: string
}

// ─── Java Installer types ─────────────────────────────────────────────────────

export interface JavaInstallProgress {
  stage: 'downloading' | 'extracting' | 'verifying'
  percent: number
  message: string
  currentBytes?: number
  totalBytes?: number
}

export interface JavaInstallResult {
  success: boolean
  javaPath: string
  message: string
}

// ─── Game Content types (Mods, Resource Packs, Shader Packs) ─────────────────

export type GameContentType = 'mod' | 'resource_pack' | 'shader_pack'

export type GameContentStatus = 'enabled' | 'disabled'

export interface GameContentMetadata {
  modId?: string
  version?: string
  loader?: 'fabric' | 'forge' | 'quilt' | 'neoforge' | 'unknown'
  description?: string
  packFormat?: number
}

export interface GameContentItem {
  id: string
  type: GameContentType
  name: string
  fileName: string
  path: string
  sizeBytes: number
  updatedAt: string
  status: GameContentStatus
  extension: string
  isDirectory: boolean
  metadata: GameContentMetadata
}

export interface GameContentScanResult {
  gameDir: string
  mods: GameContentItem[]
  resourcePacks: GameContentItem[]
  shaderPacks: GameContentItem[]
  counts: {
    enabledMods: number
    disabledMods: number
    resourcePacks: number
    shaderPacks: number
  }
}

export interface ImportGameContentInput {
  gameDir: string
  sourcePath: string
  type: GameContentType
}

// ─── UI-only types ────────────────────────────────────────────────────────────

export interface UserSession {
  isLoggedIn: boolean
  username: string | null
  accountType: 'Premium' | 'Guest'
}

// ─── Modrinth Store ─────────────────────────────────────────────────────────

export interface ModrinthProject {
  project_id: string
  slug: string
  title: string
  description: string
  categories: string[]
  client_side: string
  server_side: string
  project_type: string
  downloads: number
  icon_url: string
  author: string
  versions: string[]
}

export interface ModrinthSearchResult {
  hits: ModrinthProject[]
  offset: number
  limit: number
  total_hits: number
}

export interface ModrinthVersion {
  id: string
  project_id: string
  author_id: string
  featured: boolean
  name: string
  version_number: string
  changelog: string
  date_published: string
  downloads: number
  version_type: 'release' | 'beta' | 'alpha'
  loaders: string[]
  game_versions: string[]
  files: {
    hashes: {
      sha1: string
      sha512: string
    }
    url: string
    filename: string
    primary: boolean
    size: number
  }[]
  dependencies: {
    version_id: string | null
    project_id: string | null
    file_name: string | null
    dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
  }[]
}

export interface StoreInstallation {
  projectId: string
  versionId: string
  projectType: string
  title: string
  versionName: string
  installedAt: string
  files: string[] // Paths of installed files relative to gameDir
}

// ─── Background Tasks (Task Manager) ──────────────────────────────────────────

export type BackgroundTaskStatus = 'running' | 'success' | 'error' | 'cancelled'

export interface BackgroundTask {
  id: string
  name: string
  status: BackgroundTaskStatus
  percent: number
  message: string
  createdAt: string
  updatedAt: string
  taskType?: 'install-modpack' | 'install-mod'
  result?: any
}

export type TaskManagerEvent =
  | { type: 'tasks-updated'; tasks: BackgroundTask[] }
  | { type: 'task-completed'; task: BackgroundTask }

// ─── Mojang API Types ────────────────────────────────────────────────────────

export interface MojangSkin {
  id: string
  state: 'ACTIVE' | 'INACTIVE'
  url: string
  variant: 'CLASSIC' | 'SLIM'
}

export interface MojangCape {
  id: string
  state: 'ACTIVE' | 'INACTIVE'
  url: string
  alias: string
}

export interface MojangProfile {
  id: string
  name: string
  skins: MojangSkin[]
  capes: MojangCape[]
}

// ─── Mod Dependency Inspector & Auto-Fixer Types ─────────────────────────────

export interface ModDependencyInfo {
  modId: string
  versionRange?: string
  optional?: boolean
}

export interface ScannedModInfo {
  fileName: string
  filePath: string
  loader: 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'unknown'
  modId: string
  name: string
  version: string
  provides: string[]
  dependencies: ModDependencyInfo[]
}

export interface MissingModDependency {
  modId: string
  requiredBy: string
  requiredByFileName: string
  versionRange?: string
  optional?: boolean
  resolvedProject?: {
    id: string
    slug: string
    title: string
    iconUrl?: string | null
    description?: string
    versionId: string
    versionNumber: string
    downloadUrl: string
    fileName: string
    fileSize: number
  } | null
}

export interface ModDependencyScanResult {
  totalMods: number
  installedModIds: string[]
  missingDependencies: MissingModDependency[]
  hasIssues: boolean
}

export interface AutoFixDependenciesResult {
  success: boolean
  fixedCount: number
  downloadedMods: Array<{ title: string; fileName: string }>
  unresolvedMods: string[]
  message: string
}

// ─── Worlds & Saves types ──────────────────────────────────────────────────

export type WorldGameType = 'survival' | 'creative' | 'adventure' | 'spectator' | 'hardcore' | 'unknown'
export type WorldDifficulty = 'peaceful' | 'easy' | 'normal' | 'hard' | 'unknown'

export interface MinecraftWorld {
  folderName: string
  folderPath?: string
  path?: string
  name: string
  versionName: string
  versionId?: number
  gameType: WorldGameType
  gameTypeRaw?: number
  difficulty: WorldDifficulty
  hardcore?: boolean
  isHardcore: boolean
  cheatsEnabled?: boolean
  allowCommands: boolean
  lastPlayed: number
  sizeBytes: number
  iconBase64?: string | null
  seed?: string
  backupCount: number
  datapacks?: Array<{ name: string; enabled: boolean; description?: string }>
}

export interface WorldBackupItem {
  id: string
  fileName: string
  filePath: string
  worldFolderName: string
  createdAt: number
  sizeBytes: number
}

// ─── Screenshots types ───────────────────────────────────────────────────────

export interface MinecraftScreenshot {
  id: string
  fileName: string
  filePath: string
  sizeBytes: number
  createdAt: number
  dataUrl?: string
}

// ─── Logs & Crash Reports types ──────────────────────────────────────────

export interface LogFileInfo {
  id: string
  fileName: string
  filePath: string
  sizeBytes: number
  createdAt: number
  isCrashReport: boolean
  isCompressed: boolean
}

export type LogLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'DEBUG'

export interface ParsedLogLine {
  id: number
  raw: string
  timestamp?: string
  thread?: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'DEBUG' | 'UNKNOWN'
  logger?: string
  message: string
}

export interface LogDiagnosisItem {
  type: 'danger' | 'warning' | 'info'
  title: string
  description: string
  suggestion?: string
  sourceMod?: string
}

export interface MclogsUploadResult {
  success: boolean
  url?: string
  id?: string
  raw?: string
  error?: string
}

// ─── Playtime & In-game Statistics types ─────────────────────────────────────

export interface PlaySessionRecord {
  id: string
  startTime: number
  endTime: number
  durationSeconds: number
  exitCode?: number
}

export interface ProfileLauncherStats {
  profileId: string
  totalPlaytimeSeconds: number
  lastPlayedTimestamp: number
  launchCount: number
  sessions: PlaySessionRecord[]
}

export interface MiningStatItem {
  id: string
  name: string
  count: number
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  iconKey: string
}

export interface MobKillStatItem {
  id: string
  name: string
  count: number
  isBoss: boolean
  iconKey: string
}

export interface TravelStats {
  walkMeters: number
  sprintMeters: number
  swimMeters: number
  flyElytraMeters: number
  boatMeters: number
  horseMeters: number
  minecartMeters: number
  totalDistanceMeters: number
  jumps: number
}

export interface SurvivalLifeStats {
  deaths: number
  mobKills: number
  playerKills: number
  damageDealt: number
  damageTaken: number
  timesSlept: number
  chestsOpened: number
  fishCaught: number
  animalsBred: number
  enchantedItems: number
  raidsWon: number
}

export interface WorldStatsSummary {
  worldFolder: string
  worldName: string
  playerUuid: string
  inGamePlaytimeTicks: number
  inGamePlaytimeSeconds: number
  mining: MiningStatItem[]
  combat: MobKillStatItem[]
  travel: TravelStats
  survival: SurvivalLifeStats
}

export interface ProfileFullStats {
  profileId: string
  profileName: string
  launcherStats: ProfileLauncherStats
  aggregatedInGameStats: {
    totalInGameSeconds: number
    worldsCount: number
    topMining: MiningStatItem[]
    totalBlocksMined: number
    topKills: MobKillStatItem[]
    totalMobKills: number
    travel: TravelStats
    survival: SurvivalLifeStats
  }
  worlds: WorldStatsSummary[]
}

// ─── LAN Discovery types ───────────────────────────────────────────────────

export interface LanServerInfo {
  motd: string
  address: string
  port: number
  lastSeen: number
}

// ─── Profile Package Export / Import types ──────────────────────────────────

export interface ProfilePackageManifest {
  formatVersion: number
  appName: 'LetCuteMC'
  exportedAt: string
  name: string
  minecraftVersion: string
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla'
  loaderVersion?: string
  minMemoryMb?: number
  maxMemoryMb?: number
  javaPath?: string | null
  jvmArgs?: string | null
  description?: string
  author?: string
  includedFeatures: {
    mods: boolean
    config: boolean
    shaderpacks: boolean
    resourcepacks: boolean
    options: boolean
    servers: boolean
  }
  modsCount: number
}

export interface ExportProfilePackageOptions {
  profileId: string
  destinationPath: string
  includeMods: boolean
  includeConfig: boolean
  includeShaderPacks: boolean
  includeResourcePacks: boolean
  includeOptions: boolean
  includeServers: boolean
  description?: string
  author?: string
}

export interface ExportProfileResult {
  success: boolean
  outputPath?: string
  fileSizeBytes?: number
  error?: string
}

export interface PackagePreviewInfo {
  valid: boolean
  manifest?: ProfilePackageManifest
  fileName: string
  filePath: string
  fileSizeBytes: number
  error?: string
}

export interface ImportProfileResult {
  success: boolean
  profile?: LauncherProfile
  error?: string
}

// ─── JVM Optimizer & Game Performance Types ──────────────────────────────────

export type JvmPresetType = 'aikar' | 'shenandoah' | 'zgc' | 'low_end' | 'ultra_low_end' | 'default' | 'custom'

export interface JvmPresetInfo {
  id: JvmPresetType
  name: string
  tagline: string
  description: string
  minJavaVersion: number
  recommended: boolean
  flags: string[]
}

export interface CacheItemDetail {
  key: string
  label: string
  description: string
  sizeBytes: number
  fileCount: number
  paths: string[]
}

export interface CacheScanResult {
  totalSizeBytes: number
  totalFileCount: number
  items: CacheItemDetail[]
}

export interface CacheCleanResult {
  success: boolean
  freedBytes: number
  freedCount: number
  error?: string
}

export type LowEndOptimizationLevel =
  | 'ultra_potato'
  | 'balanced_low'
  | 'high_quality'
  | 'ultra_quality'
  | 'restore_default'

export interface OptimizeVideoSettingsOptions {
  gameDir?: string
  level: LowEndOptimizationLevel
  customRenderDistance?: number
  disableMipmap?: boolean
  disableClouds?: boolean
  fastGraphics?: boolean
  tuneSodium?: boolean
}

export interface OptimizeVideoSettingsResult {
  success: boolean
  optionsPath: string
  changesApplied: string[]
  sodiumConfigUpdated: boolean
  message: string
}

export interface EssentialModItem {
  id: string
  name: string
  slug: string
  installed: boolean
  category: 'render' | 'memory' | 'cpu' | 'fps'
  description: string
  impact: 'extreme' | 'high' | 'medium'
}

export interface LowEndBoostCheckResult {
  isOptimized: boolean
  currentPreset: JvmPresetType
  currentRenderDistance: number
  mipmapLevels: number
  cloudsEnabled: boolean
  fastGraphics: boolean
  essentialMods: EssentialModItem[]
}

export interface InstallEssentialModResult {
  success: boolean
  modId: string
  fileName?: string
  message: string
}

export interface InstallAllEssentialModsResult {
  success: boolean
  installedCount: number
  results: Array<{ modId: string; modName: string; success: boolean; message?: string }>
  message: string
}

// ─── Mod Auto-Updater Types ──────────────────────────────────────────────────

export interface ModUpdateItem {
  fileName: string
  filePath: string
  modId: string
  modName: string
  currentVersion: string
  newVersion: string
  newVersionName: string
  newVersionId: string
  changelog: string
  downloadUrl: string
  newFileName: string
  newFileSize: number
  releaseDate: string
  updateAvailable: boolean
  projectId: string
  projectIconUrl?: string | null
  loader?: string
}

export interface ModUpdateCheckResult {
  totalMods: number
  upToDateCount: number
  updatesAvailableCount: number
  updates: ModUpdateItem[]
  error?: string
}

export interface UpdateSingleModResult {
  success: boolean
  modId: string
  oldFileName: string
  newFileName: string
  error?: string
}

export interface UpdateAllModsResult {
  success: boolean
  totalUpdated: number
  failedCount: number
  results: Array<{ modId: string; modName: string; success: boolean; error?: string }>
}

// ─── Mod Conflict & Crash Predictor Types ────────────────────────────────────

export type ModConflictSeverity = 'critical' | 'warning' | 'suggestion'
export type ModConflictType =
  | 'performance_conflict'
  | 'loader_mismatch'
  | 'duplicate_mod'
  | 'missing_companion'
  | 'declared_incompatible'
  | 'java_version'

export type ModConflictAction = 'disable_mod' | 'delete_mod' | 'install_companion'

export interface ModConflictItem {
  id: string
  severity: ModConflictSeverity
  type: ModConflictType
  title: string
  description: string
  involvedMods: Array<{ fileName: string; modId?: string; name?: string }>
  recommendedAction: ModConflictAction
  actionLabel: string
  targetFileName?: string
  companionModInfo?: { modId: string; slug: string; name: string }
}

export interface ModConflictCheckResult {
  totalMods: number
  hasCritical: boolean
  criticalCount: number
  warningCount: number
  suggestionCount: number
  conflicts: ModConflictItem[]
  error?: string
}

export interface ResolveConflictOption {
  conflictId: string
  action: ModConflictAction
  targetFileName?: string
  companionModSlug?: string
}

export interface ResolveConflictResult {
  success: boolean
  message: string
  resolvedConflicts: string[]
}

// ─── Service Response Pattern (Standardized Result) ──────────────────────────

/**
 * Standardized response wrapper for all IPC service calls.
 * Ensures consistent error handling between Main ↔ Renderer.
 *
 * Usage:
 *   return { success: true, data: result }
 *   return { success: false, error: 'Something went wrong' }
 */
export interface ServiceResponse<T = void> {
  success: boolean
  data?: T
  error?: string
  /** Optional error code for programmatic handling in Renderer */
  code?: string
}

/**
 * Helper to create a successful ServiceResponse
 */
export function okResponse<T>(data: T): ServiceResponse<T> {
  return { success: true, data }
}

/**
 * Helper to create a failed ServiceResponse
 */
export function errResponse(error: string, code?: string): ServiceResponse<never> {
  return { success: false, error, code }
}
