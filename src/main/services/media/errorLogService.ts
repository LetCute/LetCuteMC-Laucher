import fs from 'node:fs/promises'
import path from 'node:path'
import { getLauncherDataDirectory } from '../system/storageService'

export function getErrorLogDirectory(): string {
  return path.join(getLauncherDataDirectory(), 'log_error')
}

function safeName(scope: string): string {
  return scope.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

/** Dump error to ~/.letcutemc/log_error. Returns file path or null. */
export async function writeErrorLog(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>
): Promise<string | null> {
  try {
    const dir = getErrorLogDirectory()
    await fs.mkdir(dir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = path.join(dir, `${ts}_${safeName(scope)}.log`)
    const err = error instanceof Error ? error : new Error(String(error))
    const body = [
      `time: ${new Date().toISOString()}`,
      `scope: ${scope}`,
      `message: ${err.message}`,
      `stack:`,
      err.stack ?? '(no stack)',
      '',
      context ? `context:\n${JSON.stringify(context, null, 2)}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    await fs.writeFile(filePath, body, 'utf8')
    console.error(`[ErrorLog] ${scope} → ${filePath}`)
    return filePath
  } catch (e) {
    console.error('[ErrorLog] write failed:', e)
    return null
  }
}
