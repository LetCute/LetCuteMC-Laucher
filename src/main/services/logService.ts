import * as fs from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { shell } from 'electron'
import type { LogFileInfo, MclogsUploadResult } from '../../shared/types'
import { detectMinecraftDirectory } from './minecraftDirectoryService'

export class LogService {
  private async resolveGameDir(gameDir?: string): Promise<string> {
    if (gameDir && fs.existsSync(gameDir)) {
      return gameDir
    }
    const detected = await detectMinecraftDirectory()
    return detected.path || ''
  }

  /**
   * Liệt kê các tệp log và crash reports
   */
  async listLogFiles(gameDir?: string): Promise<{ activeLogs: LogFileInfo[]; crashReports: LogFileInfo[] }> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    const activeLogs: LogFileInfo[] = []
    const crashReports: LogFileInfo[] = []

    if (!resolvedDir) {
      return { activeLogs, crashReports }
    }

    // 1. Quét thư mục logs/
    const logsDir = path.join(resolvedDir, 'logs')
    if (fs.existsSync(logsDir)) {
      try {
        const entries = fs.readdirSync(logsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const fileName = entry.name
          const filePath = path.join(logsDir, fileName)
          const isGz = fileName.endsWith('.gz')
          const isLog = fileName.endsWith('.log') || isGz

          if (isLog) {
            try {
              const stat = fs.statSync(filePath)
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
    if (fs.existsSync(crashDir)) {
      try {
        const entries = fs.readdirSync(crashDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const fileName = entry.name
          if (fileName.endsWith('.txt') || fileName.endsWith('.log')) {
            const filePath = path.join(crashDir, fileName)
            try {
              const stat = fs.statSync(filePath)
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
   * Đọc nội dung file log hoặc crash report (tự động giải nén .gz nếu cần)
   */
  async readLogFile(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Tệp log không tồn tại: ${filePath}`)
    }

    try {
      if (filePath.endsWith('.gz')) {
        const buffer = fs.readFileSync(filePath)
        const uncompressed = zlib.gunzipSync(buffer)
        return uncompressed.toString('utf-8')
      } else {
        return fs.readFileSync(filePath, 'utf-8')
      }
    } catch (err: any) {
      console.error('[LogService] Error reading log file:', err)
      throw new Error(`Không thể đọc file: ${err?.message || err}`)
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
    } catch (err: any) {
      console.error('[LogService] Error uploading to mclo.gs:', err)
      return {
        success: false,
        error: `Không thể kết nối đến mclo.gs: ${err?.message || err}`,
      }
    }
  }

  /**
   * Xóa một file log hoặc crash report
   */
  async deleteLogFile(filePath: string): Promise<boolean> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
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
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) return { success: false, count: 0, freedBytes: 0 }

    const logsDir = path.join(resolvedDir, 'logs')
    if (!fs.existsSync(logsDir)) return { success: true, count: 0, freedBytes: 0 }

    let count = 0
    let freedBytes = 0

    try {
      const entries = fs.readdirSync(logsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (entry.name.endsWith('.gz')) {
          const filePath = path.join(logsDir, entry.name)
          try {
            const stat = fs.statSync(filePath)
            freedBytes += stat.size
            fs.unlinkSync(filePath)
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
      const resolvedDir = await this.resolveGameDir(gameDir)
      if (!resolvedDir) return false

      const targetDir = path.join(resolvedDir, type)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
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
