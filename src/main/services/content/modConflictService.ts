import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { createWriteStream } from 'node:fs'
// @ts-ignore: semver untyped import
import semver from 'semver'
import type {
  ModConflictItem,
  ModConflictCheckResult,
  ResolveConflictOption,
  ResolveConflictResult,
  ScannedModInfo,
} from '../../../shared/types'
import { parseJarModInfo, extractBaseMinecraftVersion, detectLoaderFromVersion } from './modDependencyService'
import { getDefaultMinecraftDirectory } from '../system/storageService'

const USER_AGENT = 'LetCuteMC-Launcher/1.0 (contact@letcute.com)'

// Helper to normalize modId
function normalizeId(id: string): string {
  return id.trim().toLowerCase().replace(/_/g, '-')
}

/**
 * Check if current Minecraft version satisfies mod dependency range
 */
export function checkMinecraftVersionMatch(currentMc: string, mcConstraint: string | string[]): boolean {
  if (!mcConstraint || mcConstraint === '*' || mcConstraint === '') return true
  const coercedMc = semver.coerce(currentMc)
  if (!coercedMc) return true

  const constraints = Array.isArray(mcConstraint) ? mcConstraint : [mcConstraint]
  for (const c of constraints) {
    if (!c || c === '*' || c === '') return true
    if (c === currentMc || c === coercedMc.version) return true

    // Wildcard like 26.2.x or 1.20.x
    if (c.endsWith('.x') || c.endsWith('.*')) {
      const prefix = c.slice(0, -2)
      if (currentMc.startsWith(prefix) || coercedMc.version.startsWith(prefix)) return true
    }

    // Semver range matching
    try {
      const validRange = semver.validRange(c)
      if (validRange && semver.satisfies(coercedMc, validRange, { includePrerelease: true })) {
        return true
      }
    } catch {}

    // Prefix match for ranges like ~26.2- or >=26.2
    const cleanPrefix = c.replace(/^[~^>=< ]+/, '').replace(/[-+].*$/, '').trim()
    if (cleanPrefix && (currentMc.startsWith(cleanPrefix) || coercedMc.version.startsWith(cleanPrefix))) {
      return true
    }
  }

  return false
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
        return reject(new Error(`HTTP ${res.statusCode}`))
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

// Fetch Modrinth JSON helper
async function fetchModrinthJson<T>(endpoint: string): Promise<T | null> {
  return new Promise((resolve) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.modrinth.com/v2${endpoint}`)
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
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
    req.setTimeout(10000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

export class ModConflictService {
  /**
   * Scan mods directory and run conflict rule checks
   */
  async checkModConflicts(
    gameDir?: string,
    rawMcVersion: string = '1.20.1',
    rawLoader: string = 'fabric'
  ): Promise<ModConflictCheckResult> {
    const targetDir = gameDir || getDefaultMinecraftDirectory()
    const modsDir = path.join(targetDir, 'mods')
    const baseMcVersion = extractBaseMinecraftVersion(rawMcVersion)
    const activeLoader = detectLoaderFromVersion(rawLoader)

    try {
      await fs.access(modsDir)
    } catch {
      return {
        totalMods: 0,
        hasCritical: false,
        criticalCount: 0,
        warningCount: 0,
        suggestionCount: 0,
        conflicts: [],
      }
    }

    const entries = await fs.readdir(modsDir, { withFileTypes: true })
    const jarFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.jar'))

    if (jarFiles.length === 0) {
      return {
        totalMods: 0,
        hasCritical: false,
        criticalCount: 0,
        warningCount: 0,
        suggestionCount: 0,
        conflicts: [],
      }
    }

    // Step 1: Parse all mod metadata
    const parsedMods: Array<ScannedModInfo & { fileName: string; filePath: string }> = []
    const modIdMap = new Map<string, Array<{ fileName: string; filePath: string; version: string }>>()

    for (const jar of jarFiles) {
      const filePath = path.join(modsDir, jar.name)
      const meta = await parseJarModInfo(filePath)
      const modId = meta?.modId ? normalizeId(meta.modId) : normalizeId(path.basename(jar.name, '.jar'))
      const modName = meta?.name || jar.name

      const modInfo = {
        fileName: jar.name,
        filePath,
        loader: meta?.loader || 'unknown',
        modId,
        name: modName,
        version: meta?.version || '1.0.0',
        provides: meta?.provides || [],
        dependencies: meta?.dependencies || [],
      }

      parsedMods.push(modInfo)

      // Track duplicate mod IDs
      const list = modIdMap.get(modId) || []
      list.push({ fileName: jar.name, filePath, version: modInfo.version })
      modIdMap.set(modId, list)
    }

    const installedIds = new Set<string>()
    for (const m of parsedMods) {
      installedIds.add(m.modId)
      for (const p of m.provides) {
        installedIds.add(normalizeId(p))
      }
      // Also check filename patterns
      const lowerName = m.fileName.toLowerCase()
      if (lowerName.includes('optifine')) installedIds.add('optifine')
      if (lowerName.includes('optifabric')) installedIds.add('optifabric')
      if (lowerName.includes('sodium')) installedIds.add('sodium')
      if (lowerName.includes('iris')) installedIds.add('iris')
      if (lowerName.includes('indium')) installedIds.add('indium')
      if (lowerName.includes('rubidium')) installedIds.add('rubidium')
      if (lowerName.includes('embeddium')) installedIds.add('embeddium')
      if (lowerName.includes('oculus')) installedIds.add('oculus')
      if (lowerName.includes('continuity')) installedIds.add('continuity')
      if (lowerName.includes('lambdabettergrass')) installedIds.add('lambdabettergrass')
    }

    const conflicts: ModConflictItem[] = []

    // ── RULE 1: OptiFine vs Modern Performance Stack (Critical) ───────────
    const hasOptiFine = installedIds.has('optifine') || installedIds.has('optifabric')
    const hasSodium = installedIds.has('sodium') || installedIds.has('rubidium') || installedIds.has('embeddium')
    const hasIris = installedIds.has('iris') || installedIds.has('oculus')

    if (hasOptiFine && (hasSodium || hasIris)) {
      const optiMod = parsedMods.find(
        (m) => m.modId.includes('optifine') || m.fileName.toLowerCase().includes('optifine')
      )
      const renderMod = parsedMods.find((m) =>
        ['sodium', 'rubidium', 'embeddium', 'iris', 'oculus'].some(
          (k) => m.modId.includes(k) || m.fileName.toLowerCase().includes(k)
        )
      )

      conflicts.push({
        id: 'conflict-optifine-sodium',
        severity: 'critical',
        type: 'performance_conflict',
        title: 'Xung đột nghiêm trọng: OptiFine và Sodium / Iris',
        description:
          'OptiFine và Sodium là hai hệ thống tối ưu đồ họa hoàn toàn xung khắc nhau. Khi chạy chung, game sẽ bị xung đột mã nguồn render và văng game (crash) 100% lúc khởi động.',
        involvedMods: [
          { fileName: optiMod?.fileName || 'OptiFine', name: 'OptiFine' },
          { fileName: renderMod?.fileName || 'Sodium/Iris', name: renderMod?.name || 'Sodium' },
        ],
        recommendedAction: 'disable_mod',
        actionLabel: 'Tắt OptiFine (Khuyên dùng Sodium + Iris)',
        targetFileName: optiMod?.fileName,
      })
    }

    // ── RULE 2: Sodium + Continuity/CIT without Indium (Critical) ─────────
    const hasContinuity = installedIds.has('continuity') || installedIds.has('lambdabettergrass')
    const hasIndium = installedIds.has('indium')

    if (installedIds.has('sodium') && hasContinuity && !hasIndium && activeLoader === 'fabric') {
      const continuityMod = parsedMods.find(
        (m) => m.modId.includes('continuity') || m.fileName.toLowerCase().includes('continuity')
      )

      conflicts.push({
        id: 'conflict-sodium-continuity-indium',
        severity: 'critical',
        type: 'missing_companion',
        title: 'Thiếu mod bổ trợ Indium: Nguy cơ crash render thế giới',
        description:
          'Continuity yêu cầu Fabric Rendering API (FREX). Do Sodium thay thế pipeline render gốc của Fabric, bạn bắt buộc phải cài thêm mod Indium để Continuity hoạt động mà không bị crash.',
        involvedMods: [
          { fileName: continuityMod?.fileName || 'Continuity', name: 'Continuity' },
          { fileName: 'Sodium', name: 'Sodium' },
        ],
        recommendedAction: 'install_companion',
        actionLabel: 'Tự động tải & cài Indium',
        companionModInfo: {
          modId: 'indium',
          slug: 'indium',
          name: 'Indium (Fabric Rendering Bridge)',
        },
      })
    }

    // ── RULE 3: Duplicate Mod JAR files (Critical) ─────────────────────────
    for (const [modId, files] of modIdMap.entries()) {
      if (files.length > 1 && modId !== 'unknown' && modId.length > 2) {
        conflicts.push({
          id: `conflict-duplicate-${modId}`,
          severity: 'critical',
          type: 'duplicate_mod',
          title: `Phát hiện mod bị trùng lặp tệp: ${files[0].fileName}`,
          description: `Có ${files.length} tệp mod cùng ID '${modId}' trong thư mục mods (${files.map((f) => f.fileName).join(', ')}). Sẽ gây lỗi trùng lặp Mixin và class khi nạp.`,
          involvedMods: files.map((f) => ({ fileName: f.fileName, modId, name: f.fileName })),
          recommendedAction: 'disable_mod',
          actionLabel: `Tắt tệp trùng (${files[1].fileName})`,
          targetFileName: files[1].fileName,
        })
      }
    }

    // ── RULE 4: Cross-Loader Mismatch (Critical) ──────────────────────────
    if (activeLoader === 'fabric' || activeLoader === 'quilt') {
      for (const m of parsedMods) {
        if (m.loader === 'forge' || m.loader === 'neoforge') {
          conflicts.push({
            id: `conflict-loader-${m.modId}`,
            severity: 'critical',
            type: 'loader_mismatch',
            title: `Mod sai Loader: ${m.name} là bản dành cho Forge`,
            description: `Cấu hình game hiện tại sử dụng Loader ${activeLoader.toUpperCase()}, nhưng tệp ${m.fileName} được xây dựng cho Forge/NeoForge. Game sẽ báo lỗi không thể nạp tệp này.`,
            involvedMods: [{ fileName: m.fileName, modId: m.modId, name: m.name }],
            recommendedAction: 'disable_mod',
            actionLabel: `Vô hiệu hóa ${m.fileName}`,
            targetFileName: m.fileName,
          })
        }
      }
    } else if (activeLoader === 'forge' || activeLoader === 'neoforge') {
      for (const m of parsedMods) {
        if (m.loader === 'fabric' && !m.loader.includes('forge')) {
          conflicts.push({
            id: `conflict-loader-${m.modId}`,
            severity: 'critical',
            type: 'loader_mismatch',
            title: `Mod sai Loader: ${m.name} là bản dành cho Fabric`,
            description: `Cấu hình game hiện tại sử dụng Loader ${activeLoader.toUpperCase()}, nhưng tệp ${m.fileName} chỉ chạy trên Fabric. Game sẽ không thể nạp mod này.`,
            involvedMods: [{ fileName: m.fileName, modId: m.modId, name: m.name }],
            recommendedAction: 'disable_mod',
            actionLabel: `Vô hiệu hóa ${m.fileName}`,
            targetFileName: m.fileName,
          })
        }
      }
    }

    // ── RULE 5: Minecraft Version Incompatibility (Critical) ──────────────
    // Check if mod explicitly declares depends.minecraft that does not match active version
    for (const m of parsedMods) {
      const mcDep = m.dependencies?.find((d) => d.modId === 'minecraft')
      if (mcDep && mcDep.versionRange && mcDep.versionRange !== '*' && mcDep.versionRange !== '') {
        const isCompatible = checkMinecraftVersionMatch(baseMcVersion, mcDep.versionRange)
        if (!isCompatible) {
          conflicts.push({
            id: `conflict-mc-version-${m.modId}`,
            severity: 'critical',
            type: 'loader_mismatch',
            title: `Mod không tương thích phiên bản: ${m.name} (${mcDep.versionRange})`,
            description: `Tệp ${m.fileName} yêu cầu Minecraft ${mcDep.versionRange}, nhưng profile hiện tại là ${baseMcVersion}. Giữ mod này sẽ gây lỗi Mixin / crash game khi khởi động.`,
            involvedMods: [{ fileName: m.fileName, modId: m.modId, name: m.name }],
            recommendedAction: 'disable_mod',
            actionLabel: `Vô hiệu hóa ${m.fileName}`,
            targetFileName: m.fileName,
          })
        }
      }
    }

    // ── RULE 5: Duplicate Render Engines (Warning) ────────────────────────
    if (installedIds.has('sodium') && (installedIds.has('rubidium') || installedIds.has('embeddium'))) {
      const extraMod = parsedMods.find((m) =>
        ['rubidium', 'embeddium'].some((k) => m.modId.includes(k) || m.fileName.toLowerCase().includes(k))
      )
      conflicts.push({
        id: 'conflict-multiple-render-engines',
        severity: 'warning',
        type: 'performance_conflict',
        title: 'Cài đặt cùng lúc nhiều engine render: Sodium và Embeddium/Rubidium',
        description: 'Sodium và Embeddium là hai bản fork của nhau. Chỉ nên kích hoạt một mod duy nhất để tránh lãng phí RAM và giảm hiệu năng.',
        involvedMods: [{ fileName: extraMod?.fileName || 'Embeddium', name: 'Embeddium' }],
        recommendedAction: 'disable_mod',
        actionLabel: `Tắt ${extraMod?.fileName || 'Embeddium'}`,
        targetFileName: extraMod?.fileName,
      })
    }

    const criticalCount = conflicts.filter((c) => c.severity === 'critical').length
    const warningCount = conflicts.filter((c) => c.severity === 'warning').length
    const suggestionCount = conflicts.filter((c) => c.severity === 'suggestion').length

    return {
      totalMods: parsedMods.length,
      hasCritical: criticalCount > 0,
      criticalCount,
      warningCount,
      suggestionCount,
      conflicts,
    }
  }

  /**
   * Resolve a specific conflict with recommended action
   */
  async resolveConflict(
    gameDir: string | undefined,
    option: ResolveConflictOption,
    rawMcVersion: string = '1.20.1',
    rawLoader: string = 'fabric'
  ): Promise<ResolveConflictResult> {
    const targetDir = gameDir || getDefaultMinecraftDirectory()
    const modsDir = path.join(targetDir, 'mods')
    const baseMcVersion = extractBaseMinecraftVersion(rawMcVersion)
    const loader = detectLoaderFromVersion(rawLoader) === 'unknown' ? 'fabric' : detectLoaderFromVersion(rawLoader)

    try {
      if (option.action === 'disable_mod' && option.targetFileName) {
        const currentPath = path.join(modsDir, option.targetFileName)
        const disabledPath = `${currentPath}.disabled`
        await fs.rename(currentPath, disabledPath)
        return {
          success: true,
          message: `Đã vô hiệu hóa tệp ${option.targetFileName} thành công.`,
          resolvedConflicts: [option.conflictId],
        }
      }

      if (option.action === 'delete_mod' && option.targetFileName) {
        const currentPath = path.join(modsDir, option.targetFileName)
        await fs.unlink(currentPath)
        return {
          success: true,
          message: `Đã xóa tệp ${option.targetFileName} thành công.`,
          resolvedConflicts: [option.conflictId],
        }
      }

      if (option.action === 'install_companion' && option.companionModSlug) {
        // Query Modrinth for companion mod version strictly matching Minecraft version and Loader
        const gameVersionsQuery = encodeURIComponent(JSON.stringify([baseMcVersion]))
        const loadersQuery = encodeURIComponent(JSON.stringify([loader]))
        const versions = await fetchModrinthJson<any[]>(
          `/project/${option.companionModSlug}/version?game_versions=${gameVersionsQuery}&loaders=${loadersQuery}`
        )

        if (!versions || !Array.isArray(versions) || versions.length === 0) {
          return {
            success: false,
            message: `Không tìm thấy bản phát hành tương thích của mod ${option.companionModSlug} trên Modrinth.`,
            resolvedConflicts: [],
          }
        }

        const compatibleVersions = versions.filter((v: any) => {
          const hasMc = Array.isArray(v.game_versions) && v.game_versions.includes(baseMcVersion)
          const hasLoader = Array.isArray(v.loaders) && v.loaders.includes(loader)
          return hasMc && hasLoader
        })

        if (compatibleVersions.length === 0) {
          return {
            success: false,
            message: `Không tìm thấy bản phát hành của mod ${option.companionModSlug} hỗ trợ chính xác Minecraft ${baseMcVersion} và ${loader}.`,
            resolvedConflicts: [],
          }
        }

        const latestVer = compatibleVersions.find((v: any) => v.version_type === 'release') || compatibleVersions[0]
        const primaryFile = (latestVer.files || []).find((f: any) => f.primary) || latestVer.files?.[0]
        if (!primaryFile?.url) {
          return {
            success: false,
            message: `Không lấy được link tải cho mod ${option.companionModSlug}.`,
            resolvedConflicts: [],
          }
        }

        const fileName = primaryFile.filename || `${option.companionModSlug}.jar`
        const destPath = path.join(modsDir, fileName)
        await downloadFile(primaryFile.url, destPath)

        return {
          success: true,
          message: `Đã tải và cài đặt thành công mod bổ trợ ${fileName}.`,
          resolvedConflicts: [option.conflictId],
        }
      }

      return {
        success: false,
        message: 'Hành động không xác định.',
        resolvedConflicts: [],
      }
    } catch (err: any) {
      console.error('Resolve conflict error:', err)
      return {
        success: false,
        message: err?.message || 'Có lỗi xảy ra khi xử lý xung đột.',
        resolvedConflicts: [],
      }
    }
  }

  /**
   * Auto resolve all critical conflicts
   */
  async resolveAllCritical(
    gameDir: string | undefined,
    conflicts: ModConflictItem[],
    rawMcVersion: string = '1.20.1',
    rawLoader: string = 'fabric'
  ): Promise<ResolveConflictResult> {
    const resolved: string[] = []
    const criticalList = conflicts.filter((c) => c.severity === 'critical')

    for (const c of criticalList) {
      const res = await this.resolveConflict(
        gameDir,
        {
          conflictId: c.id,
          action: c.recommendedAction,
          targetFileName: c.targetFileName,
          companionModSlug: c.companionModInfo?.slug,
        },
        rawMcVersion,
        rawLoader
      )
      if (res.success) {
        resolved.push(c.id)
      }
    }

    return {
      success: resolved.length > 0,
      message: `Đã tự động sửa thành công ${resolved.length}/${criticalList.length} xung đột nghiêm trọng!`,
      resolvedConflicts: resolved,
    }
  }
}

export const modConflictService = new ModConflictService()

