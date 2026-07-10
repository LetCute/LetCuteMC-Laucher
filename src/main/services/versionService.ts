import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  MinecraftVersionItem,
  MinecraftVersionCatalog,
  MinecraftVersionType,
  OfficialMinecraftVersion,
  InstalledManualVersion,
  InstalledVersionKind,
  VersionCatalogResult,
} from '../../shared/types'

const MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const MANUAL_NOTE =
  'Version này được cài thủ công. LetCuteMC hiện chỉ chạy Vanilla chính thức.'

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function detectType(jsonType?: string): MinecraftVersionType {
  if (jsonType === 'release') return 'release'
  if (jsonType === 'snapshot') return 'snapshot'
  if (jsonType === 'old_beta') return 'old_beta'
  if (jsonType === 'old_alpha') return 'old_alpha'
  return 'unknown'
}

function detectInstalledVersionKind(
  json: Record<string, unknown> | null,
  id: string
): InstalledVersionKind {
  const lowerId = id.toLowerCase()
  const mainClass = String(json?.mainClass ?? '').toLowerCase()
  const text = json ? JSON.stringify(json).toLowerCase() : ''

  if (lowerId.includes('fabric') || mainClass.includes('fabric') || mainClass.includes('knot')) {
    return 'fabric'
  }
  if (lowerId.includes('quilt') || mainClass.includes('quilt')) return 'quilt'
  if (lowerId.includes('forge') || mainClass.includes('forge') || text.includes('minecraftforge')) {
    return 'forge'
  }
  if (json && !json.inheritsFrom && (json as any).downloads?.client) return 'vanilla'
  if (json?.inheritsFrom) return 'custom'
  return 'unknown'
}

interface MojangVersionEntry {
  id: string
  type: string
  url: string
  time: string
  releaseTime: string
}

/** Official Mojang releases only + manual installed scan. */
export async function getVersionCatalogResult(gameDir: string): Promise<VersionCatalogResult> {
  const [official, manualInstalled] = await Promise.all([
    fetchOfficialReleases(gameDir),
    scanManualInstalledVersions(gameDir),
  ])
  return { official, manualInstalled }
}

async function fetchOfficialReleases(gameDir: string): Promise<OfficialMinecraftVersion[]> {
  try {
    const response = await fetch(MOJANG_MANIFEST_URL, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return []

    const data = (await response.json()) as { versions?: MojangVersionEntry[] }
    if (!data.versions) return []

    const releases = data.versions.filter(v => v.type === 'release')
    const results: OfficialMinecraftVersion[] = []

    for (const v of releases) {
      const versionDir = path.join(gameDir, 'versions', v.id)
      const jsonPath = path.join(versionDir, `${v.id}.json`)
      const jarPath = path.join(versionDir, `${v.id}.jar`)
      const installed = (await pathExists(jsonPath)) && (await pathExists(jarPath))
      results.push({
        id: v.id,
        type: 'release',
        url: v.url,
        releaseTime: v.releaseTime,
        time: v.time,
        installed,
      })
    }
    return results
  } catch {
    return []
  }
}

async function scanManualInstalledVersions(gameDir: string): Promise<InstalledManualVersion[]> {
  const versionsDir = path.join(gameDir, 'versions')
  if (!(await pathExists(versionsDir))) return []

  let entries: string[] = []
  try {
    const dirents = await fs.readdir(versionsDir, { withFileTypes: true })
    entries = dirents.filter(d => d.isDirectory()).map(d => d.name)
  } catch {
    return []
  }

  // Official release ids for filtering pure vanilla folders
  let officialIds = new Set<string>()
  try {
    const response = await fetch(MOJANG_MANIFEST_URL, { signal: AbortSignal.timeout(10_000) })
    if (response.ok) {
      const data = (await response.json()) as { versions?: MojangVersionEntry[] }
      officialIds = new Set((data.versions ?? []).filter(v => v.type === 'release').map(v => v.id))
    }
  } catch {
    // ignore
  }

  const results: InstalledManualVersion[] = []

  for (const entry of entries) {
    const versionDir = path.join(versionsDir, entry)
    const jsonPath = path.join(versionDir, `${entry}.json`)
    let json: Record<string, unknown> | null = null

    if (await pathExists(jsonPath)) {
      try {
        json = JSON.parse(await fs.readFile(jsonPath, 'utf-8')) as Record<string, unknown>
      } catch {
        json = null
      }
    }

    const kind = detectInstalledVersionKind(json, entry)

    // Skip pure official vanilla folders — they belong in official list
    if (kind === 'vanilla' && officialIds.has(entry)) continue

    results.push({
      id: entry,
      kind,
      path: versionDir,
      inheritsFrom: json?.inheritsFrom ? String(json.inheritsFrom) : null,
      mainClass: json?.mainClass ? String(json.mainClass) : null,
      playable: false,
      message: MANUAL_NOTE,
    })
  }

  return results
}

// ─── Legacy catalog (releases for ProfileModal / older UI) ───────────────────

export async function scanLocalVersions(gameDir: string): Promise<MinecraftVersionItem[]> {
  const versionsDir = path.join(gameDir, 'versions')
  const results: MinecraftVersionItem[] = []
  if (!(await pathExists(versionsDir))) return results

  let entries: string[] = []
  try {
    const dirents = await fs.readdir(versionsDir, { withFileTypes: true })
    entries = dirents.filter(d => d.isDirectory()).map(d => d.name)
  } catch {
    return results
  }

  for (const entry of entries) {
    const versionDir = path.join(versionsDir, entry)
    const jsonPath = path.join(versionDir, `${entry}.json`)
    const jarPath = path.join(versionDir, `${entry}.jar`)
    const hasJson = await pathExists(jsonPath)
    const hasJar = await pathExists(jarPath)

    let jsonType: string | undefined
    let releaseTime: string | undefined
    if (hasJson) {
      try {
        const parsed = JSON.parse(await fs.readFile(jsonPath, 'utf-8')) as {
          type?: string
          releaseTime?: string
        }
        jsonType = parsed.type
        releaseTime = parsed.releaseTime
      } catch {
        // ignore
      }
    }

    results.push({
      id: entry,
      name: entry,
      type: detectType(jsonType),
      loader: 'vanilla',
      source: 'local',
      isInstalled: hasJson || hasJar,
      path: versionDir,
      releaseTime,
      hasJar,
      hasJson,
    })
  }
  return results
}

export async function fetchOnlineVersionManifest(): Promise<MinecraftVersionItem[]> {
  try {
    const response = await fetch(MOJANG_MANIFEST_URL, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return []
    const data = (await response.json()) as { versions?: MojangVersionEntry[] }
    if (!data.versions) return []
    return data.versions.map(
      (v): MinecraftVersionItem => ({
        id: v.id,
        name: v.id,
        type: detectType(v.type),
        loader: 'vanilla',
        source: 'online',
        isInstalled: false,
        path: null,
        releaseTime: v.releaseTime,
        url: v.url,
        hasJar: false,
        hasJson: false,
      })
    )
  } catch {
    return []
  }
}

/** Merged catalog — official releases preferred for create-profile. */
export async function getMinecraftVersionCatalog(gameDir: string): Promise<MinecraftVersionCatalog> {
  const [local, online] = await Promise.all([
    scanLocalVersions(gameDir),
    fetchOnlineVersionManifest(),
  ])

  const onlineMap = new Map(online.map(v => [v.id, v]))
  const localMap = new Map(local.map(v => [v.id, v]))
  const merged: MinecraftVersionItem[] = []

  for (const ov of online) {
    const lv = localMap.get(ov.id)
    if (lv) {
      merged.push({
        ...ov,
        source: 'local_and_online',
        isInstalled: lv.hasJson || lv.hasJar,
        path: lv.path,
        hasJar: lv.hasJar,
        hasJson: lv.hasJson,
        type: lv.type !== 'unknown' ? lv.type : ov.type,
        loader: 'vanilla',
      })
    } else {
      merged.push(ov)
    }
  }

  // Local-only non-official folders stay out of create-profile list (unknown type)
  for (const lv of local) {
    if (!onlineMap.has(lv.id)) {
      merged.push({ ...lv, type: 'unknown', loader: 'vanilla' })
    }
  }

  const byTime = (a: MinecraftVersionItem, b: MinecraftVersionItem): number => {
    if (!a.releaseTime && !b.releaseTime) return 0
    if (!a.releaseTime) return 1
    if (!b.releaseTime) return -1
    return b.releaseTime.localeCompare(a.releaseTime)
  }

  return {
    releases: merged.filter(v => v.type === 'release').sort(byTime),
    snapshots: merged.filter(v => v.type === 'snapshot').sort(byTime),
    oldBeta: merged.filter(v => v.type === 'old_beta').sort(byTime),
    oldAlpha: merged.filter(v => v.type === 'old_alpha').sort(byTime),
    unknown: merged.filter(v => v.type === 'unknown').sort(byTime),
    all: merged,
  }
}
