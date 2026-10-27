import fs from 'node:fs/promises'
import type { MinecraftDirectoryResult } from '../../../shared/types'
import { getDefaultMinecraftDirectory, getLauncherDataDirectory } from '../system/storageService.js'

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

/** Always resolve default .minecraft. Create if missing. No custom path. */
export async function detectMinecraftDirectory(): Promise<MinecraftDirectoryResult> {
  const dir = getDefaultMinecraftDirectory()
  try {
    const { ensureGameDirectoryStructure } = await import('../system/storageService.js')
    await ensureGameDirectoryStructure(dir)
    await fs.mkdir(getLauncherDataDirectory(), { recursive: true })
    return { path: dir, found: true }
  } catch (err) {
    console.error('Failed to ensure game directory structure:', err)
    return { path: dir, found: false }
  }
}

/**
 * Trả về thư mục game hợp lệ: nếu gameDir hợp lệ và tồn tại thì trả về gameDir,
 * ngược lại tự động phát hiện thư mục .minecraft mặc định.
 */
export async function resolveGameDir(gameDir?: string): Promise<string> {
  if (gameDir && (await pathExists(gameDir))) {
    return gameDir
  }
  const detected = await detectMinecraftDirectory()
  return detected.path || ''
}

