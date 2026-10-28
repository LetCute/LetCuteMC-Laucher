import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { promisify } from 'node:util'
import { shell } from 'electron'
import type { LogFileInfo, MclogsUploadResult } from '../../../shared/types'
import { resolveGameDir } from '../launcher/minecraftDirectoryService'

const gunzipAsync = promisify(zlib.gunzip)

export class LogService {
  /**
   * Liệt kê các tệp log và crash reports (Async)
   */
  async listLogFiles(gameDir?: string): Promise<{ activeLogs: LogFileInfo[]; crashReports: LogFileInfo[] }> {
    const resolvedDir = await resolveGameDir(gameDir)
    const activeLogs: LogFileInfo[] = []
    const crashReports: LogFileInfo[] = []

    if (!resolvedDir) {
      return { activeLogs, crashReports }
    }

    // 1. Quét thư mục logs/
    const logsDir = path.join(resolvedDir, 'logs')
    if (existsSync(logsDir)) {
      try {
        const entries = await fs.readdir(logsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const fileName = entry.name
          const filePath = path.join(logsDir, fileName)
          const isGz = fileName.endsWith('.gz')
          const isLog = fileName.endsWith('.log') || isGz

          if (isLog) {
            try {
              const stat = await fs.stat(filePath)
              activeLogs.push({
                id: fileName,
                fileName,
                filePath,
                sizeBytes: stat.size,
                createdAt: stat.mtimeMs,
                isCrashReport: false,
                isCompressed: isGz,
              })
            } catch (err) {
              console.error(`[LogService] Stat error for ${fileName}:`, err)
            }
          }
        }
      } catch (err) {
        console.error('[LogService] Error reading logs dir:', err)
      }
    }

    // 2. Quét thư mục crash-reports/
    const crashDir = path.join(resolvedDir, 'crash-reports')
    if (existsSync(crashDir)) {
      try {
        const entries = await fs.readdir(crashDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const fileName = entry.name
          if (fileName.endsWith('.txt') || fileName.endsWith('.log')) {
            const filePath = path.join(crashDir, fileName)
            try {
              const stat = await fs.stat(filePath)
              crashReports.push({
                id: fileName,
                fileName,
                filePath,
                sizeBytes: stat.size,
                createdAt: stat.mtimeMs,
                isCrashReport: true,
                isCompressed: false,
              })
            } catch (err) {
              console.error(`[LogService] Stat error for ${fileName}:`, err)
            }
          }
        }
      } catch (err) {
        console.error('[LogService] Error reading crash-reports dir:', err)
      }
    }

    // Sắp xếp theo ngày tạo mới nhất
    activeLogs.sort((a, b) => {
      // Ưu tiên latest.log lên đầu
      if (a.fileName === 'latest.log') return -1
      if (b.fileName === 'latest.log') return 1
      return b.createdAt - a.createdAt
    })

    crashReports.sort((a, b) => b.createdAt - a.createdAt)

    return { activeLogs, crashReports }
  }

  /**
   * Đọc nội dung file log hoặc crash report (tự động giải nén .gz nếu cần, non-blocking)
   */
  async readLogFile(filePath: string): Promise<string> {
    if (!this.isSafeLogPath(filePath)) {
      throw new Error('Tệp không hợp lệ hoặc không thuộc thư mục logs/crash-reports.')
    }
    if (!existsSync(filePath)) {
      throw new Error(`Tệp log không tồn tại: ${filePath}`)
    }

    try {
      if (filePath.endsWith('.gz')) {
        const buffer = await fs.readFile(filePath)
        const uncompressed = await gunzipAsync(buffer)
        return uncompressed.toString('utf-8')
      } else {
        return await fs.readFile(filePath, 'utf-8')
      }
    } catch (err) {
      console.error('[LogService] Error reading log file:', err)
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Không thể đọc file: ${message}`)
    }
  }

  /**
   * Tải log lên mclo.gs và nhận link chia sẻ
   */
  async uploadLogToMclogs(content: string): Promise<MclogsUploadResult> {
    if (!content || !content.trim()) {
      return { success: false, error: 'Nội dung log trống' }
    }

    try {
      const params = new URLSearchParams()
      params.append('content', content)

      const response = await fetch('https://api.mclo.gs/1/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const data: any = await response.json()
      if (data && data.success) {
        return {
          success: true,
          url: data.url,
          id: data.id,
          raw: data.raw,
        }
      } else {
        return {
          success: false,
          error: data?.error || 'Dịch vụ mclo.gs từ chối tải lên',
        }
      }
    } catch (err) {
      console.error('[LogService] Error uploading to mclo.gs:', err)
      const message = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: `Không thể kết nối đến mclo.gs: ${message}`,
      }
    }
  }

  private isSafeLogPath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false
    const lower = filePath.toLowerCase()
    const validExt = lower.endsWith('.log') || lower.endsWith('.log.gz') || lower.endsWith('.txt')
    if (!validExt) return false
    const normalized = path.normalize(path.resolve(filePath))
    const parts = normalized.split(path.sep).map(p => p.toLowerCase())
    const logsIdx = parts.lastIndexOf('logs')
    const crashIdx = parts.lastIndexOf('crash-reports')
    const idx = Math.max(logsIdx, crashIdx)
    return idx > 0 && parts.length === idx + 2
  }

  /**
   * Xóa một file log hoặc crash report
   */
  async deleteLogFile(filePath: string): Promise<boolean> {
    if (!this.isSafeLogPath(filePath)) {
      throw new Error('Tệp không hợp lệ hoặc không thuộc thư mục logs/crash-reports.')
    }
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath)
        return true
      }
      return false
    } catch (err) {
      console.error('[LogService] Error deleting log file:', err)
      return false
    }
  }

  /**
   * Dọn dẹp các tệp log cũ (.log.gz)
   */
  async clearOldLogs(gameDir?: string): Promise<{ success: boolean; count: number; freedBytes: number }> {
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) return { success: false, count: 0, freedBytes: 0 }

    const logsDir = path.join(resolvedDir, 'logs')
    if (!existsSync(logsDir)) return { success: true, count: 0, freedBytes: 0 }

    let count = 0
    let freedBytes = 0

    try {
      const entries = await fs.readdir(logsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (entry.name.endsWith('.gz')) {
          const filePath = path.join(logsDir, entry.name)
          try {
            const stat = await fs.stat(filePath)
            freedBytes += stat.size
            await fs.unlink(filePath)
            count++
          } catch (err) {
            console.error(`[LogService] Error deleting old log ${entry.name}:`, err)
          }
        }
      }
      return { success: true, count, freedBytes }
    } catch (err) {
      console.error('[LogService] Error clearing old logs:', err)
      return { success: false, count, freedBytes }
    }
  }

  /**
   * Mở thư mục logs hoặc crash-reports trong Windows File Explorer
   */
  async openLogsFolder(gameDir?: string, type: 'logs' | 'crash-reports' = 'logs'): Promise<boolean> {
    try {
      const resolvedDir = await resolveGameDir(gameDir)
      if (!resolvedDir) return false

      const targetDir = path.join(resolvedDir, type)
      if (!existsSync(targetDir)) {
        await fs.mkdir(targetDir, { recursive: true })
      }

      await shell.openPath(targetDir)
      return true
    } catch (err) {
      console.error('[LogService] Error opening logs folder:', err)
      return false
    }
  }
}

export const logService = new LogService()

