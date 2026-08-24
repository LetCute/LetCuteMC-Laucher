import fs from 'node:fs/promises'
import path from 'node:path'
import { asyncPool } from '../../utils/asyncPool'
// adm-zip is lazy-loaded to reduce cold-start time
import type {
  ModDependencyInfo,
  ScannedModInfo,
  MissingModDependency,
  ModDependencyScanResult,
  AutoFixDependenciesResult,
} from '../../../shared/types'

async function getAdmZip() {
  return (await import('adm-zip')).default
}

// ─── Constants & Built-in ignored IDs ────────────────────────────────────────

const BUILT_IN_DEPENDENCIES = new Set([
  'minecraft',
  'java',
  'fabricloader',
  'fabric-loader',
  'fabric_loader',
  'quilt_loader',
  'quilt-loader',
  'forge',
  'neoforge',
])

/** Common Mod ID to Modrinth slug mapping */
const MOD_ID_TO_MODRINTH_MAP: Record<string, string> = {
  // Core APIs & Configs
  'fabric': 'fabric-api',
  'fabric-api': 'fabric-api',
  'fabric_api': 'fabric-api',
  'cloth-config': 'cloth-config',
  'cloth_config': 'cloth-config',
  'cloth-config2': 'cloth-config',
  'architectury': 'architectury-api',
  'architectury-api': 'architectury-api',
  'yet_another_config_lib_v3': 'yacl',
  'yet_another_config_lib': 'yacl',
  'yet-another-config-lib': 'yacl',
  'yacl': 'yacl',
  'fzzy_config': 'fzzy-config',
  'fzzy-config': 'fzzy-config',
  'malilib': 'malilib',

  // Fabric / Quilt ecosystem
  'qsl': 'qsl',
  'quilted_fabric_api': 'qsl',
  'quilted-fabric-api': 'qsl',
  'fabric-language-kotlin': 'fabric-language-kotlin',
  'fabric_language_kotlin': 'fabric-language-kotlin',
  'kotlinforforge': 'kotlin-for-forge',
  'modmenu': 'modmenu',

  // Performance & Shaders
  'sodium': 'sodium',
  'rubidium': 'rubidium',
  'embeddium': 'embeddium',
  'indium': 'indium',
  'iris': 'iris',
  'oculus': 'oculus',
  'sodium-extra': 'sodium-extra',
  'reeses-sodium-options': 'reeses-sodium-options',
  'ferritecore': 'ferrite-core',
  'lithium': 'lithium',
  'entityculling': 'entityculling',
  'krypton': 'krypton',
  'immediatelyfast': 'immediatelyfast',
  'modernfix': 'modernfix',
  'spark': 'spark',

  // Item & Recipe Viewers
  'jei': 'jei',
  'rei': 'roughly-enough-items',
  'roughlyenoughitems': 'roughly-enough-items',
  'emi': 'emi',
  'appleskin': 'appleskin',
  'jade': 'jade',
  'wthit': 'wthit',

  // Resource / Animation & Helpers
  'citresewn': 'cit-resewn',
  'cit-resewn': 'cit-resewn',
  'continuity': 'continuity',
  'pehkui': 'pehkui',
  'geckolib': 'geckolib',
  'geckolib3': 'geckolib',
  'curios': 'curios-continuation',
  'curios-continuation': 'curios-continuation',
  'trinkets': 'trinkets',
  'cardinal-components-base': 'cardinal-components-api',
  'cardinal-components': 'cardinal-components-api',
}

// ─── Caches & Concurrency Optimization ───────────────────────────────────────

// ponytail: LRU-bounded caches — evict oldest when exceeding limit
const JAR_CACHE_MAX = 200
const MODRINTH_CACHE_MAX = 200

/** In-memory cache for parsed JAR metadata: key -> { mtimeMs, size, info } */
const jarMetadataCache = new Map<string, { mtimeMs: number; size: number; info: ScannedModInfo | null }>()

/** In-memory cache for Modrinth lookup: key -> { timestamp, data } (TTL: 15 min) */
const modrinthLookupCache = new Map<string, { timestamp: number; data: MissingModDependency['resolvedProject'] | null }>()
const MODRINTH_CACHE_TTL_MS = 15 * 60 * 1000

function lruSet<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number) {
  if (map.has(key)) map.delete(key) // move to end
  map.set(key, value)
  if (map.size > maxSize) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeModId(id: string): string {
  return id.trim().toLowerCase().replace(/_/g, '-')
}

export function extractBaseMinecraftVersion(version: string): string {
  const match = version.match(/1\.\d+(?:\.\d+)?/)
  return match ? match[0] : version
}

export function detectLoaderFromVersion(versionStr: string): 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'unknown' {
  const lower = versionStr.toLowerCase()
  if (lower.includes('fabric')) return 'fabric'
  if (lower.includes('quilt')) return 'quilt'
  if (lower.includes('neoforge')) return 'neoforge'
  if (lower.includes('forge')) return 'forge'
  return 'unknown'
}

// ─── Fast Metadata Parser (With File Caching) ────────────────────────────────

export async function parseJarModInfo(jarPath: string): Promise<ScannedModInfo | null> {
  try {
    const stat = await fs.stat(jarPath).catch(() => null)
    if (!stat) return null

    // Check cache
    const cached = jarMetadataCache.get(jarPath)
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached.info
    }

    const AdmZip = await getAdmZip()
    const zip = new AdmZip(jarPath)

    // 1. Fabric mod (fabric.mod.json) - check fast direct entry first
    const fabricEntry = zip.getEntry('fabric.mod.json')
    if (fabricEntry) {
      const text = zip.readAsText(fabricEntry)
      const json = JSON.parse(text)
      const provides: string[] = []
      if (Array.isArray(json.provides)) {
        for (const p of json.provides) {
          if (typeof p === 'string') provides.push(p)
          else if (p && typeof p.id === 'string') provides.push(p.id)
        }
      }

      const dependencies: ModDependencyInfo[] = []
      if (json.depends && typeof json.depends === 'object') {
        for (const [depId, range] of Object.entries(json.depends)) {
          dependencies.push({
            modId: depId,
            versionRange: typeof range === 'string' ? range : (Array.isArray(range) ? range.join(', ') : undefined),
            optional: false,
          })
        }
      }

      const info: ScannedModInfo = {
        fileName: path.basename(jarPath),
        filePath: jarPath,
        loader: 'fabric',
        modId: json.id || path.basename(jarPath, '.jar'),
        name: json.name || json.id || path.basename(jarPath, '.jar'),
        version: json.version || 'unknown',
        provides,
        dependencies,
      }

      lruSet(jarMetadataCache, jarPath, { mtimeMs: stat.mtimeMs, size: stat.size, info }, JAR_CACHE_MAX)
      return info
    }

    // 2. Quilt mod (quilt.mod.json)
    const quiltEntry = zip.getEntry('quilt.mod.json')
    if (quiltEntry) {
      const text = zip.readAsText(quiltEntry)
      const json = JSON.parse(text)
      const ql = json.quilt_loader || {}
      const provides: string[] = []
      if (Array.isArray(ql.provides)) {
        for (const p of ql.provides) {
          if (typeof p === 'string') provides.push(p)
          else if (p && typeof p.id === 'string') provides.push(p.id)
        }
      }

      const dependencies: ModDependencyInfo[] = []
      if (Array.isArray(ql.depends)) {
        for (const dep of ql.depends) {
          if (typeof dep === 'string') {
            dependencies.push({ modId: dep, optional: false })
          } else if (dep && typeof dep.id === 'string') {
            dependencies.push({
              modId: dep.id,
              versionRange: typeof dep.versions === 'string' ? dep.versions : undefined,
              optional: dep.optional === true,
            })
          }
        }
      }

      const info: ScannedModInfo = {
        fileName: path.basename(jarPath),
        filePath: jarPath,
        loader: 'quilt',
        modId: ql.id || json.id || path.basename(jarPath, '.jar'),
        name: json.name || ql.id || path.basename(jarPath, '.jar'),
        version: ql.version || json.version || 'unknown',
        provides,
        dependencies,
      }

      lruSet(jarMetadataCache, jarPath, { mtimeMs: stat.mtimeMs, size: stat.size, info }, JAR_CACHE_MAX)
      return info
    }

    // 3. Forge / NeoForge mod (META-INF/neoforge.mods.toml or META-INF/mods.toml)
    const tomlEntry = zip.getEntry('META-INF/neoforge.mods.toml') || zip.getEntry('META-INF/mods.toml')
    if (tomlEntry) {
      const text = zip.readAsText(tomlEntry)
      const isNeo = tomlEntry.entryName.includes('neoforge') || /neoforge/i.test(text)

      const modIdMatch = text.match(/modId\s*=\s*["']([^"']+)["']/i)
      const nameMatch = text.match(/displayName\s*=\s*["']([^"']+)["']/i)
      const verMatch = text.match(/version\s*=\s*["']([^"']+)["']/i)

      const dependencies: ModDependencyInfo[] = []
      const depBlocks = text.split(/\[\[dependencies\.[^\]]+\]\]/g)
      for (const block of depBlocks.slice(1)) {
        const depIdMatch = block.match(/modId\s*=\s*["']([^"']+)["']/i)
        const mandatoryMatch = block.match(/mandatory\s*=\s*(true|false)/i)
        const rangeMatch = block.match(/versionRange\s*=\s*["']([^"']+)["']/i)
        if (depIdMatch && depIdMatch[1]) {
          dependencies.push({
            modId: depIdMatch[1],
            versionRange: rangeMatch ? rangeMatch[1] : undefined,
            optional: mandatoryMatch ? mandatoryMatch[1].toLowerCase() === 'false' : false,
          })
        }
      }

      const info: ScannedModInfo = {
        fileName: path.basename(jarPath),
        filePath: jarPath,
        loader: isNeo ? 'neoforge' : 'forge',
        modId: modIdMatch ? modIdMatch[1] : path.basename(jarPath, '.jar'),
        name: nameMatch ? nameMatch[1] : (modIdMatch ? modIdMatch[1] : path.basename(jarPath, '.jar')),
        version: verMatch ? verMatch[1] : 'unknown',
        provides: [],
        dependencies,
      }

      lruSet(jarMetadataCache, jarPath, { mtimeMs: stat.mtimeMs, size: stat.size, info }, JAR_CACHE_MAX)
      return info
    }

    // 4. Legacy mcmod.info
    const mcmodEntry = zip.getEntry('mcmod.info')
    if (mcmodEntry) {
      const text = zip.readAsText(mcmodEntry)
      try {
        const json = JSON.parse(text)
        const item = Array.isArray(json) ? json[0] : (json.modList ? json.modList[0] : json)
        if (item) {
          const dependencies: ModDependencyInfo[] = []
          if (Array.isArray(item.requiredMods)) {
            for (const req of item.requiredMods) {
              if (typeof req === 'string') dependencies.push({ modId: req, optional: false })
            }
          } else if (Array.isArray(item.dependencies)) {
            for (const req of item.dependencies) {
              if (typeof req === 'string') dependencies.push({ modId: req, optional: false })
            }
          }

          const info: ScannedModInfo = {
            fileName: path.basename(jarPath),
            filePath: jarPath,
            loader: 'forge',
            modId: item.modid || path.basename(jarPath, '.jar'),
            name: item.name || item.modid || path.basename(jarPath, '.jar'),
            version: item.version || 'unknown',
            provides: [],
            dependencies,
          }

          lruSet(jarMetadataCache, jarPath, { mtimeMs: stat.mtimeMs, size: stat.size, info }, JAR_CACHE_MAX)
          return info
        }
      } catch {}
    }

    lruSet(jarMetadataCache, jarPath, { mtimeMs: stat.mtimeMs, size: stat.size, info: null }, JAR_CACHE_MAX)
    return null
  } catch {
    return null
  }
}

// ─── Modrinth Version Lookup (With In-Memory TTL Cache) ──────────────────────

export async function resolveMissingDependencyOnModrinth(
  modId: string,
  mcVersion: string,
  loader?: string
): Promise<MissingModDependency['resolvedProject'] | null> {
  const baseMcVer = extractBaseMinecraftVersion(mcVersion)
  const normalizedId = normalizeModId(modId)
  const targetLoader = (loader && loader !== 'unknown') ? loader.toLowerCase() : 'fabric'
  const cacheKey = `${normalizedId}:${baseMcVer}:${targetLoader}`

  // Check cache
  const cached = modrinthLookupCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < MODRINTH_CACHE_TTL_MS) {
    return cached.data
  }

  // Determine potential project slug/ID
  const candidateSlug = MOD_ID_TO_MODRINTH_MAP[normalizedId] || MOD_ID_TO_MODRINTH_MAP[modId] || normalizedId

  try {
    // 1. Try direct project versions lookup by candidate slug
    const versionsUrl = `https://api.modrinth.com/v2/project/${encodeURIComponent(candidateSlug)}/version?game_versions=["${encodeURIComponent(baseMcVer)}"]&loaders=["${encodeURIComponent(targetLoader)}"]`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(versionsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
    }).finally(() => clearTimeout(timeoutId))

    let projectData: any = null
    let versionsData: any[] = []

    if (res.ok) {
      versionsData = (await res.json()) as any[]
      if (Array.isArray(versionsData) && versionsData.length > 0) {
        // Fetch project metadata
        const projRes = await fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(candidateSlug)}`, {
          headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
        })
        if (projRes.ok) {
          projectData = (await projRes.json()) as any
        }
      }
    }

    // 2. Fallback to search if direct lookup returned empty
    if (!projectData || versionsData.length === 0) {
      const searchUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(normalizedId)}&facets=[["project_type:mod"],["versions:${encodeURIComponent(baseMcVer)}"],["categories:${encodeURIComponent(targetLoader)}"]]&limit=3`
      const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' } })
      if (searchRes.ok) {
        const searchJson = (await searchRes.json()) as any
        if (searchJson && searchJson.hits && searchJson.hits.length > 0) {
          const topHit = searchJson.hits[0]
          const hitProjectId = topHit.project_id || topHit.slug

          // Get versions for top hit
          const hitVerUrl = `https://api.modrinth.com/v2/project/${encodeURIComponent(hitProjectId)}/version?game_versions=["${encodeURIComponent(baseMcVer)}"]&loaders=["${encodeURIComponent(targetLoader)}"]`
          const hitVerRes = await fetch(hitVerUrl, { headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' } })
          if (hitVerRes.ok) {
            versionsData = (await hitVerRes.json()) as any[]
            projectData = {
              id: topHit.project_id,
              slug: topHit.slug,
              title: topHit.title,
              icon_url: topHit.icon_url,
              description: topHit.description,
            }
          }
        }
      }
    }

    if (!projectData || !Array.isArray(versionsData) || versionsData.length === 0) {
      lruSet(modrinthLookupCache, cacheKey, { timestamp: Date.now(), data: null }, MODRINTH_CACHE_MAX)
      return null
    }

    // Pick the latest stable/release version or first version
    const selectedVersion = versionsData.find((v: any) => v.version_type === 'release') || versionsData[0]
    const primaryFile = selectedVersion.files?.find((f: any) => f.primary) || selectedVersion.files?.[0]
    if (!primaryFile || !primaryFile.url) {
      lruSet(modrinthLookupCache, cacheKey, { timestamp: Date.now(), data: null }, MODRINTH_CACHE_MAX)
      return null
    }

    const resolved: MissingModDependency['resolvedProject'] = {
      id: projectData.id || projectData.project_id,
      slug: projectData.slug,
      title: projectData.title,
      iconUrl: projectData.icon_url || null,
      description: projectData.description,
      versionId: selectedVersion.id,
      versionNumber: selectedVersion.version_number,
      downloadUrl: primaryFile.url,
      fileName: primaryFile.filename,
      fileSize: primaryFile.size || 0,
    }

    lruSet(modrinthLookupCache, cacheKey, { timestamp: Date.now(), data: resolved }, MODRINTH_CACHE_MAX)
    return resolved
  } catch {
    lruSet(modrinthLookupCache, cacheKey, { timestamp: Date.now(), data: null }, MODRINTH_CACHE_MAX)
    return null
  }
}

// ─── Parallel Inspection Service ─────────────────────────────────────────────

export async function inspectModDependencies(
  gameDir: string,
  mcVersion: string,
  loader?: string
): Promise<ModDependencyScanResult> {
  const modsDir = path.join(gameDir, 'mods')
  try {
    await fs.mkdir(modsDir, { recursive: true })
  } catch {}

  const files = await fs.readdir(modsDir, { withFileTypes: true }).catch(() => [])
  const jarFiles = files.filter(f => f.isFile() && f.name.endsWith('.jar'))

  // 1. Parallel batch parsing with concurrency limit 8
  const parsedResults = await asyncPool(8, jarFiles, async (jar) => {
    const jarPath = path.join(modsDir, jar.name)
    return parseJarModInfo(jarPath)
  })

  const scannedMods: ScannedModInfo[] = []
  const providedSet = new Set<string>()

  for (const info of parsedResults) {
    if (info) {
      scannedMods.push(info)
      providedSet.add(normalizeModId(info.modId))
      providedSet.add(normalizeModId(info.name))
      for (const p of info.provides) {
        providedSet.add(normalizeModId(p))
      }
    }
  }

  // 2. Check for special ecosystem umbrella providers
  const hasFabricApi = providedSet.has('fabric') || providedSet.has('fabric-api') || providedSet.has('fabric_api') || providedSet.has('qsl') || providedSet.has('quilted-fabric-api')
  const hasArchitectury = providedSet.has('architectury') || providedSet.has('architectury-api')
  const hasClothConfig = providedSet.has('cloth-config') || providedSet.has('cloth-config2') || providedSet.has('cloth_config')
  const hasYacl = providedSet.has('yacl') || providedSet.has('yet-another-config-lib') || providedSet.has('yet_another_config_lib_v3')

  // Auto-detect loader if not provided
  let effectiveLoader = loader
  if (!effectiveLoader || effectiveLoader === 'unknown') {
    effectiveLoader = detectLoaderFromVersion(mcVersion)
    if (effectiveLoader === 'unknown' && scannedMods.length > 0) {
      const fabricCount = scannedMods.filter(m => m.loader === 'fabric' || m.loader === 'quilt').length
      const forgeCount = scannedMods.filter(m => m.loader === 'forge' || m.loader === 'neoforge').length
      effectiveLoader = fabricCount >= forgeCount ? 'fabric' : 'forge'
    }
  }

  // Special check: If this is a Fabric/Quilt profile with mods or fabric loader, check if Fabric API is missing
  const needsFabricApi = (effectiveLoader === 'fabric' || effectiveLoader === 'quilt') && !hasFabricApi && scannedMods.length > 0
  const missingMap = new Map<string, MissingModDependency>()

  if (needsFabricApi) {
    missingMap.set('fabric-api', {
      modId: 'fabric-api',
      requiredBy: 'Fabric Ecosystem',
      requiredByFileName: 'mods/',
      versionRange: '*',
      optional: false,
      resolvedProject: null,
    })
  }

  // 3. Scan each mod's dependencies
  for (const mod of scannedMods) {
    for (const dep of mod.dependencies) {
      if (dep.optional) continue // Skip optional dependencies

      const rawId = dep.modId
      const normId = normalizeModId(rawId)

      // Skip built-in runtime IDs
      if (BUILT_IN_DEPENDENCIES.has(normId) || BUILT_IN_DEPENDENCIES.has(rawId.toLowerCase())) {
        continue
      }

      // Check if satisfied by special umbrella providers
      if (hasFabricApi && (normId.startsWith('fabric-') || normId === 'fabric' || normId === 'fabric-api')) {
        continue
      }
      if (hasArchitectury && (normId === 'architectury' || normId === 'architectury-api')) {
        continue
      }
      if (hasClothConfig && (normId === 'cloth-config' || normId === 'cloth-config2' || normId === 'cloth_config')) {
        continue
      }
      if (hasYacl && (normId === 'yacl' || normId.startsWith('yet-another-config-lib'))) {
        continue
      }

      // Check against all provided mod IDs
      if (providedSet.has(normId) || providedSet.has(rawId.toLowerCase())) {
        continue
      }

      // Found a missing dependency!
      if (!missingMap.has(normId)) {
        missingMap.set(normId, {
          modId: rawId,
          requiredBy: `${mod.name} (${mod.version})`,
          requiredByFileName: mod.fileName,
          versionRange: dep.versionRange,
          optional: false,
          resolvedProject: null,
        })
      }
    }
  }

  const missingList = Array.from(missingMap.values())

  // 4. Resolve missing dependencies with Modrinth concurrently
  if (missingList.length > 0) {
    await asyncPool(4, missingList, async (item) => {
      item.resolvedProject = await resolveMissingDependencyOnModrinth(
        item.modId,
        mcVersion,
        effectiveLoader
      )
    })
  }

  return {
    totalMods: scannedMods.length,
    installedModIds: Array.from(providedSet),
    missingDependencies: missingList,
    hasIssues: missingList.length > 0,
  }
}

// ─── Concurrent Auto-Fix Service ─────────────────────────────────────────────

export async function autoFixModDependencies(
  gameDir: string,
  mcVersion: string,
  loader?: string,
  onProgress?: (message: string, current: number, total: number) => void
): Promise<AutoFixDependenciesResult> {
  const modsDir = path.join(gameDir, 'mods')
  await fs.mkdir(modsDir, { recursive: true })

  const downloadedMods: Array<{ title: string; fileName: string }> = []
  const unresolvedMods: string[] = []
  const visitedModIds = new Set<string>()

  let pass = 0
  const maxPasses = 3

  while (pass < maxPasses) {
    pass++
    const scan = await inspectModDependencies(gameDir, mcVersion, loader)
    if (scan.missingDependencies.length === 0) {
      break
    }

    const pending = scan.missingDependencies.filter(d => !visitedModIds.has(normalizeModId(d.modId)))
    if (pending.length === 0) {
      for (const d of scan.missingDependencies) {
        if (!unresolvedMods.includes(d.modId)) {
          unresolvedMods.push(d.modId)
        }
      }
      break
    }

    let completed = 0
    const total = pending.length

    // Download in parallel with concurrency limit of 4
    await asyncPool(4, pending, async (item) => {
      const normId = normalizeModId(item.modId)
      visitedModIds.add(normId)

      if (!item.resolvedProject) {
        unresolvedMods.push(item.modId)
        return
      }

      const proj = item.resolvedProject
      completed++
      if (onProgress) {
        onProgress(`Đang tải: ${proj.title} (${completed}/${total})...`, completed, total)
      }

      try {
        const destPath = path.join(modsDir, proj.fileName)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000)
        const res = await fetch(proj.downloadUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
        }).finally(() => clearTimeout(timeoutId))

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const buffer = Buffer.from(await res.arrayBuffer())
        await fs.writeFile(destPath, buffer)

        downloadedMods.push({ title: proj.title, fileName: proj.fileName })
      } catch {
        unresolvedMods.push(item.modId)
      }
    })
  }

  const success = unresolvedMods.length === 0
  let message = `Đã tự động tải thành công ${downloadedMods.length} mod phụ thuộc.`
  if (downloadedMods.length === 0 && unresolvedMods.length === 0) {
    message = 'Tất cả các mod phụ thuộc đều đã đầy đủ.'
  } else if (unresolvedMods.length > 0) {
    message = `Đã tải ${downloadedMods.length} mod. Còn ${unresolvedMods.length} mod không tìm thấy trên Modrinth (${unresolvedMods.join(', ')}).`
  }

  return {
    success,
    fixedCount: downloadedMods.length,
    downloadedMods,
    unresolvedMods,
    message,
  }
}

