import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export function getDefaultMinecraftDirectory(): string {
  if (process.platform === 'win32') {
    try {
      const { app } = require('electron')
      return path.join(app.getPath('appData'), '.minecraft')
    } catch {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft')
    }
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft')
  }
  return path.join(os.homedir(), '.minecraft')
}

/** Launcher data dir: ~/.letcutemc (TLauncher-style, sibling to .minecraft) */
export function getLauncherDataDirectory(): string {
  const base = process.platform === 'win32'
    ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : os.homedir()
  return path.join(base, '.letcutemc')
}

export async function ensureLauncherDataDirectory(): Promise<void> {
  await fs.mkdir(getLauncherDataDirectory(), { recursive: true })
}

export function getProfilesFilePath(): string {
  return path.join(getLauncherDataDirectory(), 'profiles.json')
}

export function getSettingsFilePath(): string {
  return path.join(getLauncherDataDirectory(), 'settings.json')
}

export function getJavaCacheFilePath(): string {
  return path.join(getLauncherDataDirectory(), 'java-cache.json')
}

export function getLauncherStateFilePath(): string {
  return path.join(getLauncherDataDirectory(), 'launcher-state.json')
}

export function getAccountConfigPath(): string {
  return path.join(getLauncherDataDirectory(), 'account.json')
}

export function getPreparedProfilesCachePath(): string {
  return path.join(getLauncherDataDirectory(), 'cache', 'prepared-profiles.json')
}

export function getVersionManifestCacheDir(): string {
  return path.join(getLauncherDataDirectory(), 'cache')
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      return fallback
    }
    console.warn(`[storageService] Corrupted JSON in ${filePath}, backing up and using fallback. Error:`, err)
    const timestamp = Date.now()
    const corruptPath = `${filePath}.corrupt-${timestamp}`
    try {
      await fs.rename(filePath, corruptPath)
    } catch (_) {
      // ignore
    }
    return fallback
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const raw = JSON.stringify(data, null, 2)
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  await fs.writeFile(tempPath, raw, 'utf-8')
  try {
    await fs.rename(tempPath, filePath)
  } catch {
    await fs.copyFile(tempPath, filePath)
    await fs.unlink(tempPath).catch(() => {})
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function ensureGameDirectoryStructure(gameDir: string): Promise<void> {
  if (!gameDir) return

  // 1. Create main directory
  try {
    await fs.mkdir(gameDir, { recursive: true })
  } catch (err) {
    throw new Error(`Lỗi quyền ghi: Không thể tạo thư mục game tại "${gameDir}". Chi tiết: ${(err as Error).message}`)
  }

  // 2. Create subdirectories concurrently
  const subdirs = [
    'assets',
    'assets/indexes',
    'assets/objects',
    'libraries',
    'versions',
    'natives',
    'mods',
    'resourcepacks',
    'shaderpacks',
    'saves',
    'logs'
  ]

  try {
    await Promise.all(
      subdirs.map(subdir => fs.mkdir(path.join(gameDir, subdir), { recursive: true }))
    )
  } catch (err) {
    throw new Error(`Lỗi quyền ghi: Không thể tạo thư mục con tại "${gameDir}". Chi tiết: ${(err as Error).message}`)
  }

  // 3. Handle launcher_profiles.json
  const profilesPath = path.join(gameDir, 'launcher_profiles.json')
  const defaultContent = {
    profiles: {},
    settings: {},
    version: 3
  }

  let shouldWrite = false
  try {
    const exists = await pathExists(profilesPath)
    if (!exists) {
      shouldWrite = true
    } else {
      const content = await fs.readFile(profilesPath, 'utf8')
      try {
        JSON.parse(content)
      } catch {
        // Corrupted JSON - backup and recreate
        const backupPath = `${profilesPath}.bak`
        try {
          await fs.writeFile(backupPath, content, 'utf8')
        } catch (_) {
          // ignore
        }
        shouldWrite = true
      }
    }
  } catch (err) {
    throw new Error(`Lỗi kiểm tra/đọc tệp cấu hình launcher_profiles.json: ${(err as Error).message}`)
  }

  if (shouldWrite) {
    try {
      await fs.writeFile(profilesPath, JSON.stringify(defaultContent, null, 2), 'utf8')
    } catch (err) {
      throw new Error(`Lỗi quyền ghi: Không thể ghi tệp tin launcher_profiles.json tại "${gameDir}". Chi tiết: ${(err as Error).message}`)
    }
  }

  // 4. Handle letcutemc_profiles.json
  const letcuteProfilesPath = path.join(gameDir, 'letcutemc_profiles.json')
  try {
    const exists = await pathExists(letcuteProfilesPath)
    if (!exists) {
      await fs.writeFile(letcuteProfilesPath, JSON.stringify(defaultContent, null, 2), 'utf8')
    }
  } catch {
    // Non-blocking
  }
}
