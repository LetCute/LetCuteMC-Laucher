// @xmcl/installer is lazy-loaded to reduce cold-start time.
// It's only needed when the user actually installs a mod loader.
import fs from 'fs'
import path from 'path'
import type { ModLoaderVersion } from '../../../shared/types'

async function getXmclInstaller() {
  return await import('@xmcl/installer')
}

// ─── Forge ────────────────────────────────────────────────────────────────────

const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json'

/**
 * Lấy danh sách Forge versions từ promotions_slim.json
 * Format: { promos: { "1.20.1-latest": "47.3.0", "1.20.1-recommended": "47.2.0", ... } }
 * Trả về Forge versions (lọc theo mcVersion nếu được truyền vào, ưu tiên recommended)
 */
export async function getForgeVersions(mcVersion?: string): Promise<ModLoaderVersion[]> {
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
      if (!match || !match[1] || !match[2]) continue
      const promoMcVer = match[1]
      const type = match[2]

      if (mcVersion && promoMcVer !== mcVersion) continue

      if (!versionMap.has(promoMcVer)) versionMap.set(promoMcVer, {})
      const entry = versionMap.get(promoMcVer)!
      if (type === 'latest') entry.latest = forgeVer
      if (type === 'recommended') entry.recommended = forgeVer
    }

    // Chuyển thành ModLoaderVersion[]
    const results: ModLoaderVersion[] = []
    for (const [promoMcVer, { latest, recommended }] of versionMap) {
      if (recommended) {
        results.push({
          version: mcVersion ? recommended : `${promoMcVer}-${recommended}`,
          stable: true,
        })
      }
      if (latest && latest !== recommended) {
        results.push({
          version: mcVersion ? latest : `${promoMcVer}-${latest}`,
          stable: false,
        })
      }
    }

    // Ưu tiên stable (recommended) lên đầu, sau đó sort theo version giảm dần
    results.sort((a, b) => {
      if (a.stable !== b.stable) return a.stable ? -1 : 1
      const vA = a.version.includes('-') ? a.version.split('-')[1] ?? a.version : a.version
      const vB = b.version.includes('-') ? b.version.split('-')[1] ?? b.version : b.version
      return compareMcVersions(vB, vA)
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
 * Lọc theo mcVersion nếu được truyền vào.
 */
export async function getNeoForgeVersions(mcVersion?: string): Promise<ModLoaderVersion[]> {
  try {
    const res = await fetch(NEOFORGE_VERSIONS_URL, {
      headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { versions: string[] }

    // Lọc bỏ snapshot/alpha
    let versions = data.versions
      .filter(v => !v.includes('alpha') && !v.includes('snapshot') && !v.includes('craftmine'))

    if (mcVersion) {
      let prefix = ''
      if (mcVersion.startsWith('1.')) {
        const parts = mcVersion.split('.')
        const minor = parts[1]
        const patch = parts[2] || '0'
        prefix = `${minor}.${patch}.`
      } else {
        prefix = `${mcVersion}.`
      }
      versions = versions.filter(v => v.startsWith(prefix))
    }

    const results: ModLoaderVersion[] = versions.map(v => ({
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

// ─── Helper: Dọn dẹp file installer bị hỏng hoặc 0 byte ──────────────────────

async function cleanupCorruptJar(filePath: string): Promise<void> {
  try {
    const stat = await fs.promises.stat(filePath)
    if (stat.size < 1000) {
      await fs.promises.unlink(filePath).catch(() => {})
      return
    }
    const handle = await fs.promises.open(filePath, 'r')
    const header = Buffer.alloc(4)
    await handle.read(header, 0, 4, 0)
    await handle.close()
    // 0x04034b50 là Local File Header Signature của chuẩn ZIP/JAR (PK\x03\x04)
    if (header.readUInt32LE(0) !== 0x04034b50) {
      await fs.promises.unlink(filePath).catch(() => {})
    }
  } catch {
    // File không tồn tại hoặc không thể đọc, bỏ qua
  }
}

// ─── Forge & NeoForge Install ─────────────────────────────────────────────────

export async function installForge(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  // loaderVersion format: "47.3.0" hoặc "1.20.1-47.3.0"
  let forgeVersion = loaderVersion
  const mc = mcVersion

  if (loaderVersion.startsWith(mcVersion + '-')) {
    forgeVersion = loaderVersion.substring(mcVersion.length + 1)
  } else if (loaderVersion.includes('-')) {
    const parts = loaderVersion.split('-')
    forgeVersion = parts[parts.length - 1] ?? loaderVersion
  }

  // Đảm bảo metadata và client jar của Minecraft gốc đã tồn tại trước khi chạy installer Forge
  const { ensureVersionMetadata, ensureLibrariesAndAssets } = await import('../launcher/versionResolver')
  await ensureVersionMetadata(mc, gameDir)
  const { Version } = await import('@xmcl/core')
  const baseResolved = await Version.parse(gameDir, mc)
  await ensureLibrariesAndAssets(baseResolved, gameDir)

  const fullForgeVersion = forgeVersion.startsWith(mc) ? forgeVersion : `${mc}-${forgeVersion}`
  const installerJarPath = path.join(
    gameDir,
    'libraries',
    'net',
    'minecraftforge',
    'forge',
    fullForgeVersion,
    `forge-${fullForgeVersion}-installer.jar`
  )

  await cleanupCorruptJar(installerJarPath)

  let attempts = 0
  while (attempts < 2) {
    attempts++
    try {
      const xmcl = await getXmclInstaller()
      const versionName = await xmcl.installForge(
        { mcversion: mc, version: forgeVersion },
        gameDir
      )
      return versionName
    } catch (error) {
      await fs.promises.unlink(installerJarPath).catch(() => {})
      const isZipCorrupt = error instanceof Error && /signature|zip|corrupt|end of central directory|BadForgeInstallerJarError/i.test(error.message)
      if (attempts < 2 && isZipCorrupt) {
        console.warn(`Forge installer jar lỗi (${error.message}). Đang tự động dọn dẹp và thử tải lại...`)
        continue
      }
      console.error('Failed to install Forge:', error)
      throw new Error(`Cài đặt Forge thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  throw new Error('Cài đặt Forge thất bại sau khi thử lại')
}

export async function installNeoForge(_mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  // Đảm bảo metadata và client jar của Minecraft gốc đã tồn tại trước khi chạy installer NeoForge
  const { ensureVersionMetadata, ensureLibrariesAndAssets } = await import('../launcher/versionResolver')
  await ensureVersionMetadata(_mcVersion, gameDir)
  const { Version } = await import('@xmcl/core')
  const baseResolved = await Version.parse(gameDir, _mcVersion)
  await ensureLibrariesAndAssets(baseResolved, gameDir)

  const installerJarPath = path.join(
    gameDir,
    'libraries',
    'net',
    'neoforged',
    'neoforge',
    loaderVersion,
    `neoforge-${loaderVersion}-installer.jar`
  )

  await cleanupCorruptJar(installerJarPath)

  let attempts = 0
  while (attempts < 2) {
    attempts++
    try {
      const xmcl = await getXmclInstaller()
      const versionName = await xmcl.installNeoForged('neoforge', loaderVersion, gameDir, {})
      return versionName
    } catch (error) {
      await fs.promises.unlink(installerJarPath).catch(() => {})
      const isZipCorrupt = error instanceof Error && /signature|zip|corrupt|end of central directory/i.test(error.message)
      if (attempts < 2 && isZipCorrupt) {
        console.warn(`NeoForge installer jar lỗi (${error.message}). Đang tự động dọn dẹp và thử tải lại...`)
        continue
      }
      console.error('Failed to install NeoForge:', error)
      throw new Error(`Cài đặt NeoForge thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  throw new Error('Cài đặt NeoForge thất bại sau khi thử lại')
}

// ─── Fabric ───────────────────────────────────────────────────────────────────

export async function getFabricVersions(): Promise<ModLoaderVersion[]> {
  try {
    const loaders = await (await getXmclInstaller()).getFabricLoaders()
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
    const { ensureVersionMetadata } = await import('../launcher/versionResolver')
    await ensureVersionMetadata(mcVersion, gameDir)
    const versionName = await (await getXmclInstaller()).installFabric({ minecraftVersion: mcVersion, version: loaderVersion, minecraft: gameDir })
    return versionName
  } catch (error) {
    console.error('Failed to install Fabric:', error)
    throw new Error(`Cài đặt Fabric thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ─── Quilt ────────────────────────────────────────────────────────────────────

export async function getQuiltVersions(): Promise<ModLoaderVersion[]> {
  try {
    const loaders = await (await getXmclInstaller()).getQuiltLoaders()
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
    const { ensureVersionMetadata } = await import('../launcher/versionResolver')
    await ensureVersionMetadata(mcVersion, gameDir)
    const versionName = await (await getXmclInstaller()).installQuiltVersion({ minecraftVersion: mcVersion, version: loaderVersion, minecraft: gameDir })
    return versionName
  } catch (error) {
    console.error('Failed to install Quilt:', error)
    throw new Error(`Cài đặt Quilt thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** So sánh 2 MC version strings, ví dụ "1.20.1" vs "1.19.4" */
function compareMcVersions(a: string, b: string): number {
  const partsA = a.split('.').map(p => Number.parseInt(p, 10) || 0)
  const partsB = b.split('.').map(p => Number.parseInt(p, 10) || 0)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

