import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { promisify } from 'node:util'
import { shell } from 'electron'
// adm-zip and prismarine-nbt are lazy-loaded to reduce cold-start time
import type { MinecraftWorld, WorldBackupItem, WorldDifficulty, WorldGameType } from '../../../shared/types'
import { resolveGameDir } from '../launcher/minecraftDirectoryService'

const gzipAsync = promisify(zlib.gzip)

async function getNbt() {
  return await import('prismarine-nbt')
}

async function getAdmZip() {
  return (await import('adm-zip')).default
}

const parseNbt = async (buffer: Buffer | ArrayBuffer) => {
  const nbt = await getNbt()
  const res = await nbt.parse(buffer)
  return (res as any)?.parsed || res
}

async function getFolderSizeBytes(dirPath: string): Promise<number> {
  let totalSize = 0
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        totalSize += await getFolderSizeBytes(fullPath)
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath)
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

function assertValidWorldFolderName(folderName: string): string {
  if (!folderName || typeof folderName !== 'string') {
    throw new Error('Tên thư mục thế giới không hợp lệ.')
  }
  const clean = folderName.trim()
  if (!clean || clean === '.' || clean === '..' || clean.includes('..') || clean.includes('/') || clean.includes('\\') || path.isAbsolute(clean)) {
    throw new Error('Tên thư mục thế giới chứa ký tự không hợp lệ.')
  }
  return clean
}

export class WorldService {
  /**
   * Quét toàn bộ thế giới trong thư mục saves (Async)
   */
  async scanWorlds(gameDir?: string): Promise<MinecraftWorld[]> {
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) return []

    const savesDir = path.join(resolvedDir, 'saves')
    if (!existsSync(savesDir)) {
      return []
    }

    const backupsDir = path.join(resolvedDir, 'backups')
    const allBackupFiles = existsSync(backupsDir)
      ? (await fs.readdir(backupsDir)).filter(f => f.endsWith('.zip'))
      : []

    const results: MinecraftWorld[] = []

    try {
      const entries = await fs.readdir(savesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const folderName = entry.name
        const worldPath = path.join(savesDir, folderName)
        const levelDatPath = path.join(worldPath, 'level.dat')

        if (!existsSync(levelDatPath)) continue

        try {
          const buffer = await fs.readFile(levelDatPath)
          const parsed = (await parseNbt(buffer)) as any
          const root = parsed?.parsed || parsed
          const nbtModule = await getNbt()
          const simplified = root ? nbtModule.simplify(root) : null
          const data = simplified?.Data || simplified || {}

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
              const stat = await fs.stat(levelDatPath)
              lastPlayed = stat.mtimeMs
            } catch {}
          }

          const versionName = data.Version?.Name || data.Version?.name || data.Bukkit?.version || 'Minecraft'
          const seed = data.WorldGenSettings?.seed?.toString() || data.RandomSeed?.toString() || undefined

          // Read icon.png if present
          let iconBase64: string | null = null
          const iconPath = path.join(worldPath, 'icon.png')
          if (existsSync(iconPath)) {
            try {
              const iconBuf = await fs.readFile(iconPath)
              iconBase64 = `data:image/png;base64,${iconBuf.toString('base64')}`
            } catch {}
          }

          const sizeBytes = await getFolderSizeBytes(worldPath)

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
    const cleanFolder = assertValidWorldFolderName(folderName)
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const worldPath = path.join(resolvedDir, 'saves', cleanFolder)
    if (!existsSync(worldPath)) {
      throw new Error(`Thư mục thế giới "${cleanFolder}" không tồn tại.`)
    }

    const backupsDir = path.join(resolvedDir, 'backups')
    if (!existsSync(backupsDir)) {
      await fs.mkdir(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `${sanitizeFolderName(cleanFolder)}_${timestamp}.zip`
    const backupPath = path.join(backupsDir, fileName)

    try {
      const AdmZip = await getAdmZip()
      const zip = new AdmZip()
      zip.addLocalFolder(worldPath)
      zip.writeZip(backupPath)

      const stat = await fs.stat(backupPath)
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
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) return []

    const backupsDir = path.join(resolvedDir, 'backups')
    if (!existsSync(backupsDir)) return []

    try {
      const files = (await fs.readdir(backupsDir)).filter(f => f.endsWith('.zip'))
      const backups: WorldBackupItem[] = []

      for (const fileName of files) {
        const filePath = path.join(backupsDir, fileName)
        try {
          const stat = await fs.stat(filePath)
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
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')
    if (!existsSync(backupFilePath)) throw new Error('Tệp sao lưu không tồn tại.')

    const fileName = path.basename(backupFilePath)
    const inferredFolder = targetFolderName || fileName.split('_')[0] || 'restored_world'
    const targetFolder = sanitizeFolderName(inferredFolder)
    const targetPath = path.join(resolvedDir, 'saves', targetFolder)

    try {
      const AdmZip = await getAdmZip()
      const zip = new AdmZip(backupFilePath)

      // Xóa sạch thư mục cũ nếu đã có
      if (existsSync(targetPath)) {
        await fs.rm(targetPath, { recursive: true, force: true })
      }
      await fs.mkdir(targetPath, { recursive: true })

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
    if (!backupFilePath || typeof backupFilePath !== 'string') return false
    const normalized = path.normalize(backupFilePath)
    if (!normalized.toLowerCase().endsWith('.zip') || !normalized.split(path.sep).includes('backups')) {
      throw new Error('Đường dẫn không hợp lệ hoặc không thuộc thư mục backups.')
    }
    if (existsSync(normalized)) {
      await fs.unlink(normalized)
      return true
    }
    return false
  }

  /**
   * Xuất thế giới ra tệp ZIP
   */
  async exportWorldZip(gameDir: string | undefined, folderName: string, destinationZipPath: string): Promise<boolean> {
    const cleanFolder = assertValidWorldFolderName(folderName)
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const worldPath = path.join(resolvedDir, 'saves', cleanFolder)
    if (!existsSync(worldPath)) throw new Error(`Không tìm thấy thư mục thế giới "${cleanFolder}".`)

    try {
      const AdmZip = await getAdmZip()
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
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')
    if (!existsSync(sourceZipPath)) throw new Error('Tệp ZIP không tồn tại.')

    const savesDir = path.join(resolvedDir, 'saves')
    if (!existsSync(savesDir)) {
      await fs.mkdir(savesDir, { recursive: true })
    }

    try {
      const AdmZip = await getAdmZip()
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
      while (existsSync(path.join(savesDir, targetFolderName))) {
        targetFolderName = `${zipBaseName}_${counter}`
        counter++
      }

      const targetPath = path.join(savesDir, targetFolderName)
      await fs.mkdir(targetPath, { recursive: true })

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
            if (!existsSync(destFileDir)) {
              await fs.mkdir(destFileDir, { recursive: true })
            }
            await fs.writeFile(destFilePath, entry.getData())
          }
        }
      } else {
        // level.dat ở root của zip
        zip.extractAllTo(targetPath, true)
      }

      // Đọc tên LevelName từ level.dat đã giải nén
      let worldName = targetFolderName
      const extractedLevelDat = path.join(targetPath, 'level.dat')
      if (existsSync(extractedLevelDat)) {
        try {
          const buf = await fs.readFile(extractedLevelDat)
          const parsed = (await parseNbt(buf)) as any
          const root = parsed?.parsed || parsed
          const nbtModule = await getNbt()
          const simplified = root ? nbtModule.simplify(root) : null
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
    const cleanFolder = assertValidWorldFolderName(folderName)
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const savesDir = path.join(resolvedDir, 'saves')
    const sourcePath = path.join(savesDir, cleanFolder)
    if (!existsSync(sourcePath)) throw new Error('Không tìm thấy thế giới gốc.')

    let newFolderName = `${cleanFolder}_copy`
    let counter = 1
    while (existsSync(path.join(savesDir, newFolderName))) {
      newFolderName = `${cleanFolder}_copy_${counter}`
      counter++
    }

    const destPath = path.join(savesDir, newFolderName)

    try {
      await fs.cp(sourcePath, destPath, { recursive: true })

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
    const cleanFolder = assertValidWorldFolderName(folderName)
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const levelDatPath = path.join(resolvedDir, 'saves', cleanFolder, 'level.dat')
    if (!existsSync(levelDatPath)) throw new Error('Không tìm thấy tệp level.dat.')

    try {
      const buffer = await fs.readFile(levelDatPath)
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

      const nbtModule = await getNbt()
      const uncompressed = nbtModule.writeUncompressed(root)
      const gzipped = await gzipAsync(uncompressed)
      await fs.writeFile(levelDatPath, gzipped)

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
    const cleanFolder = assertValidWorldFolderName(folderName)
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) throw new Error('Không tìm thấy thư mục game.')

    const worldPath = path.join(resolvedDir, 'saves', cleanFolder)
    if (existsSync(worldPath)) {
      await fs.rm(worldPath, { recursive: true, force: true })
      return true
    }
    return false
  }

  /**
   * Mở thư mục thế giới trong Explorer
   */
  async openWorldFolder(gameDir: string | undefined, folderName?: string): Promise<boolean> {
    const resolvedDir = await resolveGameDir(gameDir)
    if (!resolvedDir) return false

    const cleanFolder = folderName ? assertValidWorldFolderName(folderName) : undefined
    const targetPath = cleanFolder
      ? path.join(resolvedDir, 'saves', cleanFolder)
      : path.join(resolvedDir, 'saves')

    if (!existsSync(targetPath)) {
      await fs.mkdir(targetPath, { recursive: true })
    }

    await shell.openPath(targetPath)
    return true
  }
}

export const worldService = new WorldService()

