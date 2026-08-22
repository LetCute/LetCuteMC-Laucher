import * as fs from 'node:fs'
import * as path from 'node:path'
import * as util from 'node:util'
import * as zlib from 'node:zlib'
import { shell } from 'electron'
import * as nbt from 'prismarine-nbt'
import AdmZip from 'adm-zip'
import type { MinecraftWorld, WorldBackupItem, WorldDifficulty, WorldGameType } from '../../shared/types'
import { detectMinecraftDirectory } from './minecraftDirectoryService'

const parseNbt = (buffer: Buffer | ArrayBuffer) => nbt.parse(buffer)

function getFolderSizeBytes(dirPath: string): number {
  let totalSize = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        totalSize += getFolderSizeBytes(fullPath)
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath)
          totalSize += stat.size
        } catch {}
      }
    }
  } catch {}
  return totalSize
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}

export class WorldService {
  private async resolveGameDir(gameDir?: string): Promise<string> {
    if (gameDir && fs.existsSync(gameDir)) {
      return gameDir
    }
    const detected = await detectMinecraftDirectory()
    return detected.path || ''
  }

  /**
   * Quét toàn bộ thế giới trong thư mục saves
   */
  async scanWorlds(gameDir?: string): Promise<MinecraftWorld[]> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) return []

    const savesDir = path.join(resolvedDir, 'saves')
    if (!fs.existsSync(savesDir)) {
      return []
    }

    const backupsDir = path.join(resolvedDir, 'backups')
    const allBackupFiles = fs.existsSync(backupsDir)
      ? fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip'))
      : []

    const results: MinecraftWorld[] = []

    try {
      const entries = fs.readdirSync(savesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const folderName = entry.name
        const worldPath = path.join(savesDir, folderName)
        const levelDatPath = path.join(worldPath, 'level.dat')

        if (!fs.existsSync(levelDatPath)) continue

        try {
          const buffer = fs.readFileSync(levelDatPath)
          const parsed = (await parseNbt(buffer)) as any
          const simplified = nbt.simplify(parsed)
          const data = simplified.Data || simplified

          if (!data) continue

          const name: string = typeof data.LevelName === 'string' && data.LevelName ? data.LevelName : folderName
          const gameTypeRaw: number = typeof data.GameType === 'number' ? data.GameType : 0
          const isHardcore: boolean = Boolean(data.hardcore)
          const allowCommands: boolean = Boolean(data.allowCommands)

          let gameType: WorldGameType = 'survival'
          if (isHardcore) {
            gameType = 'hardcore'
          } else if (gameTypeRaw === 1) {
            gameType = 'creative'
          } else if (gameTypeRaw === 2) {
            gameType = 'adventure'
          } else if (gameTypeRaw === 3) {
            gameType = 'spectator'
          }

          let difficulty: WorldDifficulty = 'unknown'
          if (typeof data.Difficulty === 'number') {
            switch (data.Difficulty) {
              case 0: difficulty = 'peaceful'; break
              case 1: difficulty = 'easy'; break
              case 2: difficulty = 'normal'; break
              case 3: difficulty = 'hard'; break
            }
          }

          let lastPlayed = Date.now()
          if (typeof data.LastPlayed === 'bigint' || typeof data.LastPlayed === 'number') {
            lastPlayed = Number(data.LastPlayed)
          } else {
            try {
              const stat = fs.statSync(levelDatPath)
              lastPlayed = stat.mtimeMs
            } catch {}
          }

          const versionName = data.Version?.Name || data.Version?.name || data.Bukkit?.version || 'Minecraft'
          const seed = data.WorldGenSettings?.seed?.toString() || data.RandomSeed?.toString() || undefined

          // Read icon.png if present
          let iconBase64: string | null = null
          const iconPath = path.join(worldPath, 'icon.png')
          if (fs.existsSync(iconPath)) {
            try {
              const iconBuf = fs.readFileSync(iconPath)
              iconBase64 = `data:image/png;base64,${iconBuf.toString('base64')}`
            } catch {}
          }

          const sizeBytes = getFolderSizeBytes(worldPath)

          // Count backups for this folder
          const backupCount = allBackupFiles.filter(f => f.startsWith(`${folderName}_`) || f.startsWith(`${folderName}.`)).length

          results.push({
            folderName,
            name,
            gameType,
            gameTypeRaw,
            isHardcore,
            allowCommands,
            difficulty,
            lastPlayed,
            versionName,
            seed,
            sizeBytes,
            iconBase64,
            path: worldPath,
            backupCount,
          })
        } catch (e) {
          console.error(`[WorldService] Error reading level.dat for world ${folderName}:`, e)
        }
      }
    } catch (e) {
      console.error('[WorldService] Error scanning saves directory:', e)
    }

    // Sắp xếp theo thời gian chơi gần nhất
    return results.sort((a, b) => b.lastPlayed - a.lastPlayed)
  }

  /**
   * Tạo bản sao lưu (Backup) dạng tệp ZIP
   */
  async backupWorld(gameDir: string | undefined, folderName: string): Promise<{ success: boolean; backupPath: string; fileName: string; sizeBytes: number; message?: string }> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const worldPath = path.join(resolvedDir, 'saves', folderName)
    if (!fs.existsSync(worldPath)) {
      throw new Error(`Thư mục thế giới "${folderName}" không tồn tại.`)
    }

    const backupsDir = path.join(resolvedDir, 'backups')
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `${sanitizeFolderName(folderName)}_${timestamp}.zip`
    const backupPath = path.join(backupsDir, fileName)

    try {
      const zip = new AdmZip()
      zip.addLocalFolder(worldPath)
      zip.writeZip(backupPath)

      const stat = fs.statSync(backupPath)
      return {
        success: true,
        backupPath,
        fileName,
        sizeBytes: stat.size,
      }
    } catch (e: any) {
      console.error('[WorldService] Error creating world backup:', e)
      throw new Error(`Lỗi khi tạo bản sao lưu: ${e?.message || e}`)
    }
  }

  /**
   * Lấy danh sách các bản backup
   */
  async listWorldBackups(gameDir: string | undefined, folderName?: string): Promise<WorldBackupItem[]> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) return []

    const backupsDir = path.join(resolvedDir, 'backups')
    if (!fs.existsSync(backupsDir)) return []

    try {
      const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip'))
      const backups: WorldBackupItem[] = []

      for (const fileName of files) {
        const filePath = path.join(backupsDir, fileName)
        try {
          const stat = fs.statSync(filePath)
          const targetFolderName = fileName.split('_')[0] || fileName.replace('.zip', '')

          if (folderName && !fileName.startsWith(`${folderName}_`) && !fileName.startsWith(`${folderName}.`)) {
            continue
          }

          backups.push({
            id: fileName,
            worldFolderName: targetFolderName,
            fileName,
            filePath,
            sizeBytes: stat.size,
            createdAt: stat.mtimeMs,
          })
        } catch {}
      }

      return backups.sort((a, b) => b.createdAt - a.createdAt)
    } catch (e) {
      console.error('[WorldService] Error listing backups:', e)
      return []
    }
  }

  /**
   * Khôi phục thế giới từ bản sao lưu
   */
  async restoreWorldBackup(gameDir: string | undefined, backupFilePath: string, targetFolderName?: string): Promise<{ success: boolean; folderName: string }> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')
    if (!fs.existsSync(backupFilePath)) throw new Error('Tệp sao lưu không tồn tại.')

    const fileName = path.basename(backupFilePath)
    const inferredFolder = targetFolderName || fileName.split('_')[0] || 'restored_world'
    const targetFolder = sanitizeFolderName(inferredFolder)
    const targetPath = path.join(resolvedDir, 'saves', targetFolder)

    try {
      const zip = new AdmZip(backupFilePath)

      // Xóa sạch thư mục cũ nếu đã có
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true })
      }
      fs.mkdirSync(targetPath, { recursive: true })

      zip.extractAllTo(targetPath, true)

      return {
        success: true,
        folderName: targetFolder,
      }
    } catch (e: any) {
      console.error('[WorldService] Error restoring backup:', e)
      throw new Error(`Khôi phục thế giới thất bại: ${e?.message || e}`)
    }
  }

  /**
   * Xóa bản sao lưu
   */
  async deleteWorldBackup(backupFilePath: string): Promise<boolean> {
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath)
      return true
    }
    return false
  }

  /**
   * Xuất thế giới ra tệp ZIP
   */
  async exportWorldZip(gameDir: string | undefined, folderName: string, destinationZipPath: string): Promise<boolean> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const worldPath = path.join(resolvedDir, 'saves', folderName)
    if (!fs.existsSync(worldPath)) throw new Error(`Không tìm thấy thư mục thế giới "${folderName}".`)

    try {
      const zip = new AdmZip()
      zip.addLocalFolder(worldPath)
      zip.writeZip(destinationZipPath)
      return true
    } catch (e: any) {
      console.error('[WorldService] Error exporting world zip:', e)
      throw new Error(`Xuất thế giới thất bại: ${e?.message || e}`)
    }
  }

  /**
   * Nhập thế giới từ tệp ZIP
   */
  async importWorldZip(gameDir: string | undefined, sourceZipPath: string): Promise<{ success: boolean; folderName: string; name: string }> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')
    if (!fs.existsSync(sourceZipPath)) throw new Error('Tệp ZIP không tồn tại.')

    const savesDir = path.join(resolvedDir, 'saves')
    if (!fs.existsSync(savesDir)) {
      fs.mkdirSync(savesDir, { recursive: true })
    }

    try {
      const zip = new AdmZip(sourceZipPath)
      const entries = zip.getEntries()

      // Tìm vị trí của level.dat
      const levelDatEntry = entries.find(e => e.entryName === 'level.dat' || e.entryName.endsWith('/level.dat') || e.entryName.endsWith('\\level.dat'))
      if (!levelDatEntry) {
        throw new Error('Tệp ZIP này không phải là bản đồ Minecraft hợp lệ (thiếu level.dat).')
      }

      // Xác định tên thư mục đích
      const zipBaseName = sanitizeFolderName(path.basename(sourceZipPath, path.extname(sourceZipPath)))
      let targetFolderName = zipBaseName
      let counter = 1
      while (fs.existsSync(path.join(savesDir, targetFolderName))) {
        targetFolderName = `${zipBaseName}_${counter}`
        counter++
      }

      const targetPath = path.join(savesDir, targetFolderName)
      fs.mkdirSync(targetPath, { recursive: true })

      // Nếu level.dat nằm ở thư mục con trong zip:
      const levelDatDir = path.dirname(levelDatEntry.entryName)
      if (levelDatDir && levelDatDir !== '.') {
        // Trích xuất các tệp thuộc thư mục con đó
        const prefix = levelDatDir.endsWith('/') || levelDatDir.endsWith('\\') ? levelDatDir : `${levelDatDir}/`
        for (const entry of entries) {
          if (entry.entryName.startsWith(prefix) && !entry.isDirectory) {
            const relPath = entry.entryName.slice(prefix.length)
            const destFilePath = path.join(targetPath, relPath)
            const destFileDir = path.dirname(destFilePath)
            if (!fs.existsSync(destFileDir)) {
              fs.mkdirSync(destFileDir, { recursive: true })
            }
            fs.writeFileSync(destFilePath, entry.getData())
          }
        }
      } else {
        // level.dat ở root của zip
        zip.extractAllTo(targetPath, true)
      }

      // Đọc tên LevelName từ level.dat đã giải nén
      let worldName = targetFolderName
      const extractedLevelDat = path.join(targetPath, 'level.dat')
      if (fs.existsSync(extractedLevelDat)) {
        try {
          const buf = fs.readFileSync(extractedLevelDat)
          const parsed = (await parseNbt(buf)) as any
          const simplified = nbt.simplify(parsed)
          if (simplified?.Data?.LevelName) {
            worldName = simplified.Data.LevelName
          }
        } catch {}
      }

      return {
        success: true,
        folderName: targetFolderName,
        name: worldName,
      }
    } catch (e: any) {
      console.error('[WorldService] Error importing world zip:', e)
      throw new Error(`Nhập thế giới thất bại: ${e?.message || e}`)
    }
  }

  /**
   * Nhân bản thế giới
   */
  async duplicateWorld(gameDir: string | undefined, folderName: string, newWorldName?: string): Promise<{ success: boolean; newFolderName: string }> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const savesDir = path.join(resolvedDir, 'saves')
    const sourcePath = path.join(savesDir, folderName)
    if (!fs.existsSync(sourcePath)) throw new Error('Không tìm thấy thế giới gốc.')

    let newFolderName = `${folderName}_copy`
    let counter = 1
    while (fs.existsSync(path.join(savesDir, newFolderName))) {
      newFolderName = `${folderName}_copy_${counter}`
      counter++
    }

    const destPath = path.join(savesDir, newFolderName)

    try {
      fs.cpSync(sourcePath, destPath, { recursive: true })

      // Cập nhật tên trong level.dat nếu có
      if (newWorldName) {
        await this.renameWorld(gameDir, newFolderName, newWorldName)
      }

      return {
        success: true,
        newFolderName,
      }
    } catch (e: any) {
      console.error('[WorldService] Error duplicating world:', e)
      throw new Error(`Nhân bản thế giới thất bại: ${e?.message || e}`)
    }
  }

  /**
   * Đổi tên thế giới trong level.dat
   */
  async renameWorld(gameDir: string | undefined, folderName: string, newLevelName: string): Promise<boolean> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const levelDatPath = path.join(resolvedDir, 'saves', folderName, 'level.dat')
    if (!fs.existsSync(levelDatPath)) throw new Error('Không tìm thấy tệp level.dat.')

    try {
      const buffer = fs.readFileSync(levelDatPath)
      const parsed = (await parseNbt(buffer)) as any
      const root = parsed.parsed || parsed

      if (root.value && root.value.Data && root.value.Data.value) {
        root.value.Data.value.LevelName = {
          type: 'string',
          value: newLevelName.trim(),
        }
      } else if (root.Data) {
        root.Data.LevelName = newLevelName.trim()
      }

      const uncompressed = nbt.writeUncompressed(root)
      const gzipped = zlib.gzipSync(uncompressed)
      fs.writeFileSync(levelDatPath, gzipped)

      return true
    } catch (e: any) {
      console.error('[WorldService] Error renaming world in level.dat:', e)
      throw new Error(`Đổi tên thế giới thất bại: ${e?.message || e}`)
    }
  }

  /**
   * Xóa thế giới
   */
  async deleteWorld(gameDir: string | undefined, folderName: string): Promise<boolean> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const worldPath = path.join(resolvedDir, 'saves', folderName)
    if (fs.existsSync(worldPath)) {
      fs.rmSync(worldPath, { recursive: true, force: true })
      return true
    }
    return false
  }

  /**
   * Mở thư mục thế giới trong Explorer
   */
  async openWorldFolder(gameDir: string | undefined, folderName?: string): Promise<boolean> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    if (!resolvedDir) return false

    const targetPath = folderName
      ? path.join(resolvedDir, 'saves', folderName)
      : path.join(resolvedDir, 'saves')

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true })
    }

    await shell.openPath(targetPath)
    return true
  }
}

export const worldService = new WorldService()
