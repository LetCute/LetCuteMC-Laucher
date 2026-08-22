import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import https from 'node:https'
import { createWriteStream } from 'node:fs'
import type {
  ModUpdateItem,
  ModUpdateCheckResult,
  UpdateSingleModResult,
  UpdateAllModsResult,
} from '../../shared/types'
import { parseJarModInfo, extractBaseMinecraftVersion, detectLoaderFromVersion } from './modDependencyService'
import { getDefaultMinecraftDirectory } from './storageService'

const USER_AGENT = 'LetCuteMC-Launcher/1.0 (contact@letcute.com)'

// Helper to compute sha1 and sha512
async function computeFileHashes(filePath: string): Promise<{ sha1: string; sha512: string } | null> {
  try {
    const buffer = await fs.readFile(filePath)
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex')
    const sha512 = crypto.createHash('sha512').update(buffer).digest('hex')
    return { sha1, sha512 }
  } catch {
    return null
  }
}

// Download file helper
function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination)
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location
        if (redirect) {
          file.close()
          return downloadFile(redirect, destination).then(resolve).catch(reject)
        }
      }
      if (res.statusCode !== 200) {
        file.close()
        return reject(new Error(`Tải file thất bại với mã lỗi HTTP ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      reject(err)
    })
  })
}

// Modrinth API call helper
async function fetchModrinthJson<T>(endpoint: string, options: https.RequestOptions & { body?: string } = {}): Promise<T | null> {
  return new Promise((resolve) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.modrinth.com/v2${endpoint}`)
    const req = https.request(
      url,
      {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          resolve(null)
          return
        }
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.setTimeout(12000, () => {
      req.destroy()
      resolve(null)
    })
    if (options.method === 'POST' && (options as any).body) {
      req.write((options as any).body)
    }
    req.end()
  })
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

    // Step 1: Parse local mods metadata & compute hashes
    const localMods: Array<{
      fileName: string
      filePath: string
      modId: string
      modName: string
      version: string
      sha1?: string
      sha512?: string
    }> = []

    const sha1List: string[] = []

    for (const jar of jarFiles) {
      const filePath = path.join(modsDir, jar.name)
      const parsed = await parseJarModInfo(filePath)
      const hashes = await computeFileHashes(filePath)

      const modId = parsed?.modId || path.basename(jar.name, '.jar')
      const modName = parsed?.name || modId
      const version = parsed?.version || '1.0.0'

      if (hashes?.sha1) {
        sha1List.push(hashes.sha1)
      }

      localMods.push({
        fileName: jar.name,
        filePath,
        modId,
        modName,
        version,
        sha1: hashes?.sha1,
        sha512: hashes?.sha512,
      })
    }

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

      // Query versions for this project matching current Minecraft version & Loader
      const gameVersionsQuery = encodeURIComponent(JSON.stringify([baseMcVersion]))
      const loadersQuery = encodeURIComponent(JSON.stringify([loader]))
      const versionsList = await fetchModrinthJson<any[]>(
        `/project/${projectId}/version?game_versions=${gameVersionsQuery}&loaders=${loadersQuery}`
      )

      if (!versionsList || !Array.isArray(versionsList) || versionsList.length === 0) {
        upToDateCount++
        return
      }

      // Latest release
      const latestVerObj = versionsList[0]
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

    // Run in parallel with concurrency pool of 4
    const executing: Promise<void>[] = []
    for (const mod of localMods) {
      const p = checkMod(mod)
      executing.push(p)
      if (executing.length >= 4) {
        await Promise.race(executing)
      }
    }
    await Promise.all(executing)

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
   * Update all available mods sequentially
   */
  async updateAllMods(gameDir: string | undefined, items: ModUpdateItem[]): Promise<UpdateAllModsResult> {
    const results: Array<{ modId: string; modName: string; success: boolean; error?: string }> = []
    let totalUpdated = 0
    let failedCount = 0

    for (const item of items) {
      const res = await this.updateSingleMod(gameDir, item)
      if (res.success) {
        totalUpdated++
        results.push({ modId: item.modId, modName: item.modName, success: true })
      } else {
        failedCount++
        results.push({ modId: item.modId, modName: item.modName, success: false, error: res.error })
      }
    }

    return {
      success: failedCount === 0,
      totalUpdated,
      failedCount,
      results,
    }
  }
}

export const modUpdaterService = new ModUpdaterService()
