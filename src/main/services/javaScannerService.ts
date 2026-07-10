import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  JavaScanResult,
  DetectedJavaRuntime,
  JavaRuntimeSelectionResult,
  RequiredJavaVersion
} from '../../shared/types'

const execFileAsync = promisify(execFile)

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function getJavaExecutableName(): string {
  return process.platform === 'win32' ? 'java.exe' : 'java'
}

function parseJavaMajorVersion(rawOutput: string): number | null {
  const match = rawOutput.match(/version "([^"]+)"/i)
  if (!match) {
    return null
  }

  const rawVersion = match[1]
  if (rawVersion.startsWith('1.8')) {
    return 8
  }

  const major = Number(rawVersion.split('.')[0])
  return Number.isFinite(major) ? major : null
}

async function getJavaDetails(javaPath: string): Promise<{ majorVersion: number; rawVersion: string } | null> {
  try {
    const { stdout, stderr } = await execFileAsync(javaPath, ['-version'], {
      timeout: 5000
    })
    const rawOutput = `${stdout}\n${stderr}`.trim()
    const majorVersion = parseJavaMajorVersion(rawOutput)
    const rawVersion = rawOutput.match(/version "([^"]+)"/i)?.[1] ?? 'unknown'

    if (majorVersion) {
      return { majorVersion, rawVersion }
    }
    return null
  } catch {
    return null
  }
}

// Find java files under a directory (recursive up to depth 3)
async function findJavaExecutablesInDir(dirPath: string, depth = 0): Promise<string[]> {
  const executables: string[] = []
  if (depth > 3) return executables

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const exeName = getJavaExecutableName()

    // Check if bin/java exists directly in this directory
    const directJavaPath = path.join(dirPath, 'bin', exeName)
    if (await pathExists(directJavaPath)) {
      executables.push(directJavaPath)
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDirPath = path.join(dirPath, entry.name)
        // Skip common non-Java folders to save scan time
        if (entry.name.startsWith('.') || ['node_modules', 'Library', 'AppData', 'System32', 'Windows'].includes(entry.name)) {
          continue
        }
        const nested = await findJavaExecutablesInDir(subDirPath, depth + 1)
        executables.push(...nested)
      } else if (entry.name === exeName) {
        executables.push(path.join(dirPath, entry.name))
      }
    }
  } catch {
    // ignore directory read errors
  }

  return executables
}

export function extractMinecraftVersion(version: string): string | null {
  // New format: 2025, 2026, 26.1, etc.
  const yearMatch = version.match(/\b(20\d{2}|2[5-9]\.\d+)\b/)
  if (yearMatch) {
    return yearMatch[1]
  }
  
  // Legacy format: 1.x.x
  const legacyMatch = version.match(/1\.\d+(?:\.\d+)?/)
  return legacyMatch?.[0] ?? null
}

export function resolveRequiredJavaVersion(version: string): RequiredJavaVersion {
  const cleanVersion = extractMinecraftVersion(version) ?? version

  // New year-based versions (2025, 2026, etc. or 25.1, 26.1, etc.)
  const yearMatch = cleanVersion.match(/^(20)?(\d{2,4})(?:\.(\d+))?$/)
  if (yearMatch) {
    const year = yearMatch[1] ? Number(yearMatch[1] + yearMatch[2]) : Number('20' + yearMatch[2])
    // 2024 and earlier → Java 8, 2025 → Java 17, 2026+ → Java 21
    if (year <= 2024) return 8
    if (year === 2025) return 17
    if (year >= 2026) return 21
  }

  // Legacy 1.x.x format
  const [, minor = 0, patch = 0] = cleanVersion
    .split('.')
    .map((part) => Number(part))

  // Minecraft 1.20.5+ requires Java 21
  if (minor >= 21) return 21
  if (minor === 20 && patch >= 5) return 21
  
  // Minecraft 1.17-1.20.4 requires Java 17
  if (minor >= 17) return 17
  
  // Minecraft <= 1.16.5 requires Java 8
  if (minor <= 16) return 8

  // Default fallback
  return 17
}

export async function scanJavaRuntimes(
  customScanDirs: string[] = []
): Promise<JavaScanResult> {
  // Try caching
  const { getJavaCacheFilePath } = await import('./storageService.js')
  const cachePath = getJavaCacheFilePath()

  try {
    if (await pathExists(cachePath)) {
      const cacheStat = await fs.stat(cachePath)
      const age = Date.now() - cacheStat.mtimeMs
      if (age < 600000) { // 10 minutes cache TTL
        const cacheContent = await fs.readFile(cachePath, 'utf8')
        return JSON.parse(cacheContent) as JavaScanResult
      }
    }
  } catch (e) {
    console.warn('[Java Cache] Failed to read cache:', e)
  }

  const candidatePaths = new Set<string>()

  // 1. Check custom scanner directories
  for (const dir of customScanDirs) {
    if (!dir) continue
    if (await pathExists(dir)) {
      const stats = await fs.stat(dir)
      if (stats.isDirectory()) {
        const found = await findJavaExecutablesInDir(dir)
        found.forEach(p => candidatePaths.add(p))
      } else if (path.basename(dir) === getJavaExecutableName()) {
        candidatePaths.add(dir)
      }
    }
  }

  // 2. Check JAVA_HOME
  const javaHome = process.env.JAVA_HOME
  if (javaHome) {
    const javaHomePath = path.join(javaHome, 'bin', getJavaExecutableName())
    if (await pathExists(javaHomePath)) {
      candidatePaths.add(javaHomePath)
    }
  }

  // 3. Check PATH java
  candidatePaths.add(getJavaExecutableName())

  // 4. Common system installation folders
  const commonDirs: string[] = []
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    
    commonDirs.push(path.join(programFiles, 'Java'))
    commonDirs.push(path.join(programFiles, 'Eclipse Adoptium'))
    commonDirs.push(path.join(programFiles, 'BellSoft'))
    commonDirs.push(path.join(programFiles, 'Semeru'))
    commonDirs.push(path.join(programFilesX86, 'Java'))
  } else if (process.platform === 'darwin') {
    commonDirs.push('/Library/Java/JavaVirtualMachines')
  } else {
    commonDirs.push('/usr/lib/jvm')
  }

  for (const dir of commonDirs) {
    if (await pathExists(dir)) {
      const found = await findJavaExecutablesInDir(dir)
      found.forEach(p => candidatePaths.add(p))
    }
  }

  // Build result list
  const runtimes: DetectedJavaRuntime[] = []
  for (const javaPath of candidatePaths) {
    const details = await getJavaDetails(javaPath)
    if (details) {
      // Determine source
      let source: DetectedJavaRuntime['source'] = 'path'
      if (javaPath === getJavaExecutableName()) {
        source = 'path'
      } else if (javaHome && javaPath.startsWith(javaHome)) {
        source = 'java_home'
      } else if (customScanDirs.some(dir => javaPath.startsWith(dir))) {
        source = 'custom'
      }

      runtimes.push({
        javaPath,
        majorVersion: details.majorVersion,
        rawVersion: details.rawVersion,
        source,
        isValid: true
      })
    }
  }

  const result: JavaScanResult = {
    runtimes,
    message: runtimes.length > 0
      ? `Scan thành công, tìm thấy ${runtimes.length} bản cài đặt Java.`
      : 'Không tìm thấy Java nào trên máy.'
  }

  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true })
    await fs.writeFile(cachePath, JSON.stringify(result, null, 2), 'utf8')
  } catch (e) {
    console.warn('[Java Cache] Failed to write cache:', e)
  }

  return result
}

export async function selectBestJavaRuntime(
  minecraftVersion: string,
  customScanDirs: string[] = []
): Promise<JavaRuntimeSelectionResult> {
  const requiredVersion = resolveRequiredJavaVersion(minecraftVersion)
  const scanResult = await scanJavaRuntimes(customScanDirs)
  const runtimes = scanResult.runtimes
    .filter((runtime) => runtime.isValid)
    .sort((a, b) => a.majorVersion - b.majorVersion)

  if (runtimes.length === 0) {
    return {
      found: false,
      requiredVersion,
      selectedRuntime: null,
      candidates: [],
      isExactMatch: false,
      isFallback: false,
      warning: null,
      message: `❌ Không tìm thấy Java Runtime. Minecraft ${minecraftVersion} cần Java ${requiredVersion}+. Vui lòng cài đặt Java từ java.com hoặc adoptium.net`
    }
  }

  const exactRuntime = runtimes.find(
    (runtime) => runtime.majorVersion === requiredVersion
  )

  if (exactRuntime) {
    return {
      found: true,
      requiredVersion,
      selectedRuntime: exactRuntime,
      candidates: runtimes,
      isExactMatch: true,
      isFallback: false,
      warning: null,
      message: `Selected Java ${exactRuntime.majorVersion}: ${exactRuntime.javaPath}`
    }
  }

  const latestRuntime = runtimes[runtimes.length - 1]

  if (!latestRuntime) {
    return {
      found: false,
      requiredVersion,
      selectedRuntime: null,
      candidates: runtimes,
      isExactMatch: false,
      isFallback: false,
      warning: null,
      message: 'Không tìm thấy Java runtime hợp lệ.'
    }
  }

  if (latestRuntime.majorVersion < requiredVersion) {
    return {
      found: false,
      requiredVersion,
      selectedRuntime: null,
      candidates: runtimes,
      isExactMatch: false,
      isFallback: false,
      warning: null,
      message: `❌ Java version quá cũ. Minecraft ${minecraftVersion} cần Java ${requiredVersion}+, máy bạn chỉ có Java ${latestRuntime.majorVersion}. Vui lòng nâng cấp Java.`
    }
  }

  const isLegacyVersion = requiredVersion === 8
  const warning = isLegacyVersion
    ? `⚠️ Java 8 không tìm thấy. Đang dùng Java ${latestRuntime.majorVersion}. Một số bản Minecraft cũ có thể không chạy được.`
    : `⚠️ Java ${requiredVersion} không tìm thấy. Đang dùng Java ${latestRuntime.majorVersion}. Kiểm tra tương thích với phiên bản này.`

  return {
    found: true,
    requiredVersion,
    selectedRuntime: latestRuntime,
    candidates: runtimes,
    isExactMatch: false,
    isFallback: true,
    warning,
    message: `Selected latest Java ${latestRuntime.majorVersion}: ${latestRuntime.javaPath}`
  }
}
