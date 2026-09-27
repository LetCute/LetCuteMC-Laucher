import fs from 'node:fs/promises'
import path from 'node:path'
import { ModConflictService } from './modConflictService'
import { getMinecraftLangCode, applyDefaultGameOptions } from '../system/storageService'

export interface PreLaunchCheckResult {
  ok: boolean
  autoFixedCount: number
  warnings: string[]
  errors: string[]
}

/**
 * Validates profile folder structure and resolves mod conflicts before game launch.
 * - Auto-creates missing core directories (.minecraft, versions, mods, resourcepacks, shaderpacks, config).
 * - Scans and auto-disables duplicate mod JARs (e.g. 2 different Fabric API versions or duplicate mods).
 * - Auto-disables loader-mismatched mod JARs (e.g. Forge JAR in Fabric profile).
 * - Auto-disables conflicting OptiFine + Sodium stacks.
 */
export async function runPreLaunchIntegrityCheck(
  gameDir: string,
  mcVersion: string,
  loader: string,
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
): Promise<PreLaunchCheckResult> {
  const result: PreLaunchCheckResult = {
    ok: true,
    autoFixedCount: 0,
    warnings: [],
    errors: [],
  }

  // 1. Ensure game structure directories exist
  const modsDir = path.join(gameDir, 'mods')
  const coreDirs = [
    gameDir,
    modsDir,
    path.join(gameDir, 'config'),
    path.join(gameDir, 'resourcepacks'),
    path.join(gameDir, 'shaderpacks'),
    path.join(gameDir, 'saves'),
  ]

  for (const dir of coreDirs) {
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch (err) {
      log?.('warn', `[Integrity] Không thể tạo thư mục ${path.basename(dir)}: ${String(err)}`)
    }
  }

  // 1b. Bảo toàn thiết lập người dùng & Dọn dẹp lock file bị kẹt
  try {
    // Tự động sao lưu options.txt và servers.dat (chống mất keybind/cài đặt khi crash)
    const optionsPath = path.join(gameDir, 'options.txt')
    const optionsBak = path.join(gameDir, 'options.txt.bak')
    const serversPath = path.join(gameDir, 'servers.dat')
    const serversBak = path.join(gameDir, 'servers.dat.bak')

    const hasOptions = await fs.stat(optionsPath).then(() => true).catch(() => false)
    const hasOptionsBak = await fs.stat(optionsBak).then(() => true).catch(() => false)

    if (!hasOptions && hasOptionsBak) {
      // Khôi phục options.txt từ bản backup nếu người dùng lỡ tay xóa
      await fs.copyFile(optionsBak, optionsPath).catch(() => {})
      log?.('info', '[Integrity] Đã tự động khôi phục options.txt từ bản sao lưu gần nhất.')
    }

    // Đảm bảo options.txt (và các bản sao lưu / yosbr / defaultoptions) chuẩn tiếng Việt
    await applyDefaultGameOptions(gameDir, mcVersion)

    const hasServers = await fs.stat(serversPath).then(() => true).catch(() => false)
    const hasServersBak = await fs.stat(serversBak).then(() => true).catch(() => false)

    if (hasServers) {
      await fs.copyFile(serversPath, serversBak).catch(() => {})
    } else if (hasServersBak) {
      // Khôi phục servers.dat từ bản backup nếu bị xóa
      await fs.copyFile(serversBak, serversPath).catch(() => {})
      log?.('info', '[Integrity] Đã tự động khôi phục servers.dat từ bản sao lưu gần nhất.')
    }

    // Dọn dẹp tệp rác 0-byte trong mods/ do tải dở
    const modEntries = await fs.readdir(modsDir, { withFileTypes: true }).catch(() => [])
    for (const ent of modEntries) {
      if (ent.isFile() && ent.name.endsWith('.jar')) {
        const p = path.join(modsDir, ent.name)
        const stat = await fs.stat(p).catch(() => null)
        if (stat && stat.size === 0) {
          await fs.unlink(p).catch(() => {})
          log?.('warn', `[Integrity] Đã xóa file mod 0-byte bị hỏng do tải ngắt quãng: ${ent.name}`)
        }
      }
    }
  } catch (err) {
    log?.('warn', `[Integrity] Lỗi bảo toàn thiết lập: ${String(err)}`)
  }

  // 2. Scan and auto-resolve critical mod conflicts
  try {
    const conflictService = new ModConflictService()
    const scan = await conflictService.checkModConflicts(gameDir, mcVersion, loader)

    if (scan.conflicts.length > 0) {
      log?.('info', `[Integrity] Quét thấy ${scan.conflicts.length} vấn đề xung đột mod. Đang tự động xử lý an toàn...`)

      for (const conflict of scan.conflicts) {
        // Auto-fix critical duplicate files, wrong loader, or conflicting optifine
        if (conflict.severity === 'critical' && conflict.targetFileName) {
          const targetPath = path.join(modsDir, conflict.targetFileName)
          const disabledPath = path.join(modsDir, `${conflict.targetFileName}.disabled`)

          try {
            await fs.rename(targetPath, disabledPath)
            result.autoFixedCount++
            const msg = `Đã tự động đổi tên cách ly tệp gây lỗi: ${conflict.targetFileName} -> .disabled (${conflict.title})`
            log?.('info', `[Integrity] ${msg}`)
            result.warnings.push(msg)
          } catch (err) {
            log?.('warn', `[Integrity] Không thể vô hiệu hóa ${conflict.targetFileName}: ${String(err)}`)
          }
        } else if (conflict.severity === 'warning') {
          result.warnings.push(conflict.title)
        }
      }
    }
  } catch (err) {
    log?.('warn', `[Integrity] Bỏ qua quét xung đột: ${String(err)}`)
  }

  return result
}
