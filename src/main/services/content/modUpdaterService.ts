import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import type {
  ModUpdateItem,
  ModUpdateCheckResult,
  UpdateSingleModResult,
  UpdateAllModsResult,
} from '../../../shared/types'
import { parseJarModInfo, extractBaseMinecraftVersion, detectLoaderFromVersion } from './modDependencyService'
import { getDefaultMinecraftDirectory } from '../system/storageService'
import { asyncPool } from '../../utils/asyncPool'

const USER_AGENT = 'LetCuteMC-Launcher/1.0 (contact@letcute.com)'

// ponytail: stream-based dual hash — reads file once, computes both sha1+sha512
async function computeFileHashes(filePath: string): Promise<{ sha1: string; sha512: string } | null> {
  try {
    const sha1 = crypto.createHash('sha1')
    const sha512 = crypto.createHash('sha512')
    const stream = createReadStream(filePath)
    for await (const chunk of stream) {
      sha1.update(chunk)
      sha512.update(chunk)
    }
    return { sha1: sha1.digest('hex'), sha512: sha512.digest('hex') }
  } catch {
    return null
  }
}

// ponytail: unified fetch-based download — drops legacy https.get, streams to disk
async function downloadFile(url: string, destination: string): Promise<void> {
  const { Readable } = await import('node:stream')
  const { pipeline } = await import('node:stream/promises')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: controller.signal,
    redirect: 'follow',
  }).finally(() => clearTimeout(timeoutId))
  if (!res.ok) throw new Error(`Tải file thất bại với mã lỗi HTTP ${res.status}`)
  if (!res.body) throw new Error('Response body is null')
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destination))
}

// ponytail: unified fetch-based JSON call — drops https.request, includes timeout
async function fetchModrinthJson<T>(
  endpoint: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<T | null> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `https://api.modrinth.com/v2${endpoint}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// Compare semantic / string versions
function isNewerVersion(currentVer: string, newVer: string): boolean {
  if (!currentVer || !newVer) return false
  const c = currentVer.trim().toLowerCase().replace(/^v/, '')
  const n = newVer.trim().toLowerCase().replace(/^v/, '')
  if (c === n) return false

  // Try numerical semver comparison
  const cParts = c.split(/[-+._]/).map((p) => parseInt(p, 10)).filter((p) => !isNaN(p))
  const nParts = n.split(/[-+._]/).map((p) => parseInt(p, 10)).filter((p) => !isNaN(p))

  if (cParts.length > 0 && nParts.length > 0) {
    const len = Math.max(cParts.length, nParts.length)
    for (let i = 0; i < len; i++) {
      const cv = cParts[i] ?? 0
      const nv = nParts[i] ?? 0
      if (nv > cv) return true
      if (nv < cv) return false
    }
  }

  // Fallback: If different string, consider as new if contains higher number
  return c !== n
}

export class ModUpdaterService {
  /**
   * Scan installed mods and check for updates against Modrinth API
   */
  async checkForModUpdates(
    gameDir?: string,
    rawMcVersion: string = '1.20.1',
    rawLoader: string = 'fabric'
  ): Promise<ModUpdateCheckResult> {
    const targetDir = gameDir || getDefaultMinecraftDirectory()
    const modsDir = path.join(targetDir, 'mods')

    const baseMcVersion = extractBaseMinecraftVersion(rawMcVersion)
    const loader = detectLoaderFromVersion(rawLoader) === 'unknown' ? 'fabric' : detectLoaderFromVersion(rawLoader)

    try {
      await fs.access(modsDir)
    } catch {
      return { totalMods: 0, upToDateCount: 0, updatesAvailableCount: 0, updates: [] }
    }

    const entries = await fs.readdir(modsDir, { withFileTypes: true })
    const jarFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.jar'))

    if (jarFiles.length === 0) {
      return { totalMods: 0, upToDateCount: 0, updatesAvailableCount: 0, updates: [] }
    }

    // Step 1: Scan local mods with concurrency
    const localMods = await asyncPool(4, jarFiles, async (jar) => {
      const filePath = path.join(modsDir, jar.name)
      const parsed = await parseJarModInfo(filePath)
      const hashes = await computeFileHashes(filePath)

      const modId = parsed?.modId || path.basename(jar.name, '.jar')
      const modName = parsed?.name || modId
      const version = parsed?.version || '1.0.0'

      return {
        fileName: jar.name,
        filePath,
        modId,
        modName,
        version,
        sha1: hashes?.sha1,
        sha512: hashes?.sha512,
      }
    })

    const sha1List: string[] = localMods
      .map(m => m.sha1)
      .filter((hash): hash is string => Boolean(hash))

    // Step 2: Batch lookup file hashes on Modrinth
    let hashVersionMap: Record<string, any> = {}
    if (sha1List.length > 0) {
      const res = await fetchModrinthJson<Record<string, any>>('/version_files', {
        method: 'POST',
        body: JSON.stringify({ hashes: sha1List, algorithm: 'sha1' }),
      })
      if (res && typeof res === 'object') {
        hashVersionMap = res
      }
    }

    // Step 3: For each mod, identify project and check latest compatible version
    const updates: ModUpdateItem[] = []
    let upToDateCount = 0

    // Concurrency limit for project version fetching
    const checkMod = async (mod: typeof localMods[0]) => {
      let projectId: string | null = null
      let projectIconUrl: string | null = null

      // Check if hash identified the project
      if (mod.sha1 && hashVersionMap[mod.sha1]) {
        const verObj = hashVersionMap[mod.sha1]
        projectId = verObj.project_id || null
      }

      // If not identified by hash, search project by modId / slug on Modrinth
      if (!projectId) {
        const searchRes = await fetchModrinthJson<{ hits?: Array<{ project_id: string; slug: string; icon_url?: string }> }>(
          `/search?query=${encodeURIComponent(mod.modId)}&facets=[["project_type:mod"]]&limit=3`
        )
        if (searchRes?.hits && searchRes.hits.length > 0) {
          const matched = searchRes.hits.find(
            (h) => h.slug.toLowerCase() === mod.modId.toLowerCase() || h.project_id === mod.modId
          ) || searchRes.hits[0]
          projectId = matched.project_id
          projectIconUrl = matched.icon_url || null
        }
      }

      if (!projectId) {
        upToDateCount++
        return
      }

      // Query versions for this project strictly matching current Minecraft version & Loader
      const gameVersionsQuery = encodeURIComponent(JSON.stringify([baseMcVersion]))
      const loadersQuery = encodeURIComponent(JSON.stringify([loader]))
      const versionsList = await fetchModrinthJson<any[]>(
        `/project/${projectId}/version?game_versions=${gameVersionsQuery}&loaders=${loadersQuery}`
      )

      if (!versionsList || !Array.isArray(versionsList) || versionsList.length === 0) {
        upToDateCount++
        return
      }

      // Filter to ensure version supports the exact Minecraft version and target loader
      const compatibleVersions = versionsList.filter((v: any) => {
        const hasMc = Array.isArray(v.game_versions) && v.game_versions.includes(baseMcVersion)
        const hasLoader = Array.isArray(v.loaders) && v.loaders.includes(loader)
        return hasMc && hasLoader
      })

      if (compatibleVersions.length === 0) {
        upToDateCount++
        return
      }

      // Latest release among compatible versions
      const latestVerObj = compatibleVersions.find((v: any) => v.version_type === 'release') || compatibleVersions[0]
      const latestVerNumber = latestVerObj.version_number || latestVerObj.name || ''
      const primaryFile = (latestVerObj.files || []).find((f: any) => f.primary) || latestVerObj.files?.[0]

      if (!primaryFile || !primaryFile.url) {
        upToDateCount++
        return
      }

      const hasUpdate = isNewerVersion(mod.version, latestVerNumber)

      if (hasUpdate) {
        updates.push({
          fileName: mod.fileName,
          filePath: mod.filePath,
          modId: mod.modId,
          modName: mod.modName,
          currentVersion: mod.version,
          newVersion: latestVerNumber,
          newVersionName: latestVerObj.name || latestVerNumber,
          newVersionId: latestVerObj.id,
          changelog: latestVerObj.changelog || 'Không có mô tả cập nhật chi tiết.',
          downloadUrl: primaryFile.url,
          newFileName: primaryFile.filename || path.basename(primaryFile.url),
          newFileSize: primaryFile.size || 0,
          releaseDate: latestVerObj.date_published || new Date().toISOString(),
          updateAvailable: true,
          projectId,
          projectIconUrl,
          loader,
        })
      } else {
        upToDateCount++
      }
    }

    await asyncPool(4, localMods, checkMod)

    return {
      totalMods: localMods.length,
      upToDateCount,
      updatesAvailableCount: updates.length,
      updates,
    }
  }

  /**
   * Update a single mod safely (backup old jar, download new jar, remove old)
   */
  async updateSingleMod(gameDir: string | undefined, item: ModUpdateItem): Promise<UpdateSingleModResult> {
    const targetDir = gameDir || getDefaultMinecraftDirectory()
    const modsDir = path.join(targetDir, 'mods')
    const backupDir = path.join(modsDir, '.backup_updates')

    try {
      await fs.mkdir(backupDir, { recursive: true })

      const oldPath = path.join(modsDir, item.fileName)
      const backupPath = path.join(backupDir, `${item.fileName}.bak`)
      const newPath = path.join(modsDir, item.newFileName)

      // 1. Move old jar to backup
      try {
        await fs.copyFile(oldPath, backupPath)
      } catch {
        /* ignore if old file already moved */
      }

      // 2. Download new jar
      await downloadFile(item.downloadUrl, newPath)

      // 3. Remove old jar if filename differs from new jar
      if (oldPath !== newPath) {
        await fs.unlink(oldPath).catch(() => {})
      }

      return {
        success: true,
        modId: item.modId,
        oldFileName: item.fileName,
        newFileName: item.newFileName,
      }
    } catch (err: any) {
      console.error(`Failed to update mod ${item.modName}:`, err)
      return {
        success: false,
        modId: item.modId,
        oldFileName: item.fileName,
        newFileName: item.newFileName,
        error: err?.message || 'Lỗi khi tải bản cập nhật.',
      }
    }
  }

  /**
   * Update all available mods concurrently
   */
  async updateAllMods(gameDir: string | undefined, items: ModUpdateItem[]): Promise<UpdateAllModsResult> {
    let totalUpdated = 0
    let failedCount = 0

    const results = await asyncPool(3, items, async (item) => {
      const res = await this.updateSingleMod(gameDir, item)
      if (res.success) {
        totalUpdated++
        return { modId: item.modId, modName: item.modName, success: true }
      } else {
        failedCount++
        return { modId: item.modId, modName: item.modName, success: false, error: res.error }
      }
    })

    return {
      success: failedCount === 0,
      totalUpdated,
      failedCount,
      results,
    }
  }
}

export const modUpdaterService = new ModUpdaterService()

