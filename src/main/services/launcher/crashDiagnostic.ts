import path from 'node:path'
import fs from 'node:fs/promises'
import { writeErrorLog } from '../media/errorLogService'

export interface CrashRecoveryResult {
  disabledModName?: string
  summary: string
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
 * Scans crash-reports/ and accumulated process logs to identify culprit mods and auto-disable them.
 */
export async function diagnoseAndRecoverCrash(gameDir: string, accumulatedLogs: string[]): Promise<CrashRecoveryResult | null> {
  let crashReportContent = ''
  const crashDir = path.join(gameDir, 'crash-reports')

  if (await pathExists(crashDir)) {
    const crashEntries = await fs.readdir(crashDir).catch(() => [])
    const crashFiles = crashEntries.filter((f) => f.endsWith('.txt') || f.endsWith('.log'))
    if (crashFiles.length > 0) {
      crashFiles.sort()
      const latestCrashFile = path.join(crashDir, crashFiles[crashFiles.length - 1])
      const stat = await fs.stat(latestCrashFile).catch(() => null)
      if (stat && Date.now() - stat.mtimeMs < 60000) {
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

  if (!candidateName) return null

  const modsDir = path.join(gameDir, 'mods')
  if (!await pathExists(modsDir)) return null

  const cleanCandidate = candidateName.replace(/\.jar$/i, '').toLowerCase()
  const files = await fs.readdir(modsDir).catch(() => [])
  const matchedFile = files.find((f) => {
    if (!f.endsWith('.jar')) return false
    const lower = f.toLowerCase()
    return lower.includes(cleanCandidate) || cleanCandidate.includes(lower.replace(/\.jar$/, ''))
  })

  if (!matchedFile) return null

  const oldPath = path.join(modsDir, matchedFile)
  const newPath = path.join(modsDir, `${matchedFile}.disabled`)
  await fs.rename(oldPath, newPath).catch(() => null)

  const summary = `Phát hiện mod có thể gây lỗi: "${matchedFile}". Đã tạm thời đổi tên thành "${matchedFile}.disabled" để ngăn sập game.`
  await writeErrorLog('CrashDiagnosticService', new Error(summary), { matchedFile, logSnippet: logCombined.slice(-2000) }).catch(() => null)

  return {
    disabledModName: matchedFile,
    summary,
  }
}
