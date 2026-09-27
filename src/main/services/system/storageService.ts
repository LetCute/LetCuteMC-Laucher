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

export async function ensureGameDirectoryStructure(gameDir: string, mcVersion?: string): Promise<void> {
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

  // 5. Khởi tạo options.txt mặc định (tiếng Việt, tắt phụ đề, tắt narrator/người tường thuật, tắt tutorial)
  await applyDefaultGameOptions(gameDir, mcVersion)
}

/** Lấy mã ngôn ngữ Minecraft chuẩn: 1.13+ là vi_vn, < 1.13 là vi_VN */
export function getMinecraftLangCode(version?: string): string {
  if (!version) return 'vi_vn'
  const match = version.match(/(?:^|[^\d])(1\.\d+|2\d+\.\d+)/)
  if (match) {
    const parts = match[1].split('.')
    const major = parseInt(parts[0], 10)
    const minor = parseInt(parts[1], 10)
    if (major === 1 && minor < 13) {
      return 'vi_VN'
    }
  }
  return 'vi_vn'
}

/** Tự động thiết lập options.txt tối ưu mặc định (tiếng Việt, tắt phụ đề, tắt narrator) khi tạo profile hoặc khởi tạo thư mục */
export async function applyDefaultGameOptions(gameDir: string, mcVersion?: string): Promise<void> {
  try {
    const langCode = getMinecraftLangCode(mcVersion)

    const defaultOverrides: Record<string, string> = {
      lang: langCode,
      forceUnicodeFont: 'true',
      narrator: '0', // 0: OFF (Tắt người tường thuật)
      showSubtitles: 'false', // Tắt phụ đề âm thanh
      tutorialStep: 'none', // Bỏ qua hướng dẫn Mojang (Movement, Looking around, etc.)
      skipRealms32BitWarning: 'true',
      onboardingAccessibilityFinished: 'true', // Bỏ qua màn hình trợ năng/tường thuật lần đầu mở game
      telemetryOptIn: 'false',
    }

    const patchOptionsFile = async (filePath: string) => {
      try {
        const exists = await pathExists(filePath)
        if (!exists) {
          await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {})
          const lines = Object.entries(defaultOverrides).map(([k, v]) => `${k}:${v}`)
          await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf8')
          return
        }

        const content = await fs.readFile(filePath, 'utf8')
        const lines = content.split(/\r?\n/)
        const map = new Map<string, string>()
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.includes(':')) continue
          const idx = trimmed.indexOf(':')
          map.set(trimmed.substring(0, idx).trim(), trimmed.substring(idx + 1).trim())
        }

        let modified = false
        const currentLang = map.get('lang')?.replace(/['"]/g, '').trim()
        if (currentLang !== langCode) {
          map.set('lang', langCode)
          modified = true
        }

        for (const [key, val] of Object.entries(defaultOverrides)) {
          if (!map.has(key)) {
            map.set(key, val)
            modified = true
          }
        }

        if (modified) {
          const out = Array.from(map.entries()).map(([k, v]) => `${k}:${v}`).join('\n') + '\n'
          await fs.writeFile(filePath, out, 'utf8')
        }
      } catch (err) {
        console.warn(`[StorageService] Failed to patch options file "${filePath}":`, err)
      }
    }

    // 1. Root options.txt
    const optionsPath = path.join(gameDir, 'options.txt')
    await patchOptionsFile(optionsPath)

    // 2. Đồng bộ với options.txt.bak để tránh bị khôi phục ngược lại tiếng Anh
    const optionsBak = path.join(gameDir, 'options.txt.bak')
    await fs.copyFile(optionsPath, optionsBak).catch(() => {})

    // 3. Patch modpack overrides: config/yosbr/options.txt (Your Options Shall Be Respected mod)
    const yosbrOptionsPath = path.join(gameDir, 'config', 'yosbr', 'options.txt')
    if (await pathExists(path.dirname(yosbrOptionsPath))) {
      await patchOptionsFile(yosbrOptionsPath)
    }

    // 4. Patch modpack overrides: config/defaultoptions/options.txt (Default Options mod)
    const defaultOptionsPath = path.join(gameDir, 'config', 'defaultoptions', 'options.txt')
    if (await pathExists(path.dirname(defaultOptionsPath))) {
      await patchOptionsFile(defaultOptionsPath)
    }
  } catch (err) {
    console.error('[StorageService] applyDefaultGameOptions error:', err)
  }
}
