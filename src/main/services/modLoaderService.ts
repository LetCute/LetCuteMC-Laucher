import {
  installForge as xmclInstallForge,
  installNeoForged as xmclInstallNeoForge,
  getFabricLoaders,
  installFabric as xmclInstallFabric,
  getQuiltLoaders,
  installQuiltVersion,
} from '@xmcl/installer'
import type { ModLoaderVersion } from '../../shared/types'

// ─── Forge ────────────────────────────────────────────────────────────────────

const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json'

/**
 * Lấy danh sách Forge versions từ promotions_slim.json
 * Format: { promos: { "1.20.1-latest": "47.3.0", "1.20.1-recommended": "47.2.0", ... } }
 * Trả về mỗi MC version → forge version (ưu tiên recommended, fallback latest)
 */
export async function getForgeVersions(): Promise<ModLoaderVersion[]> {
  try {
    const res = await fetch(FORGE_PROMOTIONS_URL, {
      headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { promos: Record<string, string> }

    // Parse promos: key = "<mcVersion>-latest" hoặc "<mcVersion>-recommended"
    const versionMap = new Map<string, { latest?: string; recommended?: string }>()
    for (const [key, forgeVer] of Object.entries(data.promos)) {
      const match = key.match(/^(.+)-(latest|recommended)$/)
      if (!match) continue
      const [, mcVer, type] = match
      if (!versionMap.has(mcVer)) versionMap.set(mcVer, {})
      const entry = versionMap.get(mcVer)!
      if (type === 'latest') entry.latest = forgeVer
      if (type === 'recommended') entry.recommended = forgeVer
    }

    // Chuyển thành ModLoaderVersion[], mỗi entry = 1 MC version
    const results: ModLoaderVersion[] = []
    for (const [mcVer, { latest, recommended }] of versionMap) {
      // Ưu tiên recommended nếu có
      if (recommended) {
        results.push({
          version: `${mcVer}-${recommended}`,
          stable: true,
        })
      }
      // Thêm latest nếu khác recommended
      if (latest && latest !== recommended) {
        results.push({
          version: `${mcVer}-${latest}`,
          stable: false,
        })
      }
    }

    // Sort giảm dần theo MC version
    results.sort((a, b) => {
      const mcA = a.version.split('-')[0]
      const mcB = b.version.split('-')[0]
      return compareMcVersions(mcB, mcA)
    })

    return results
  } catch (error) {
    console.error('Failed to get Forge versions:', error)
    return []
  }
}

// ─── NeoForge ─────────────────────────────────────────────────────────────────

const NEOFORGE_VERSIONS_URL = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'

/**
 * Lấy danh sách NeoForge versions từ Maven API
 * Format: { versions: ["21.4.157", "21.4.156-beta", ...] }
 */
export async function getNeoForgeVersions(): Promise<ModLoaderVersion[]> {
  try {
    const res = await fetch(NEOFORGE_VERSIONS_URL, {
      headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { versions: string[] }

    // Lọc bỏ snapshot/alpha, chỉ giữ version hợp lệ (xx.yy.zz hoặc xx.yy.zz-beta)
    const results: ModLoaderVersion[] = data.versions
      .filter(v => !v.includes('alpha') && !v.includes('snapshot') && !v.includes('craftmine'))
      .map(v => ({
        version: v,
        stable: !v.includes('-beta'),
      }))

    // Sắp xếp giảm dần (mới nhất trước)
    results.reverse()

    return results
  } catch (error) {
    console.error('Failed to get NeoForge versions:', error)
    return []
  }
}

// ─── Forge & NeoForge Install ─────────────────────────────────────────────────

export async function installForge(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  try {
    // loaderVersion format: "1.20.1-47.3.0" → mcversion = "1.20.1", version = "47.3.0"
    let forgeVersion = loaderVersion
    let mc = mcVersion

    // Nếu loaderVersion chứa mcVersion prefix thì tách ra
    if (loaderVersion.startsWith(mcVersion + '-')) {
      forgeVersion = loaderVersion.substring(mcVersion.length + 1)
    }

    const versionName = await xmclInstallForge(
      { mcversion: mc, version: forgeVersion },
      gameDir
    )
    return versionName
  } catch (error) {
    console.error('Failed to install Forge:', error)
    throw new Error(`Cài đặt Forge thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function installNeoForge(_mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  try {
    const versionName = await xmclInstallNeoForge('neoforge', loaderVersion, gameDir, {})
    return versionName
  } catch (error) {
    console.error('Failed to install NeoForge:', error)
    throw new Error(`Cài đặt NeoForge thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ─── Fabric ───────────────────────────────────────────────────────────────────

export async function getFabricVersions(): Promise<ModLoaderVersion[]> {
  try {
    const loaders = await getFabricLoaders()
    return loaders.map(l => ({
      version: l.version,
      stable: l.stable ?? true,
    }))
  } catch (error) {
    console.error('Failed to get Fabric versions:', error)
    return []
  }
}

export async function installFabric(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  try {
    const versionName = await xmclInstallFabric({ minecraftVersion: mcVersion, version: loaderVersion, minecraft: gameDir })
    return versionName
  } catch (error) {
    console.error('Failed to install Fabric:', error)
    throw new Error(`Cài đặt Fabric thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ─── Quilt ────────────────────────────────────────────────────────────────────

export async function getQuiltVersions(): Promise<ModLoaderVersion[]> {
  try {
    const loaders = await getQuiltLoaders()
    return loaders.map(l => ({
      version: l.version,
      stable: true,
    }))
  } catch (error) {
    console.error('Failed to get Quilt versions:', error)
    return []
  }
}

export async function installQuilt(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  try {
    const versionName = await installQuiltVersion({ minecraftVersion: mcVersion, version: loaderVersion, minecraft: gameDir })
    return versionName
  } catch (error) {
    console.error('Failed to install Quilt:', error)
    throw new Error(`Cài đặt Quilt thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** So sánh 2 MC version strings, ví dụ "1.20.1" vs "1.19.4" */
function compareMcVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
