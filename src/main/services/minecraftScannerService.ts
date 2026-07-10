import fs from 'node:fs/promises'

import path from 'node:path'
import type {
  MinecraftScanResult,
  LocalMinecraftVersion,
  LocalMinecraftFileItem,
  LocalMinecraftSave
} from '../../shared/types'

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function safeReaddir(dirPath: string): Promise<string[]> {
  try {
    if (!(await pathExists(dirPath))) return []
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory()) return []
    return await fs.readdir(dirPath)
  } catch {
    return []
  }
}

async function getFileItem(filePath: string): Promise<LocalMinecraftFileItem | null> {
  try {
    const stat = await fs.stat(filePath)
    return {
      name: path.basename(filePath),
      path: filePath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString()
    }
  } catch {
    return null
  }
}

export async function scanMinecraftDirectory(
  gameDir: string
): Promise<MinecraftScanResult> {
  const exists = await pathExists(gameDir)
  if (!exists) {
    return {
      gameDir,
      exists: false,
      versions: [],
      mods: [],
      resourcePacks: [],
      shaderPacks: [],
      saves: [],
      latestLogPath: null,
      optionsPath: null,
      launcherProfilesPath: null
    }
  }

  // Scan versions
  const versionsDir = path.join(gameDir, 'versions')
  const versionDirs = await safeReaddir(versionsDir)
  const versions: LocalMinecraftVersion[] = []

  for (const vName of versionDirs) {
    const vPath = path.join(versionsDir, vName)
    try {
      const stat = await fs.stat(vPath)
      if (!stat.isDirectory()) continue

      const jsonPath = path.join(vPath, `${vName}.json`)
      const jarPath = path.join(vPath, `${vName}.jar`)

      const hasJson = await pathExists(jsonPath)
      const hasJar = await pathExists(jarPath)

      if (!hasJson && !hasJar) continue

      const lowerName = vName.toLowerCase()
      let type: LocalMinecraftVersion['type'] = 'release'
      if (/\b\d{2}w\d+[a-z]\b/.test(lowerName) || lowerName.includes('pre-release') || lowerName.includes('pre') || lowerName.includes('rc')) {
        type = 'snapshot'
      }

      versions.push({
        id: vName,
        name: vName,
        path: vPath,
        hasJar,
        hasJson,
        type,
        loader: 'vanilla',
      })
    } catch {
      // ignore
    }
  }

  // Scan mods (.jar files)
  const modsDir = path.join(gameDir, 'mods')
  const modFiles = await safeReaddir(modsDir)
  const mods: LocalMinecraftFileItem[] = []
  for (const file of modFiles) {
    if (file.toLowerCase().endsWith('.jar')) {
      const item = await getFileItem(path.join(modsDir, file))
      if (item) mods.push(item)
    }
  }

  // Scan resource packs (zip files or directories)
  const rpDir = path.join(gameDir, 'resourcepacks')
  const rpFiles = await safeReaddir(rpDir)
  const resourcePacks: LocalMinecraftFileItem[] = []
  for (const file of rpFiles) {
    const rpPath = path.join(rpDir, file)
    try {
      const stat = await fs.stat(rpPath)
      resourcePacks.push({
        name: file,
        path: rpPath,
        sizeBytes: stat.isDirectory() ? 0 : stat.size,
        updatedAt: stat.mtime.toISOString()
      })
    } catch {
      // ignore
    }
  }

  // Scan shader packs (zip files or directories)
  const spDir = path.join(gameDir, 'shaderpacks')
  const spFiles = await safeReaddir(spDir)
  const shaderPacks: LocalMinecraftFileItem[] = []
  for (const file of spFiles) {
    const spPath = path.join(spDir, file)
    try {
      const stat = await fs.stat(spPath)
      shaderPacks.push({
        name: file,
        path: spPath,
        sizeBytes: stat.isDirectory() ? 0 : stat.size,
        updatedAt: stat.mtime.toISOString()
      })
    } catch {
      // ignore
    }
  }

  // Scan saves (world directories)
  const savesDir = path.join(gameDir, 'saves')
  const saveDirs = await safeReaddir(savesDir)
  const saves: LocalMinecraftSave[] = []
  for (const folder of saveDirs) {
    const savePath = path.join(savesDir, folder)
    try {
      const stat = await fs.stat(savePath)
      if (stat.isDirectory()) {
        saves.push({
          name: folder,
          path: savePath,
          updatedAt: stat.mtime.toISOString()
        })
      }
    } catch {
      // ignore
    }
  }

  // Special files
  const latestLogPath = path.join(gameDir, 'logs', 'latest.log')
  const optionsPath = path.join(gameDir, 'options.txt')
  const launcherProfilesPath = path.join(gameDir, 'launcher_profiles.json')

  return {
    gameDir,
    exists: true,
    versions,
    mods,
    resourcePacks,
    shaderPacks,
    saves,
    latestLogPath: (await pathExists(latestLogPath)) ? latestLogPath : null,
    optionsPath: (await pathExists(optionsPath)) ? optionsPath : null,
    launcherProfilesPath: (await pathExists(launcherProfilesPath)) ? launcherProfilesPath : null
  }
}
