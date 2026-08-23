import fs from 'node:fs/promises'
import path from 'node:path'
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

