import path from 'node:path'
import fs from 'node:fs/promises'
import { writeErrorLog } from '../media/errorLogService'

export interface CrashRecoveryResult {
  disabledModName?: string
  summary: string
  exitCode?: number | null
  reason?: string
  recommendation?: string
  reportFile?: string
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Format human-friendly crash explanation combining exit code, reason, and recommendation.
 */
export function formatCrashSummary(result: CrashRecoveryResult): string {
  const codePart = result.exitCode !== null && result.exitCode !== undefined ? `[Mã thoát ${result.exitCode}] ` : ''
  if (result.disabledModName) {
    return `${codePart}Phát hiện xung đột mod "${result.disabledModName}". ${result.recommendation || 'Đã tạm thời đổi tên thành .disabled. Hãy khởi động lại game.'}`
  }
  return `${codePart}${result.reason || 'Trò chơi bị đóng bất thường'}. Khuyến nghị: ${result.recommendation || 'Kiểm tra tab Nhật ký (Logs) để xem chi tiết.'}`
}

/**
 * Scans crash-reports/, exit codes, and accumulated process logs to identify culprit mods or system crash causes.
 */
export async function diagnoseAndRecoverCrash(
  gameDir: string,
  accumulatedLogs: string[],
  exitCode: number | null = null
): Promise<CrashRecoveryResult> {
  let crashReportContent = ''
  let latestCrashFile: string | undefined
  const crashDir = path.join(gameDir, 'crash-reports')

  if (await pathExists(crashDir)) {
    const crashEntries = await fs.readdir(crashDir).catch(() => [])
    const crashFiles = crashEntries.filter((f) => f.endsWith('.txt') || f.endsWith('.log'))
    if (crashFiles.length > 0) {
      crashFiles.sort()
      latestCrashFile = path.join(crashDir, crashFiles[crashFiles.length - 1])
      const stat = await fs.stat(latestCrashFile).catch(() => null)
      if (stat && Date.now() - stat.mtimeMs < 120000) {
        crashReportContent = await fs.readFile(latestCrashFile, 'utf8').catch(() => '')
      }
    }
  }

  const logCombined = `${accumulatedLogs.join('\n')}\n${crashReportContent}`

  // Regex patterns matching crashing mods
  const patterns = [
    /net\.fabricmc\.loader\.impl\.FormattedException:\s+Mod resolution failed:\s+(?:[^\n]+)\s+Unmet dependency:.*?mod\s+'([^']+)'/i,
    /net\.fabricmc\.loader\.impl\.FormattedException:\s+Could not find required mod:\s+([^\s]+)/i,
    /Caused by:.*?(?:net\.minecraftforge|net\.neoforged|org\.spongepowered|cpw\.mods|net\.fabricmc).*?\(([^)]+\.jar)/i,
    /Duplicate mods found:\s+([^\n]+)/i,
    /Mod\s+([a-zA-Z0-9_\-]+)\s+has failed to load correctly/i,
    /Mixin apply for mod\s+([a-zA-Z0-9_\-]+)\s+failed/i,
    /Critical injection failure.*?in\s+([a-zA-Z0-9_\-]+)\.mixins\.json/i,
    /Caused by: java\.lang\.ClassNotFoundException:.*?(?:mods\.([a-zA-Z0-9_]+)|([a-zA-Z0-9_\-]+)\.jar)/i,
  ]

  let candidateName = ''
  for (const regex of patterns) {
    const match = logCombined.match(regex)
    if (match) {
      candidateName = (match[1] || match[2] || '').trim()
      if (candidateName) break
    }
  }

  let disabledModName: string | undefined
  const modsDir = path.join(gameDir, 'mods')

  if (candidateName && (await pathExists(modsDir))) {
    const cleanCandidate = candidateName.replace(/\.jar$/i, '').toLowerCase()
    const files = await fs.readdir(modsDir).catch(() => [])
    const matchedFile = files.find((f) => {
      if (!f.endsWith('.jar')) return false
      const lower = f.toLowerCase()
      return lower.includes(cleanCandidate) || cleanCandidate.includes(lower.replace(/\.jar$/, ''))
    })

    if (matchedFile) {
      const oldPath = path.join(modsDir, matchedFile)
      const newPath = path.join(modsDir, `${matchedFile}.disabled`)
      await fs.rename(oldPath, newPath).catch(() => null)
      disabledModName = matchedFile
    }
  }

  // Phân tích nguyên nhân dựa trên Exit Code và Logs
  let reason = 'Trò chơi bị đóng bất thường'
  let recommendation = 'Mở tab "Nhật ký" (Logs) và sao chép log gửi cho quản trị viên để được hỗ trợ.'

  // Mã lỗi thoát đặc thù của Windows / JVM / Minecraft
  const normalizedCode = exitCode !== null ? exitCode : null

  if (disabledModName) {
    reason = `Phát hiện mod "${disabledModName}" gây lỗi sập game`
    recommendation = `Launcher đã tự động đổi tên thành "${disabledModName}.disabled" để ngăn sập. Bạn hãy thử khởi động lại game.`
  } else if (normalizedCode === -1073740791 || normalizedCode === 3221225477) {
    // 0xC0000409 - STATUS_STACK_BUFFER_OVERRUN
    reason = 'Lỗi tràn bộ đệm hoặc xung đột Driver GPU (STATUS_STACK_BUFFER_OVERRUN)'
    recommendation = 'Thường do Driver card màn hình xung đột với Shader hoặc mod render (Sodium/Iris). Hãy cập nhật driver GPU và tạm tắt shader pack.'
  } else if (normalizedCode === -1073741819 || normalizedCode === 3221225473) {
    // 0xC0000005 - STATUS_ACCESS_VIOLATION
    reason = 'Lỗi vi phạm truy cập bộ nhớ (STATUS_ACCESS_VIOLATION)'
    recommendation = 'Thường do driver card màn hình crash hoặc lỗi bộ nhớ RAM. Hãy cập nhật driver GPU và kiểm tra lượng RAM cấp phát.'
  } else if (normalizedCode === -805306369 || /OutOfMemoryError|java\.lang\.OutOfMemoryError/i.test(logCombined)) {
    // 0xCFFFFFFF - Out of memory
    reason = 'Trò chơi bị tràn bộ nhớ RAM (Out of Memory)'
    recommendation = 'Vào Cài đặt cấu hình (Profile Settings) và tăng RAM tối đa (Max Memory) lên ít nhất 4096MB - 6144MB.'
  } else if (normalizedCode === -1073741515 || normalizedCode === 3221225781) {
    // 0xC0000135 - STATUS_DLL_NOT_FOUND
    reason = 'Thiếu thư viện DLL hệ thống Windows (STATUS_DLL_NOT_FOUND)'
    recommendation = 'Máy tính của bạn cần cài đặt gói Microsoft Visual C++ Redistributable (2015-2022 x64) mới nhất.'
  } else if (normalizedCode === -1073741571 || normalizedCode === 3221225725) {
    // 0xC000013D - STATUS_CONTROL_C_EXIT
    reason = 'Tiến trình trò chơi bị đóng từ bên ngoài (STATUS_CONTROL_C_EXIT)'
    recommendation = 'Trò chơi đã bị tắt đột ngột qua Task Manager, cửa sổ lệnh hoặc người dùng ép dừng.'
  } else if (normalizedCode === 130 || normalizedCode === 137) {
    reason = 'Tiến trình bị ngắt bởi tín hiệu hệ thống (SIGINT/SIGKILL)'
    recommendation = 'Hệ điều hành đã ép dừng Minecraft (có thể do cạn kiệt RAM hệ thống hoặc tắt cưỡng bức).'
  } else if (normalizedCode === 2) {
    reason = 'Lỗi đối số Java hoặc đường dẫn JVM không hợp lệ'
    recommendation = 'Vào Cài đặt cấu hình, kiểm tra lại đối số JVM tùy chỉnh hoặc đặt lại về cấu hình mặc định (aikar).'
  } else if (/UnsupportedClassVersionError/i.test(logCombined)) {
    reason = 'Phiên bản Java không tương thích với phiên bản Minecraft/Mod'
    recommendation = 'Vào Cài đặt Java để chọn Java tương thích (Java 8 cho <1.17, Java 17 cho 1.18-1.20.4, Java 21 cho 1.20.5+).'
  } else if (/Mod resolution failed|Unmet dependency/i.test(logCombined)) {
    reason = 'Thiếu mod phụ thuộc (Dependencies) hoặc phiên bản mod xung đột'
    recommendation = 'Vào tab Quản lý Mod và bấm "Kiểm tra phụ thuộc" để launcher tự động tải các mod bổ trợ còn thiếu.'
  } else if (/Mixin apply|Critical injection failure/i.test(logCombined)) {
    reason = 'Xung đột Mixin giữa các bản mod can thiệp mã nguồn game'
    recommendation = 'Kiểm tra lại các mod vừa thêm gần đây hoặc mở tab "Nhật ký" để gỡ bỏ mod xung đột.'
  } else if (normalizedCode === 1 || normalizedCode === -1 || normalizedCode === 255) {
    reason = 'Trò chơi gặp sự cố trong quá trình khởi động hoặc chạy mod'
    recommendation = 'Kiểm tra tab Nhật ký (Logs) hoặc crash-reports để xem chi tiết lỗi, hoặc sao chép log gửi hỗ trợ.'
  }

  const result: CrashRecoveryResult = {
    exitCode: normalizedCode,
    disabledModName,
    summary: '',
    reason,
    recommendation,
    reportFile: latestCrashFile,
  }

  result.summary = formatCrashSummary(result)

  await writeErrorLog('CrashDiagnosticService', new Error(result.summary), {
    exitCode: normalizedCode,
    matchedFile: disabledModName,
    reportFile: latestCrashFile,
    logSnippet: logCombined.slice(-2000),
  }).catch(() => null)

  return result
}
