import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { clipboard, nativeImage, shell } from 'electron'
import type { MinecraftScreenshot } from '../../../shared/types'
import { resolveGameDir } from '../launcher/minecraftDirectoryService'

export class ScreenshotService {
  /**
   * Quét toàn bộ ảnh chụp màn hình trong thư mục screenshots (Non-blocking async)
   */
  async scanScreenshots(gameDir?: string): Promise<MinecraftScreenshot[]> {
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) return []

    const screenshotsDir = path.join(resolvedDir, 'screenshots')
    if (!existsSync(screenshotsDir)) {
      return []
    }

    const results: MinecraftScreenshot[] = []
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.webp']

    try {
      const entries = await fs.readdir(screenshotsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile()) continue

        const ext = path.extname(entry.name).toLowerCase()
        if (!supportedExtensions.includes(ext)) continue

        const filePath = path.join(screenshotsDir, entry.name)

        try {
          const stat = await fs.stat(filePath)
          const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
          const buffer = await fs.readFile(filePath)
          const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

          results.push({
            id: entry.name,
            fileName: entry.name,
            filePath,
            sizeBytes: stat.size,
            createdAt: stat.mtimeMs,
            dataUrl,
          })
        } catch (err) {
          console.error(`[ScreenshotService] Error reading screenshot ${entry.name}:`, err)
        }
      }
    } catch (e) {
      console.error('[ScreenshotService] Error scanning screenshots directory:', e)
    }

    // Sắp xếp theo ngày chụp mới nhất
    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Sao chép hình ảnh trực tiếp vào Clipboard hệ thống
   */
  async copyScreenshotToClipboard(filePath: string): Promise<boolean> {
    try {
      if (!existsSync(filePath)) return false
      const img = nativeImage.createFromPath(filePath)
      if (img.isEmpty()) {
        const buffer = await fs.readFile(filePath)
        const imgFromBuf = nativeImage.createFromBuffer(buffer)
        clipboard.writeImage(imgFromBuf)
      } else {
        clipboard.writeImage(img)
      }
      return true
    } catch (e) {
      console.error('[ScreenshotService] Error copying screenshot to clipboard:', e)
      return false
    }
  }

  private isSafeScreenshotPath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false
    const ext = path.extname(filePath).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return false
    const parts = path.normalize(filePath).split(path.sep)
    return parts.includes('screenshots')
  }

  /**
   * Xóa một tệp ảnh chụp màn hình
   */
  async deleteScreenshot(filePath: string): Promise<boolean> {
    if (!this.isSafeScreenshotPath(filePath)) {
      throw new Error('Tệp không hợp lệ hoặc không thuộc thư mục screenshots.')
    }
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath)
        return true
      }
      return false
    } catch (e) {
      console.error('[ScreenshotService] Error deleting screenshot:', e)
      return false
    }
  }

  /**
   * Xóa hàng loạt tệp ảnh chụp màn hình
   */
  async deleteMultipleScreenshots(filePaths: string[]): Promise<boolean> {
    if (!Array.isArray(filePaths)) return false
    try {
      await Promise.all(
        filePaths
          .filter(fp => this.isSafeScreenshotPath(fp))
          .map(async (filePath) => {
            if (existsSync(filePath)) {
              await fs.unlink(filePath).catch(() => {})
            }
          })
      )
      return true
    } catch (e) {
      console.error('[ScreenshotService] Error deleting multiple screenshots:', e)
      return false
    }
  }

  /**
   * Mở File Explorer và chọn tệp ảnh
   */
  async showScreenshotInFolder(filePath: string): Promise<boolean> {
    try {
      if (existsSync(filePath)) {
        shell.showItemInFolder(filePath)
        return true
      }
      return false
    } catch (e) {
      console.error('[ScreenshotService] Error showing screenshot in folder:', e)
      return false
    }
  }

  /**
   * Mở thư mục screenshots
   */
  async openScreenshotsFolder(gameDir?: string): Promise<boolean> {
    try {
      const resolvedDir = await resolveGameDir(gameDir)
      if (!resolvedDir) return false

      const screenshotsDir = path.join(resolvedDir, 'screenshots')
      if (!existsSync(screenshotsDir)) {
        await fs.mkdir(screenshotsDir, { recursive: true })
      }

      await shell.openPath(screenshotsDir)
      return true
    } catch (e) {
      console.error('[ScreenshotService] Error opening screenshots folder:', e)
      return false
    }
  }
}

export const screenshotService = new ScreenshotService()

