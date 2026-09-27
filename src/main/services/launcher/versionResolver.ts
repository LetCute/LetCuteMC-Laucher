import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { downloadTasks, type DownloadTask } from '../system/downloadManager'
import { getCachedVersionManifest } from './versionManifestCacheService'

export interface PrepareVersionOptions {
  versionId: string
  mcRootDir: string
  gameDir: string
  onProgress?: (taskName: string, percent: number) => void
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
  isCancelled?: () => boolean
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function checkFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, 'r')
    const hash = crypto.createHash('sha1')
    const buffer = Buffer.alloc(64 * 1024)
    let read
    while ((read = await handle.read(buffer, 0, buffer.length, null)).bytesRead > 0) {
      hash.update(buffer.subarray(0, read.bytesRead))
    }
    await handle.close()
    return hash.digest('hex') === expectedHash
  } catch {
    return false
  }
}

/**
 * Downloads version JSON and its parent inheritance chain.
 */
export async function ensureVersionMetadata(
  versionId: string,
  mcRootDir: string,
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
): Promise<any> {
  const versionJsonPath = path.join(mcRootDir, 'versions', versionId, `${versionId}.json`)

  if (!await pathExists(versionJsonPath)) {
    log?.('info', `Đang tìm kiếm metadata cho phiên bản: ${versionId}`)
    const manifest = await getCachedVersionManifest()
    const entry = manifest.versions.find((v: any) => v.id === versionId)
    if (!entry?.url) {
      throw new Error(`Không tìm thấy siêu dữ liệu cho phiên bản ${versionId} trên hệ thống Mojang.`)
    }

    const dir = path.dirname(versionJsonPath)
    await fs.mkdir(dir, { recursive: true })
    const res = await fetch(entry.url)
    if (!res.ok) throw new Error(`Không thể tải version metadata: HTTP ${res.status}`)
    const text = await res.text()
    await fs.writeFile(versionJsonPath, text, 'utf8')
  }

  const rawJson = JSON.parse(await fs.readFile(versionJsonPath, 'utf8'))

  // Resolve inheritsFrom recursively
  if (rawJson.inheritsFrom && rawJson.inheritsFrom !== versionId) {
    await ensureVersionMetadata(rawJson.inheritsFrom, mcRootDir, log)
  }

  return rawJson
}

/**
 * Lấy danh sách chuỗi kế thừa version [versionId, parentVersion, ...]
 */
export async function getVersionInheritanceChain(versionId: string, baseDir: string): Promise<string[]> {
  const chain: string[] = []
  let curr: string | undefined = versionId
  const visited = new Set<string>()

  while (curr && !visited.has(curr)) {
    visited.add(curr)
    chain.push(curr)
    const jsonPath = path.join(baseDir, 'versions', curr, `${curr}.json`)
    try {
      const content = await fs.readFile(jsonPath, 'utf8')
      const parsed = JSON.parse(content)
      curr = parsed.inheritsFrom && typeof parsed.inheritsFrom === 'string' && parsed.inheritsFrom !== curr
        ? parsed.inheritsFrom
        : undefined
    } catch {
      break
    }
  }

  return chain
}

/**
 * Syncs full version tree (both loader version and root base Minecraft version) into isolated gameDir.
 * Loader folders contain only metadata (.json), while the root base version contains both .jar and .json.
 */
export async function syncModpackVersionFolder(
  versionId: string,
  mcRootDir: string,
  gameDir: string,
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
): Promise<void> {
  const isIsolated = path.resolve(gameDir).toLowerCase() !== path.resolve(mcRootDir).toLowerCase()

  if (!isIsolated) return

  await ensureVersionMetadata(versionId, mcRootDir, log).catch(() => {})

  const chain = await getVersionInheritanceChain(versionId, mcRootDir)
  for (let i = 0; i < chain.length; i++) {
    const ver = chain[i]
    const isInheritingLoader = i < chain.length - 1
    const srcVerDir = path.join(mcRootDir, 'versions', ver)
    const destVerDir = path.join(gameDir, 'versions', ver)

    // Xóa file .jar thừa ở folder loader nếu có
    if (isInheritingLoader) {
      await fs.unlink(path.join(srcVerDir, `${ver}.jar`)).catch(() => {})
      await fs.unlink(path.join(destVerDir, `${ver}.jar`)).catch(() => {})
    }

    if (!await pathExists(srcVerDir)) continue

    await fs.mkdir(destVerDir, { recursive: true })
    const files = await fs.readdir(srcVerDir)
    for (const f of files) {
      if (isInheritingLoader && f.endsWith('.jar')) continue
      const srcFile = path.join(srcVerDir, f)
      const destFile = path.join(destVerDir, f)
      const stat = await fs.stat(srcFile)
      if (stat.isFile()) {
        await fs.copyFile(srcFile, destFile)
      }
    }
  }
  log?.('info', `Đã đồng bộ version metadata vào thư mục profile: ${path.join(gameDir, 'versions')}`)
}

/**
 * Validates and batch-downloads version libraries and client assets.
 */
export async function ensureLibrariesAndAssets(
  version: any,
  mcRootDir: string,
  onProgress?: (percent: number, current: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<void> {
  const tasks: DownloadTask[] = []

  // 1. Client jar - Lưu vào đúng version gốc (minecraftVersion hoặc inheritsFrom), không lưu vào version của loader
  if (version.downloads?.client) {
    const jarVersion = version.minecraftVersion || (version.inheritsFrom ? version.inheritsFrom : version.id)
    const clientPath = path.join(mcRootDir, 'versions', jarVersion, `${jarVersion}.jar`)
    let valid = (await pathExists(clientPath)) && (!version.downloads.client.sha1 || (await checkFileHash(clientPath, version.downloads.client.sha1)))

    // Nếu clientPath chưa có nhưng jar bị đặt nhầm ở version.id (loader), chuyển về đúng thư mục
    if (!valid && version.id !== jarVersion) {
      const misplacedJar = path.join(mcRootDir, 'versions', version.id, `${version.id}.jar`)
      if (await pathExists(misplacedJar)) {
        const matchesSha1 = !version.downloads.client.sha1 || (await checkFileHash(misplacedJar, version.downloads.client.sha1))
        if (matchesSha1) {
          await fs.mkdir(path.dirname(clientPath), { recursive: true })
          await fs.rename(misplacedJar, clientPath).catch(async () => {
            await fs.copyFile(misplacedJar, clientPath)
            await fs.unlink(misplacedJar).catch(() => {})
          })
          valid = true
        } else {
          await fs.unlink(misplacedJar).catch(() => {})
        }
      }
    }

    // Luôn dọn dẹp file .jar ở loader folder nếu loader khác jarVersion
    if (version.id !== jarVersion) {
      const misplacedJar = path.join(mcRootDir, 'versions', version.id, `${version.id}.jar`)
      if (await pathExists(misplacedJar)) {
        await fs.unlink(misplacedJar).catch(() => {})
      }
    }

    if (!valid) {
      tasks.push({
        id: `client-${jarVersion}`,
        label: `Minecraft ${jarVersion} Client`,
        url: version.downloads.client.url,
        destinationPath: clientPath,
        sha1: version.downloads.client.sha1,
        size: version.downloads.client.size,
      })
    }
  }

  // 2. Libraries
  if (Array.isArray(version.libraries)) {
    for (const lib of version.libraries) {
      const artifact = lib.downloads?.artifact || lib.download?.artifact || lib.download
      if (artifact?.url && artifact?.path) {
        const dest = path.join(mcRootDir, 'libraries', artifact.path)
        const valid = (await pathExists(dest)) && (!artifact.sha1 || (await checkFileHash(dest, artifact.sha1)))
        if (!valid) {
          tasks.push({
            id: `lib-${artifact.path}`,
            label: `Library: ${path.basename(artifact.path)}`,
            url: artifact.url,
            destinationPath: dest,
            sha1: artifact.sha1,
            size: artifact.size,
          })
        }
      }
    }
  }

  // 3. Asset Index & Ngôn ngữ Tiếng Việt
  if (version.assetIndex?.url && version.assetIndex?.id) {
    const indexPath = path.join(mcRootDir, 'assets', 'indexes', `${version.assetIndex.id}.json`)
    const indexValid = (await pathExists(indexPath)) && (!version.assetIndex.sha1 || (await checkFileHash(indexPath, version.assetIndex.sha1)))
    if (!indexValid) {
      tasks.push({
        id: `asset-index-${version.assetIndex.id}`,
        label: `Asset Index ${version.assetIndex.id}`,
        url: version.assetIndex.url,
        destinationPath: indexPath,
        sha1: version.assetIndex.sha1,
        size: version.assetIndex.size,
      })
    } else {
      try {
        const raw = await fs.readFile(indexPath, 'utf8')
        const indexData = JSON.parse(raw)
        if (indexData?.objects) {
          const langKeys = Object.keys(indexData.objects).filter(k => k.startsWith('minecraft/lang/vi_'))
          for (const key of langKeys) {
            const item = indexData.objects[key]
            if (item?.hash) {
              const prefix = item.hash.substring(0, 2)
              const destObj = path.join(mcRootDir, 'assets', 'objects', prefix, item.hash)
              const valid = (await pathExists(destObj)) && (await checkFileHash(destObj, item.hash))
              if (!valid) {
                tasks.push({
                  id: `asset-lang-${item.hash}`,
                  label: `Ngôn ngữ Tiếng Việt (${path.basename(key)})`,
                  url: `https://resources.download.minecraft.net/${prefix}/${item.hash}`,
                  destinationPath: destObj,
                  sha1: item.hash,
                  size: item.size,
                })
              }
            }
          }
        }
      } catch {}
    }
  }

  if (tasks.length > 0) {
    if (isCancelled?.()) throw new Error('PREPARE_CANCELLED')
    await downloadTasks(tasks, {
      concurrency: 12,
      onProgress: (p) => {
        onProgress?.(Math.round(p.percent), p.current, p.total)
      },
    })
  }

  // Nếu asset index vừa được tải ở lượt trên, đảm bảo file ngôn ngữ Tiếng Việt cũng được tải
  if (version.assetIndex?.id) {
    const indexPath = path.join(mcRootDir, 'assets', 'indexes', `${version.assetIndex.id}.json`)
    try {
      if (await pathExists(indexPath)) {
        const raw = await fs.readFile(indexPath, 'utf8')
        const indexData = JSON.parse(raw)
        if (indexData?.objects) {
          const langTasks: DownloadTask[] = []
          const langKeys = Object.keys(indexData.objects).filter(k => k.startsWith('minecraft/lang/vi_'))
          for (const key of langKeys) {
            const item = indexData.objects[key]
            if (item?.hash) {
              const prefix = item.hash.substring(0, 2)
              const destObj = path.join(mcRootDir, 'assets', 'objects', prefix, item.hash)
              const valid = (await pathExists(destObj)) && (await checkFileHash(destObj, item.hash))
              if (!valid) {
                langTasks.push({
                  id: `asset-lang-${item.hash}`,
                  label: `Ngôn ngữ Tiếng Việt (${path.basename(key)})`,
                  url: `https://resources.download.minecraft.net/${prefix}/${item.hash}`,
                  destinationPath: destObj,
                  sha1: item.hash,
                  size: item.size,
                })
              }
            }
          }
          if (langTasks.length > 0) {
            if (isCancelled?.()) throw new Error('PREPARE_CANCELLED')
            await downloadTasks(langTasks, { concurrency: 4 })
          }
        }
      }
    } catch {}
  }
}
