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
  javaPath?: string | null
  minMemoryMb: number
  maxMemoryMb: number
  serverAddress?: string
  auth?: AuthSession | null
  performance?: {
    enableLaunchBoost: boolean
    launchBoostDurationMs: number
    launchBoostPriority: 'above_normal' | 'high'
  }
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

export interface LauncherProfile {
  id: string
  name: string
  minecraftVersion: string
  gameDir: string
  minMemoryMb: number
  maxMemoryMb: number
  javaPath?: string | null
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
  minMemoryMb?: number
  maxMemoryMb?: number
  javaPath?: string | null
}

export interface UpdateProfileInput {
  name?: string
  minecraftVersion?: string
  gameDir?: string
  minMemoryMb?: number
  maxMemoryMb?: number
  javaPath?: string | null
}

export interface UpdateProfileInput {
  name?: string
  minecraftVersion?: string
  gameDir?: string
  minMemoryMb?: number
  maxMemoryMb?: number
  javaPath?: string | null
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
  recommendedBoostDurationMs: number
  recommendedBoostPriority: 'above_normal' | 'high'
  reason: string
}

/** Runtime-resolved knobs (auto overrides manual). Shared main↔renderer. */
export interface EffectivePerformanceSettings {
  enableLaunchBoost: boolean
  launchBoostDurationMs: number
  launchBoostPriority: 'above_normal' | 'high'
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
  enableLaunchBoost: boolean
  launchBoostDurationMs: number
  launchBoostPriority: 'above_normal' | 'high'
  enableAutoPrepareGame: boolean
  downloadConcurrency: number
  manifestCacheTtlMs: number
  fastLaunchMode: boolean
  enableOptimizedJvmArgs: boolean
  // Auto Performance
  performanceMode: PerformanceMode
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
