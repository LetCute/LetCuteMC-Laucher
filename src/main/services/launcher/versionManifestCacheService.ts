import path from 'node:path'
import fs from 'node:fs/promises'
import type { MinecraftVersionManifest, VersionManifestCacheMeta } from '../../../shared/types'

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

import { getVersionManifestCacheDir } from '../system/storageService.js'
import { getUrlCandidates } from '../system/mirrorService.js'

export async function getCachedVersionManifest(
  options?: {
    forceRefresh?: boolean
    ttlMs?: number
  }
): Promise<MinecraftVersionManifest> {
  const cacheDir = getVersionManifestCacheDir()
  const manifestPath = path.join(cacheDir, 'version-manifest.json')
  const metaPath = path.join(cacheDir, 'version-manifest.meta.json')
  
  const ttlMs = options?.ttlMs ?? 21600000 // default 6 hours
  const forceRefresh = options?.forceRefresh ?? false

  await fs.mkdir(cacheDir, { recursive: true })

  let useCache = false

  if (!forceRefresh && (await pathExists(manifestPath)) && (await pathExists(metaPath))) {
    try {
      const metaContent = await fs.readFile(metaPath, 'utf8')
      const meta = JSON.parse(metaContent) as VersionManifestCacheMeta
      const age = Date.now() - new Date(meta.updatedAt).getTime()
      if (age < ttlMs) {
        useCache = true
      }
    } catch (e) {
      console.warn('[Cache] Error reading meta cache, fetching fresh:', e)
    }
  }

  if (useCache) {
    try {
      const content = await fs.readFile(manifestPath, 'utf8')
      return JSON.parse(content) as MinecraftVersionManifest
    } catch (e) {
      console.warn('[Cache] Read manifest cache failed, fetching fresh:', e)
    }
  }

  // Fetch online with mirror candidates
  const primaryUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
  const candidates = getUrlCandidates(primaryUrl)
  let lastError: any = null

  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP status ${res.status}`)
      const manifest = (await res.json()) as MinecraftVersionManifest

      // Save to cache
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
      const meta: VersionManifestCacheMeta = {
        updatedAt: new Date().toISOString(),
        ttlMs,
      }
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8')
      return manifest
    } catch (err) {
      lastError = err
    }
  }

  // If offline or fetch failed, fallback to stale cache if available
  if (await pathExists(manifestPath)) {
    console.warn('[Cache] Fetch manifest failed, returning stale cache:', lastError)
    const content = await fs.readFile(manifestPath, 'utf8')
    return JSON.parse(content) as MinecraftVersionManifest
  }
  throw new Error(`Failed to retrieve Minecraft version manifest: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

export async function clearVersionManifestCache(): Promise<boolean> {
  const cacheDir = getVersionManifestCacheDir()
  const manifestPath = path.join(cacheDir, 'version-manifest.json')
  const metaPath = path.join(cacheDir, 'version-manifest.meta.json')
  
  try {
    if (await pathExists(manifestPath)) await fs.unlink(manifestPath)
    if (await pathExists(metaPath)) await fs.unlink(metaPath)
    return true
  } catch (e) {
    console.error('[Cache] Clear manifest cache failed:', e)
    return false
  }
}

