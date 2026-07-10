import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
  GameContentItem,
  GameContentType,
  GameContentStatus,
  GameContentScanResult,
  GameContentMetadata,
  ImportGameContentInput,
} from '../../shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function assertPathInsideGameDir(gameDir: string, targetPath: string): void {
  const normalizedGameDir = path.normalize(gameDir).toLowerCase()
  const normalizedTargetPath = path.normalize(targetPath).toLowerCase()

  if (!normalizedTargetPath.startsWith(normalizedGameDir)) {
    throw new Error(`Security error: path ${targetPath} is outside gameDir ${gameDir}`)
  }
}

function getExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase()
}

function generateId(): string {
  return crypto.randomUUID()
}

// ─── Lazy Mod Metadata (stream-parse 1 jar, no full extract) ──────────────────

async function readJarModMetadata(jarPath: string): Promise<GameContentMetadata> {
  try {
    const unzipper = await import('unzipper')
    const { createReadStream } = await import('node:fs')

    return await new Promise((resolve) => {
      let settled = false
      const done = (meta: GameContentMetadata) => {
        if (!settled) {
          settled = true
          resolve(meta)
        }
      }

      createReadStream(jarPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: { path: string; autodrain: () => void; on: (e: string, cb: (c?: Buffer) => void) => void }) => {
          const p = entry.path.replace(/\\/g, '/')
          const isFabric = p === 'fabric.mod.json'
          const isQuilt = p === 'quilt.mod.json'
          const isModsToml = p === 'META-INF/mods.toml' || p.endsWith('/mods.toml')
          if (!isFabric && !isQuilt && !isModsToml) {
            entry.autodrain()
            return
          }
          let data = ''
          entry.on('data', (chunk?: Buffer) => {
            if (chunk) data += chunk.toString()
          })
          entry.on('end', () => {
            try {
              if (isFabric || isQuilt) {
                const json = JSON.parse(data)
                const quiltId = json.quilt_loader?.id ?? json.id
                const quiltVer = json.quilt_loader?.version ?? json.version
                done({
                  loader: isQuilt ? 'quilt' : 'fabric',
                  modId: quiltId,
                  version: quiltVer,
                  description: typeof json.description === 'string' ? json.description : undefined,
                })
                return
              }
              const idMatch = data.match(/modId\s*=\s*"([^"]+)"/i) ?? data.match(/modId\s*=\s*'([^']+)'/i)
              const nameMatch = data.match(/displayName\s*=\s*"([^"]+)"/i) ?? data.match(/name\s*=\s*"([^"]+)"/i)
              const versionMatch = data.match(/version\s*=\s*"([^"]+)"/i)
              const isNeo = /loaderVersion\s*=\s*"[^"]*neoforge/i.test(data) || /modLoader\s*=\s*"javafml"/i.test(data) && /neoforge/i.test(data)
              done({
                loader: isNeo ? 'neoforge' : 'forge',
                modId: idMatch?.[1] ?? nameMatch?.[1],
                version: versionMatch?.[1],
              })
            } catch {
              done({ loader: 'unknown' })
            }
          })
        })
        .on('error', () => done({ loader: 'unknown' }))
        .on('close', () => done({ loader: 'unknown' }))
    })
  } catch {
    return { loader: 'unknown' }
  }
}

export async function getModMetadata(jarPath: string): Promise<GameContentMetadata> {
  // disabled jars still readable
  return readJarModMetadata(jarPath)
}

// ─── Mod Scanner ──────────────────────────────────────────────────────────────

export async function scanMods(gameDir: string): Promise<GameContentItem[]> {
  const modsDir = path.join(gameDir, 'mods')

  if (!(await pathExists(modsDir))) {
    try {
      await fs.mkdir(modsDir, { recursive: true })
    } catch {
      // ignore
    }
    return []
  }

  const mods: GameContentItem[] = []

  try {
    const entries = await fs.readdir(modsDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(modsDir, entry.name)

      if (!entry.isDirectory()) {
        const ext = getExtension(entry.name)
        const isJar = ext === '.jar'
        const isDisabled = entry.name.endsWith('.jar.disabled')

        if (!isJar && !isDisabled) continue

        const stat = await fs.stat(fullPath)
        let status: GameContentStatus = 'enabled'
        let displayName = entry.name

        if (isDisabled) {
          status = 'disabled'
          displayName = entry.name.replace('.jar.disabled', '.jar')
        }

        const mod: GameContentItem = {
          id: generateId(),
          type: 'mod',
          name: displayName,
          fileName: entry.name,
          path: fullPath,
          sizeBytes: stat.size,
          updatedAt: stat.mtime.toISOString(),
          status,
          extension: '.jar',
          isDirectory: false,
          metadata: { loader: 'unknown' },
        }

        mods.push(mod)
      }
    }
  } catch (error) {
    console.error(`Error scanning mods: ${error}`)
  }

  return mods
}

// ─── Resource Pack Scanner ────────────────────────────────────────────────────

export async function scanResourcePacks(gameDir: string): Promise<GameContentItem[]> {
  const rpDir = path.join(gameDir, 'resourcepacks')

  if (!(await pathExists(rpDir))) {
    try {
      await fs.mkdir(rpDir, { recursive: true })
    } catch {
      // ignore
    }
    return []
  }

  const packs: GameContentItem[] = []

  try {
    const entries = await fs.readdir(rpDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(rpDir, entry.name)

      let isValid = false
      let metadata: GameContentMetadata = {}

      if (entry.isDirectory()) {
        const metaPath = path.join(fullPath, 'pack.mcmeta')
        if (await pathExists(metaPath)) {
          isValid = true
          try {
            const metaContent = await fs.readFile(metaPath, 'utf-8')
            const metaJson = JSON.parse(metaContent)
            metadata = {
              description: metaJson.pack?.description,
              packFormat: metaJson.pack?.pack_format,
            }
          } catch {
            // ignore metadata parse errors
          }
        }
      } else if (getExtension(entry.name) === '.zip') {
        isValid = true
      }

      if (!isValid) continue

      const stat = await fs.stat(fullPath)

      const pack: GameContentItem = {
        id: generateId(),
        type: 'resource_pack',
        name: entry.name,
        fileName: entry.name,
        path: fullPath,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        status: 'enabled',
        extension: entry.isDirectory() ? '' : getExtension(entry.name),
        isDirectory: entry.isDirectory(),
        metadata,
      }

      packs.push(pack)
    }
  } catch (error) {
    console.error(`Error scanning resource packs: ${error}`)
  }

  return packs
}

// ─── Shader Pack Scanner ──────────────────────────────────────────────────────

export async function scanShaderPacks(gameDir: string): Promise<GameContentItem[]> {
  const spDir = path.join(gameDir, 'shaderpacks')

  if (!(await pathExists(spDir))) {
    try {
      await fs.mkdir(spDir, { recursive: true })
    } catch {
      // ignore
    }
    return []
  }

  const packs: GameContentItem[] = []

  try {
    const entries = await fs.readdir(spDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(spDir, entry.name)
      const stat = await fs.stat(fullPath)

      const pack: GameContentItem = {
        id: generateId(),
        type: 'shader_pack',
        name: entry.name,
        fileName: entry.name,
        path: fullPath,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        status: 'enabled',
        extension: entry.isDirectory() ? '' : getExtension(entry.name),
        isDirectory: entry.isDirectory(),
        metadata: {},
      }

      packs.push(pack)
    }
  } catch (error) {
    console.error(`Error scanning shader packs: ${error}`)
  }

  return packs
}

// ─── Scan All Game Content ────────────────────────────────────────────────────

export async function scanGameContent(gameDir: string): Promise<GameContentScanResult> {
  const [mods, resourcePacks, shaderPacks] = await Promise.all([
    scanMods(gameDir),
    scanResourcePacks(gameDir),
    scanShaderPacks(gameDir),
  ])

  const enabledMods = mods.filter(m => m.status === 'enabled').length
  const disabledMods = mods.filter(m => m.status === 'disabled').length

  return {
    gameDir,
    mods,
    resourcePacks,
    shaderPacks,
    counts: {
      enabledMods,
      disabledMods,
      resourcePacks: resourcePacks.length,
      shaderPacks: shaderPacks.length,
    },
  }
}

// ─── Enable Mod ───────────────────────────────────────────────────────────────

export async function enableGameContent(itemPath: string): Promise<GameContentItem> {
  assertPathInsideGameDir(path.dirname(itemPath), itemPath)

  if (!itemPath.endsWith('.jar.disabled')) {
    throw new Error('Only .jar.disabled files can be enabled')
  }

  const newPath = itemPath.replace('.jar.disabled', '.jar')

  if (await pathExists(newPath)) {
    throw new Error(`File already exists: ${newPath}`)
  }

  await fs.rename(itemPath, newPath)

  const stat = await fs.stat(newPath)
  const fileName = path.basename(newPath)

  return {
    id: generateId(),
    type: 'mod',
    name: fileName.replace('.jar', ''),
    fileName,
    path: newPath,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    status: 'enabled',
    extension: '.jar',
    isDirectory: false,
    metadata: {},
  }
}

// ─── Disable Mod ──────────────────────────────────────────────────────────────

export async function disableGameContent(itemPath: string): Promise<GameContentItem> {
  assertPathInsideGameDir(path.dirname(itemPath), itemPath)

  if (!itemPath.endsWith('.jar')) {
    throw new Error('Only .jar files can be disabled')
  }

  const newPath = itemPath + '.disabled'

  if (await pathExists(newPath)) {
    throw new Error(`File already exists: ${newPath}`)
  }

  await fs.rename(itemPath, newPath)

  const stat = await fs.stat(newPath)
  const fileName = path.basename(newPath)

  return {
    id: generateId(),
    type: 'mod',
    name: fileName.replace('.jar.disabled', ''),
    fileName,
    path: newPath,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    status: 'disabled',
    extension: '.jar',
    isDirectory: false,
    metadata: {},
  }
}

// ─── Delete Game Content ──────────────────────────────────────────────────────

export async function deleteGameContent(gameDir: string, itemPath: string): Promise<boolean> {
  assertPathInsideGameDir(gameDir, itemPath)

  if (!(await pathExists(itemPath))) {
    throw new Error(`File not found: ${itemPath}`)
  }

  const stat = await fs.stat(itemPath)

  if (stat.isDirectory()) {
    await fs.rm(itemPath, { recursive: true, force: true })
  } else {
    await fs.unlink(itemPath)
  }

  return true
}

// ─── Import Game Content ──────────────────────────────────────────────────────

async function getUniquePath(targetPath: string): Promise<string> {
  if (!(await pathExists(targetPath))) {
    return targetPath
  }

  const dir = path.dirname(targetPath)
  const ext = getExtension(targetPath)
  const nameWithoutExt = path.basename(targetPath, ext)

  let counter = 1
  while (true) {
    const newName = `${nameWithoutExt} (${counter})${ext}`
    const newPath = path.join(dir, newName)
    if (!(await pathExists(newPath))) {
      return newPath
    }
    counter++
  }
}

async function copyFileOrFolder(source: string, dest: string): Promise<void> {
  const stat = await fs.stat(source)

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(source, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name)
      const destPath = path.join(dest, entry.name)
      await copyFileOrFolder(srcPath, destPath)
    }
  } else {
    await fs.copyFile(source, dest)
  }
}

export async function importGameContent(input: ImportGameContentInput): Promise<GameContentItem> {
  const { gameDir, sourcePath, type } = input

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Source path not found: ${sourcePath}`)
  }

  let targetDir: string
  if (type === 'mod') {
    targetDir = path.join(gameDir, 'mods')
  } else if (type === 'resource_pack') {
    targetDir = path.join(gameDir, 'resourcepacks')
  } else if (type === 'shader_pack') {
    targetDir = path.join(gameDir, 'shaderpacks')
  } else {
    throw new Error(`Unknown content type: ${type}`)
  }

  await fs.mkdir(targetDir, { recursive: true })

  const fileName = path.basename(sourcePath)
  let targetPath = path.join(targetDir, fileName)

  targetPath = await getUniquePath(targetPath)

  await copyFileOrFolder(sourcePath, targetPath)

  const stat = await fs.stat(targetPath)
  const displayName = path.basename(targetPath)

  return {
    id: generateId(),
    type,
    name: displayName,
    fileName: displayName,
    path: targetPath,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    status: 'enabled',
    extension: getExtension(displayName),
    isDirectory: stat.isDirectory(),
    metadata: {},
  }
}

// ─── Resolve Content Folder Path ──────────────────────────────────────────────

export async function resolveContentFolderPath(gameDir: string, type: GameContentType): Promise<string> {
  let folderPath: string

  if (type === 'mod') {
    folderPath = path.join(gameDir, 'mods')
  } else if (type === 'resource_pack') {
    folderPath = path.join(gameDir, 'resourcepacks')
  } else if (type === 'shader_pack') {
    folderPath = path.join(gameDir, 'shaderpacks')
  } else {
    throw new Error(`Unknown content type: ${type}`)
  }

  await fs.mkdir(folderPath, { recursive: true })
  return folderPath
}
