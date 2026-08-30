import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { downloadTasks, type DownloadTask } from '../system/downloadManager'
import { getUrlCandidates } from '../system/mirrorService'
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
 * Syncs version folder from mcRootDir into isolated gameDir if profile is an isolated modpack.
 */
export async function syncModpackVersionFolder(
  versionId: string,
  mcRootDir: string,
  gameDir: string,
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
): Promise<void> {
  const isIsolated = gameDir.toLowerCase() !== mcRootDir.toLowerCase() &&
    (gameDir.toLowerCase().includes(`${path.sep}profiles${path.sep}`) || gameDir.toLowerCase().includes('/profiles/'))

  if (!isIsolated) return

  const srcVerDir = path.join(mcRootDir, 'versions', versionId)
  const destVerDir = path.join(gameDir, 'versions', versionId)

  if (!await pathExists(srcVerDir)) return

  await fs.mkdir(destVerDir, { recursive: true })
  const files = await fs.readdir(srcVerDir)
  for (const f of files) {
    const srcFile = path.join(srcVerDir, f)
    const destFile = path.join(destVerDir, f)
    const stat = await fs.stat(srcFile)
    if (stat.isFile()) {
      await fs.copyFile(srcFile, destFile)
    }
  }
  log?.('info', `Đã đồng bộ version metadata vào thư mục profile: ${destVerDir}`)
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

  // 1. Client jar
  if (version.downloads?.client) {
    const clientPath = path.join(mcRootDir, 'versions', version.id, `${version.id}.jar`)
    const valid = (await pathExists(clientPath)) && (!version.downloads.client.sha1 || (await checkFileHash(clientPath, version.downloads.client.sha1)))
    if (!valid) {
      tasks.push({
        id: `client-${version.id}`,
        label: `Minecraft ${version.id} Client`,
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

  if (tasks.length > 0) {
    if (isCancelled?.()) throw new Error('PREPARE_CANCELLED')
    await downloadTasks(tasks, {
      concurrency: 12,
      onProgress: (p) => {
        onProgress?.(Math.round(p.percent), p.current, p.total)
      },
    })
  }
}
