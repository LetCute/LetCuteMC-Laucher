import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  DetectedJavaRuntime,
  JavaRuntimeSelectionResult,
  JavaRuntimeSource,
  JavaScanResult,
  JavaCompatibility,
} from '../../../shared/types'
import { autoInstallJava, getDefaultJavaInstallDir } from './javaInstallerService'
import { getJavaCacheFilePath } from '../system/storageService'
import {
  JAVA_EXE,
  getPlatformJavaCandidateRoots,
  getPlatformWhereJavaCommand,
} from '../../utils/platform.js'

const execFileAsync = promisify(execFile)

const INSPECT_TIMEOUT_MS = 8000
const INSPECT_MAX_BUFFER = 1024 * 1024
const SCAN_MAX_DEPTH = 3
const INSPECT_CONCURRENCY = 4
const CACHE_TTL_MS = 10 * 60 * 1000

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'library',
  'appdata',
  'system32',
  'windows',
  'winsxs',
  'temp',
  'tmp',
  '$recycle.bin',
])

// ─── pure helpers ────────────────────────────────────────────────────────────

/** Parse major from a Java version string. Returns null on failure — never defaults. */
export function parseJavaMajor(version: string | null | undefined): number | null {
  if (!version) return null
  const cleaned = String(version).trim()
  if (!cleaned) return null

  // Java 8 legacy: 1.8 / 1.8.0_431
  const legacy = cleaned.match(/^1\.(\d+)/)
  if (legacy) {
    const major = Number(legacy[1])
    return Number.isFinite(major) && major > 0 ? major : null
  }

  // Modern: 17, 17.0.12, 21.0.10, 25-ea, 25.0.1+10-LTS
  const modern = cleaned.match(/^(\d+)/)
  if (!modern) return null
  const major = Number(modern[1])
  return Number.isFinite(major) && major > 0 ? major : null
}

/** Read a single `key = value` property from -XshowSettings output. */
export function readJavaProperty(output: string, key: string): string | null {
  if (!output || !key) return null
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\s*${escaped}\\s*=\\s*(.+?)\\s*$`, 'mi')
  const match = output.match(re)
  const value = match?.[1]?.trim()
  return value ? value : null
}

function logScanner(_message: string): void {}

function logSelector(_message: string): void {}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function safeRealpath(targetPath: string): Promise<string> {
  try {
    return await fs.realpath(targetPath)
  } catch {
    return path.resolve(targetPath)
  }
}

function makeRuntimeId(javaPath: string, major: number): string {
  const normalized = path.resolve(javaPath).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `java-${major}-${normalized.slice(-48)}`
}

function sourcePriority(source: JavaRuntimeSource): number {
  switch (source) {
    case 'managed':
      return 0
    case 'manual':
      return 1
    case 'custom':
      return 2
    case 'java_home':
      return 3
    case 'minecraft':
      return 4
    case 'system':
      return 5
    case 'path':
      return 6
    default:
      return 9
  }
}

// ─── inspect ─────────────────────────────────────────────────────────────────

export async function inspectJavaExecutable(
  javaPath: string
): Promise<Omit<DetectedJavaRuntime, 'source' | 'id'> | null> {
  const resolvedPath = path.resolve(javaPath)
  let output = ''

  try {
    const result = await execFileAsync(
      resolvedPath,
      ['-XshowSettings:properties', '-version'],
      {
        timeout: INSPECT_TIMEOUT_MS,
        maxBuffer: INSPECT_MAX_BUFFER,
        windowsHide: true,
      }
    )
    output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  } catch (err) {
    // java often exits non-zero for -XshowSettings; still parse stdout/stderr
    const e = err as { stdout?: string; stderr?: string; message?: string }
    output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`
    if (!output.trim()) {
      logScanner(`Skipped invalid runtime: ${resolvedPath} (${e.message ?? 'no output'})`)
      return null
    }
  }

  const specVersion = readJavaProperty(output, 'java.specification.version')
  const runtimeVersion = readJavaProperty(output, 'java.runtime.version')
  const javaVersion = readJavaProperty(output, 'java.version')
  const javaHomeProp = readJavaProperty(output, 'java.home')
  const vendor = readJavaProperty(output, 'java.vendor') ?? undefined
  const architecture = readJavaProperty(output, 'os.arch') ?? undefined

  let version = specVersion || runtimeVersion || javaVersion || ''
  if (!version) {
    const quoted = output.match(/version\s+"([^"]+)"/i)
    version = quoted?.[1] ?? ''
  }

  const majorVersion = parseJavaMajor(specVersion)
    ?? parseJavaMajor(javaVersion)
    ?? parseJavaMajor(runtimeVersion)
    ?? parseJavaMajor(version)

  if (majorVersion == null) {
    logScanner(`Skipped invalid runtime: ${resolvedPath} (unparseable version)`)
    return null
  }

  const displayVersion = javaVersion || runtimeVersion || version || String(majorVersion)
  const javaHome = javaHomeProp
    ? path.resolve(javaHomeProp)
    : path.resolve(path.dirname(resolvedPath), '..')

  logScanner(
    `Detected Java ${displayVersion}, major=${majorVersion}, vendor=${vendor ?? 'unknown'}`
  )

  return {
    javaPath: resolvedPath,
    javaHome,
    version: displayVersion,
    majorVersion,
    vendor,
    architecture,
    valid: true,
    rawVersion: displayVersion,
    isValid: true,
  }
}

/**
 * Verify a custom Java path and check if it's compatible with the required version.
 */
export async function verifyJavaPath(
  javaPath: string,
  requiredMajor: number
): Promise<import('../../../shared/types').JavaPathVerification> {
  const resolved = path.resolve(javaPath)

  if (!(await pathExists(resolved))) {
    return {
      valid: false,
      majorVersion: null,
      version: null,
      compatible: false,
      requiredMajor,
      message: 'Đường dẫn không tồn tại.',
    }
  }

  const details = await inspectJavaExecutable(resolved)
  if (!details) {
    return {
      valid: false,
      majorVersion: null,
      version: null,
      compatible: false,
      requiredMajor,
      message: 'Không thể đọc thông tin Java từ đường dẫn này.',
    }
  }

  const compatible = details.majorVersion === requiredMajor
  return {
    valid: true,
    majorVersion: details.majorVersion,
    version: details.version,
    compatible,
    requiredMajor,
    message: compatible
      ? `Java ${details.version} tương thích với Minecraft (cần Java ${requiredMajor}).`
      : `Java ${details.version} (major ${details.majorVersion}) không đúng phiên bản yêu cầu (Java ${requiredMajor}).`,
  }
}

// ─── filesystem scan ─────────────────────────────────────────────────────────

/** Find bin/java(.exe) under a root, max depth 3 (supports nested jdk folders). */
export async function findJavaExecutables(
  rootDir: string,
  depth = 0
): Promise<string[]> {
  const found: string[] = []
  if (depth > SCAN_MAX_DEPTH) return found

  let dirPath: string
  try {
    dirPath = path.resolve(rootDir)
  } catch {
    return found
  }

  try {
    const direct = path.join(dirPath, 'bin', JAVA_EXE)
    if (await pathExists(direct)) {
      found.push(path.resolve(direct))
    }

    // Root is already a bin/ folder
    const asBin = path.join(dirPath, JAVA_EXE)
    if (path.basename(dirPath).toLowerCase() === 'bin' && (await pathExists(asBin))) {
      found.push(path.resolve(asBin))
      return [...new Set(found)]
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      const name = entry.name
      if (name.startsWith('.') || SKIP_DIR_NAMES.has(name.toLowerCase())) continue
      // Already captured via bin/java.exe above — avoid duplicate
      if (name.toLowerCase() === 'bin') continue
      const nested = await findJavaExecutables(path.join(dirPath, name), depth + 1)
      found.push(...nested)
    }
  } catch {
    // missing dir / permission — not fatal
  }

  return [...new Set(found)]
}

export async function scanJavaRoot(rootDir: string): Promise<string[]> {
  const resolved = path.resolve(rootDir)
  if (!(await pathExists(resolved))) return []
  logScanner(`Scan root: ${resolved}`)
  const executables = await findJavaExecutables(resolved)
  for (const exe of executables) {
    logScanner(`Found executable: ${exe}`)
  }
  return executables
}

/** Deep-scan roots only (known vendor dirs). PATH is handled separately. */
export function getKnownJavaRoots(customScanDirs: string[] = []): string[] {
  const roots = new Set<string>()
  const add = (p?: string | null) => {
    if (p && p.trim()) roots.add(path.resolve(p.trim()))
  }

  for (const dir of customScanDirs) add(dir)

  try {
    add(getDefaultJavaInstallDir())
  } catch {
    /* ignore */
  }

  // Cross-platform vendor roots
  for (const root of getPlatformJavaCandidateRoots()) {
    add(root)
  }

  return [...roots]
}

/** Direct java.exe candidates from PATH entries (no recursive walk). */
async function collectPathJavaExecutables(): Promise<string[]> {
  const found: string[] = []
  const pathEnv = process.env.PATH || process.env.Path || ''
  for (const entry of pathEnv.split(path.delimiter)) {
    if (!entry) continue
    try {
      const resolved = path.resolve(entry)
      const direct = path.join(resolved, JAVA_EXE)
      if (await pathExists(direct)) found.push(direct)
      const nested = path.join(resolved, 'bin', JAVA_EXE)
      if (await pathExists(nested)) found.push(nested)
    } catch {
      /* ignore */
    }
  }
  return found
}

async function collectWhereJava(): Promise<string[]> {
  const { command, args } = getPlatformWhereJavaCommand()
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 256 * 1024,
    })
    return stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((p) => path.resolve(p))
  } catch {
    return []
  }
}

function classifySource(
  javaPath: string,
  javaHome: string,
  customScanDirs: string[],
  managedRoot: string
): JavaRuntimeSource {
  const p = javaPath.toLowerCase()
  const home = javaHome.toLowerCase()
  const managed = managedRoot.toLowerCase()

  if (managed && (p.startsWith(managed) || home.startsWith(managed))) {
    return 'managed'
  }

  for (const dir of customScanDirs) {
    const d = path.resolve(dir).toLowerCase()
    if (p.startsWith(d) || home.startsWith(d) || d === p || d === home) {
      return 'manual'
    }
  }

  if (process.env.JAVA_HOME) {
    const jh = path.resolve(process.env.JAVA_HOME).toLowerCase()
    if (p.startsWith(jh) || home.startsWith(jh)) return 'java_home'
  }

  if (
    p.includes(`${path.sep}.minecraft${path.sep}runtime`) ||
    home.includes(`${path.sep}.minecraft${path.sep}runtime`)
  ) {
    return 'minecraft'
  }

  // bare name from PATH resolution
  if (
    path.basename(javaPath).toLowerCase() === JAVA_EXE.toLowerCase() &&
    !path.isAbsolute(javaPath)
  ) {
    return 'path'
  }

  return 'system'
}

export function deduplicateJavaRuntimes(runtimes: DetectedJavaRuntime[]): DetectedJavaRuntime[] {
  const byKey = new Map<string, DetectedJavaRuntime>()

  for (const runtime of runtimes) {
    if (!runtime.valid && !runtime.isValid) continue
    const key = (runtime.javaHome || path.dirname(path.dirname(runtime.javaPath)))
      .toLowerCase()
      .replace(/\\/g, '/')

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, runtime)
      continue
    }

    // Prefer higher-priority source, then more complete metadata
    const preferNew =
      sourcePriority(runtime.source) < sourcePriority(existing.source) ||
      ((runtime.vendor ? 1 : 0) + (runtime.architecture ? 1 : 0) >
        (existing.vendor ? 1 : 0) + (existing.architecture ? 1 : 0))

    if (preferNew) byKey.set(key, runtime)
  }

  return [...byKey.values()].sort((a, b) => {
    const src = sourcePriority(a.source) - sourcePriority(b.source)
    if (src !== 0) return src
    return a.majorVersion - b.majorVersion
  })
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0

  async function run(): Promise<void> {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = { status: 'fulfilled', value: await worker(items[i]) }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }

  const agents = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => run()
  )
  await Promise.all(agents)
  return results
}

// ─── required major ──────────────────────────────────────────────────────────

/**
 * Fallback ONLY when version metadata has no javaVersion.majorVersion.
 * Official Mojang/loader metadata always wins over this table.
 *
 *   <= 1.16.5  → 8
 *   1.17       → 16
 *   1.18–1.20.4 → 17
 *   >= 1.20.5  → 21
 */
export function fallbackRequiredJavaFromMinecraftVersion(version: string): number {
  const clean = extractMinecraftVersion(version) ?? version

  // Minecraft 26.x and snapshots 26w require Java 25
  if (/^26(?:\.|$)/.test(clean) || /^26w/i.test(clean)) {
    return 25
  }

  // Year-based snapshot-ish ids (2025 / 26.1)
  const yearMatch = clean.match(/^(20)?(\d{2,4})(?:\.(\d+))?$/)
  if (yearMatch && !clean.startsWith('1.')) {
    const year = yearMatch[1]
      ? Number(yearMatch[1] + yearMatch[2])
      : Number(yearMatch[2].length <= 2 ? `20${yearMatch[2]}` : yearMatch[2])
    if (Number.isFinite(year)) {
      if (year >= 2026 || year === 26) return 25
      if (year === 2025) return 21
      if (year <= 2024) return 8
      return 21
    }
  }

  const parts = clean.split('.').map((p) => Number(p))
  const minor = parts[1] ?? 0
  const patch = parts[2] ?? 0

  if (minor >= 26) return 25
  if (minor >= 21) return 21
  if (minor === 20 && patch >= 5) return 21
  if (minor >= 18) return 17
  if (minor === 17) return 16
  if (minor <= 16) return 8
  return 17
}

export function extractMinecraftVersion(version: string): string | null {
  const yearMatch = version.match(/\b(20\d{2}|2[5-9]\.\d+)\b/)
  if (yearMatch) return yearMatch[1]
  const legacyMatch = version.match(/1\.\d+(?:\.\d+)?/)
  return legacyMatch?.[0] ?? null
}

/** @deprecated use resolveRequiredJavaMajor — kept for call-site compat */
export function resolveRequiredJavaVersion(version: string): number {
  return fallbackRequiredJavaFromMinecraftVersion(version)
}

async function readVersionJsonMajor(
  gameDir: string,
  versionId: string,
  depth = 0
): Promise<number | null> {
  if (!gameDir || !versionId || depth > 4) return null
  const jsonPath = path.join(gameDir, 'versions', versionId, `${versionId}.json`)
  try {
    const raw = await fs.readFile(jsonPath, 'utf8')
    const json = JSON.parse(raw) as {
      javaVersion?: { majorVersion?: number }
      inheritsFrom?: string
    }
    const major = json.javaVersion?.majorVersion
    if (typeof major === 'number' && Number.isFinite(major) && major > 0) {
      return major
    }
    if (json.inheritsFrom) {
      return readVersionJsonMajor(gameDir, json.inheritsFrom, depth + 1)
    }
  } catch {
    // missing / unreadable metadata
  }
  return null
}

export async function resolveRequiredJavaMajor(
  minecraftVersion: string,
  gameDir?: string
): Promise<number> {
  if (gameDir) {
    const fromMeta = await readVersionJsonMajor(gameDir, minecraftVersion)
    if (fromMeta != null) {
      logSelector(`Required major from metadata=${fromMeta} (version=${minecraftVersion})`)
      return fromMeta
    }
  }
  const fallback = fallbackRequiredJavaFromMinecraftVersion(minecraftVersion)
  logSelector(`Required major from fallback=${fallback} (version=${minecraftVersion})`)
  return fallback
}

// ─── compatibility / selection ───────────────────────────────────────────────

export function evaluateJavaCompatibility(
  runtime: DetectedJavaRuntime,
  requiredMajor: number
): JavaCompatibility {
  const actualMajor = runtime.majorVersion
  const exactMatch = actualMajor === requiredMajor
  const compatible = exactMatch
  let reason: string | undefined
  if (!compatible) {
    if (actualMajor > requiredMajor) {
      reason = `Java ${actualMajor} mới hơn Java ${requiredMajor} khuyến nghị — không tự chọn`
    } else {
      reason = `Java ${actualMajor} cũ hơn Java ${requiredMajor} yêu cầu`
    }
  }
  return { runtime, requiredMajor, actualMajor, compatible, exactMatch, reason }
}

/**
 * Auto-select only exact major match.
 * Priority: managed → manual/custom → java_home → minecraft → system → path.
 * Never auto-picks a newer major (e.g. 25 when 21 required).
 */
export function selectCompatibleJava(
  runtimes: DetectedJavaRuntime[],
  requiredMajor: number,
  options?: { allowNewer?: boolean; preferredJavaPath?: string | null }
): DetectedJavaRuntime | null {
  const valid = runtimes.filter((r) => r.valid || r.isValid)

  if (options?.preferredJavaPath) {
    const preferred = path.resolve(options.preferredJavaPath)
    const match = valid.find(
      (r) =>
        path.resolve(r.javaPath).toLowerCase() === preferred.toLowerCase() ||
        path.resolve(r.javaHome).toLowerCase() === preferred.toLowerCase()
    )
    if (match) {
      // Manual pick: allow even if major differs
      return match
    }
  }

  const exact = valid
    .filter((r) => r.majorVersion === requiredMajor)
    .sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source))

  if (exact[0]) return exact[0]

  if (options?.allowNewer) {
    const newer = valid
      .filter((r) => r.majorVersion >= requiredMajor)
      .sort((a, b) => {
        const src = sourcePriority(a.source) - sourcePriority(b.source)
        if (src !== 0) return src
        return b.majorVersion - a.majorVersion // prefer highest (newest) instead of lowest
      })
    return newer[0] ?? null
  }

  return null
}

// ─── public scan / select API ────────────────────────────────────────────────

export async function scanJavaRuntimes(
  customScanDirs: string[] = [],
  forceRefresh = false
): Promise<JavaScanResult> {
  const cachePath = getJavaCacheFilePath()

  if (!forceRefresh) {
    try {
      if (await pathExists(cachePath)) {
        const cacheStat = await fs.stat(cachePath)
        if (Date.now() - cacheStat.mtimeMs < CACHE_TTL_MS) {
          const cacheContent = await fs.readFile(cachePath, 'utf8')
          const parsed = JSON.parse(cacheContent) as JavaScanResult
          return parsed
        }
      }
    } catch {
      // ignore bad cache
    }
  }

  const candidatePaths = new Set<string>()
  const roots = getKnownJavaRoots(customScanDirs)

  for (const root of roots) {
    // root may itself be java.exe
    if (
      path.basename(root).toLowerCase() === JAVA_EXE.toLowerCase() &&
      (await pathExists(root))
    ) {
      candidatePaths.add(path.resolve(root))
      continue
    }
    const found = await scanJavaRoot(root)
    for (const p of found) candidatePaths.add(p)
  }
  const sysPath = await collectPathJavaExecutables()
  for (const p of sysPath) candidatePaths.add(p)

  const sysWhere = await collectWhereJava()
  for (const p of sysWhere) candidatePaths.add(p)
  // Resolve realpaths early for dedupe of candidates
  const uniqueCandidates: string[] = []
  const seenReal = new Set<string>()
  for (const candidate of candidatePaths) {
    try {
      const real = (await safeRealpath(candidate)).toLowerCase()
      if (seenReal.has(real)) continue
      seenReal.add(real)
      uniqueCandidates.push(path.resolve(candidate))
    } catch {
      uniqueCandidates.push(path.resolve(candidate))
    }
  }

  let managedRoot = ''
  try {
    managedRoot = path.resolve(getDefaultJavaInstallDir())
  } catch {
    managedRoot = ''
  }

  const settled = await mapPool(uniqueCandidates, INSPECT_CONCURRENCY, async (javaPath) => {
    const details = await inspectJavaExecutable(javaPath)
    if (!details) return null
    const source = classifySource(
      details.javaPath,
      details.javaHome,
      customScanDirs,
      managedRoot
    )
    const runtime: DetectedJavaRuntime = {
      id: makeRuntimeId(details.javaPath, details.majorVersion),
      ...details,
      source,
      valid: true,
      isValid: true,
      rawVersion: details.version,
    }
    return runtime
  })

  const runtimes: DetectedJavaRuntime[] = []
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      runtimes.push(item.value)
    }
  }

  const deduped = deduplicateJavaRuntimes(runtimes)

  const result: JavaScanResult = {
    runtimes: deduped,
    message:
      deduped.length > 0
        ? `Scan thành công, tìm thấy ${deduped.length} bản cài đặt Java.`
        : 'Không tìm thấy Java nào trên máy.',
  }

  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true })
    await fs.writeFile(cachePath, JSON.stringify(result, null, 2), 'utf8')
  } catch {
    // cache write is best-effort
  }

  return result
}

export async function selectBestJavaRuntime(
  minecraftVersion: string,
  customScanDirs: string[] = [],
  options?: {
    gameDir?: string
    allowNewer?: boolean
    preferredJavaPath?: string | null
    forceRefresh?: boolean
  }
): Promise<JavaRuntimeSelectionResult> {
  const gameDir = options?.gameDir
  const requiredMajor = await resolveRequiredJavaMajor(minecraftVersion, gameDir)

  const scanDirsToUse = [...customScanDirs]
  if (options?.preferredJavaPath) {
    scanDirsToUse.push(options.preferredJavaPath)
  }

  const scanResult = await scanJavaRuntimes(scanDirsToUse, options?.forceRefresh === true)
  let candidates = scanResult.runtimes.filter((r) => r.valid || r.isValid)

  let selected = selectCompatibleJava(candidates, requiredMajor, {
    allowNewer: options?.allowNewer === true,
    preferredJavaPath: options?.preferredJavaPath,
  })

  // If missing exact match and not a manual preferred path, auto-install required Java
  if (!selected && !options?.preferredJavaPath) {
    logSelector(`Java ${requiredMajor} not found. Triggering automatic background install...`)
    try {
      const installRes = await autoInstallJava(requiredMajor, getDefaultJavaInstallDir())
      if (installRes.success) {
        logSelector(`Auto-install Java ${requiredMajor} succeeded. Rescanning...`)
        const refreshedScan = await scanJavaRuntimes(scanDirsToUse, true)
        candidates = refreshedScan.runtimes.filter((r) => r.valid || r.isValid)
        selected = selectCompatibleJava(candidates, requiredMajor, {
          allowNewer: options?.allowNewer === true,
        })
      } else {
        logSelector(`Auto-install Java ${requiredMajor} failed: ${installRes.message}`)
      }
    } catch (installErr) {
      logSelector(`Auto-install Java error: ${installErr}`)
    }
  }

  // If still not found and haven't force-refreshed yet, try once more
  if (!selected && !options?.forceRefresh) {
    return selectBestJavaRuntime(minecraftVersion, customScanDirs, {
      ...options,
      forceRefresh: true,
    })
  }

  if (!selected) {
    const available = candidates.map((c) => c.majorVersion).join(', ')
    logSelector(`Required major=${requiredMajor}, no match (available: ${available})`)
    return {
      found: false,
      requiredVersion: requiredMajor,
      requiredMajor,
      selectedRuntime: null,
      candidates,
      isExactMatch: false,
      isFallback: false,
      warning: null,
      message: `❌ Không tìm thấy hoặc không thể tự động cài Java ${requiredMajor} cho Minecraft ${minecraftVersion}. Các runtime hiện có: ${available || 'Không có'}.`,
    }
  }

  const compat = evaluateJavaCompatibility(selected, requiredMajor)
  const isManualOverride =
    Boolean(options?.preferredJavaPath) &&
    path.resolve(selected.javaPath).toLowerCase() ===
      path.resolve(options!.preferredJavaPath!).toLowerCase()

  const isExactMatch = compat.exactMatch
  const warning =
    !isExactMatch && isManualOverride
      ? `Đang dùng Java ${compat.actualMajor} (chọn thủ công). Khuyến nghị: Java ${requiredMajor}.`
      : null

  logSelector(`Required major=${requiredMajor}, selected major=${selected.majorVersion}`)

  return {
    found: true,
    requiredVersion: requiredMajor,
    requiredMajor,
    selectedRuntime: selected,
    candidates,
    isExactMatch,
    isFallback: !isExactMatch,
    warning,
    message: `Selected Java ${selected.majorVersion} (${selected.version}): ${selected.javaPath}`,
  }
}

