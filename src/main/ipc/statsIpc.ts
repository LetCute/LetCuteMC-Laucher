import { handleIpc } from './ipcHelper'
import { worldService } from '../services/media/worldService'
import { screenshotService } from '../services/media/screenshotService'
import { logService } from '../services/media/logService'
import { statsService } from '../services/media/statsService'
import { lanDiscoveryService } from '../services/media/lanDiscoveryService'

export function registerStatsIpc(): void {
  // LAN Discovery
  handleIpc('lan:start', () => { lanDiscoveryService.start(); return true })
  handleIpc('lan:stop', () => { lanDiscoveryService.stop(); return true })
  handleIpc('lan:get-servers', () => lanDiscoveryService.getDiscoveredServers())

  // Worlds & Saves
  handleIpc('worlds:scan', (gameDir?: string) => worldService.scanWorlds(gameDir))
  handleIpc('worlds:backup', (gameDir: string | undefined, folderName: string) => worldService.backupWorld(gameDir, folderName))
  handleIpc('worlds:list-backups', (gameDir: string | undefined, folderName?: string) => worldService.listWorldBackups(gameDir, folderName))
  handleIpc('worlds:restore-backup', (gameDir: string | undefined, backupFilePath: string, targetFolderName?: string) => worldService.restoreWorldBackup(gameDir, backupFilePath, targetFolderName))
  handleIpc('worlds:delete-backup', (backupFilePath: string) => worldService.deleteWorldBackup(backupFilePath))
  handleIpc('worlds:export-zip', (gameDir: string | undefined, folderName: string, destinationZipPath: string) => worldService.exportWorldZip(gameDir, folderName, destinationZipPath))
  handleIpc('worlds:import-zip', (gameDir: string | undefined, sourceZipPath: string) => worldService.importWorldZip(gameDir, sourceZipPath))
  handleIpc('worlds:duplicate', (gameDir: string | undefined, folderName: string, newWorldName?: string) => worldService.duplicateWorld(gameDir, folderName, newWorldName))
  handleIpc('worlds:rename', (gameDir: string | undefined, folderName: string, newLevelName: string) => worldService.renameWorld(gameDir, folderName, newLevelName))
  handleIpc('worlds:delete', (gameDir: string | undefined, folderName: string) => worldService.deleteWorld(gameDir, folderName))
  handleIpc('worlds:open-folder', (gameDir: string | undefined, folderName?: string) => worldService.openWorldFolder(gameDir, folderName))

  // Screenshots Gallery
  handleIpc('screenshots:scan', (gameDir?: string) => screenshotService.scanScreenshots(gameDir))
  handleIpc('screenshots:copy-clipboard', (filePath: string) => screenshotService.copyScreenshotToClipboard(filePath))
  handleIpc('screenshots:delete', (filePath: string) => screenshotService.deleteScreenshot(filePath))
  handleIpc('screenshots:delete-multiple', (filePaths: string[]) => screenshotService.deleteMultipleScreenshots(filePaths))
  handleIpc('screenshots:show-in-folder', (filePath: string) => screenshotService.showScreenshotInFolder(filePath))
  handleIpc('screenshots:open-folder', (gameDir?: string) => screenshotService.openScreenshotsFolder(gameDir))

  // Logs & Crash Reports
  handleIpc('logs:list-files', (gameDir?: string) => logService.listLogFiles(gameDir))
  handleIpc('logs:read-file', (filePath: string) => logService.readLogFile(filePath))
  handleIpc('logs:upload-mclogs', (content: string) => logService.uploadLogToMclogs(content))
  handleIpc('logs:delete-file', (filePath: string) => logService.deleteLogFile(filePath))
  handleIpc('logs:clear-old', (gameDir?: string) => logService.clearOldLogs(gameDir))
  handleIpc('logs:open-folder', (gameDir: string | undefined, type?: 'logs' | 'crash-reports') => logService.openLogsFolder(gameDir, type))

  // Playtime & In-game Statistics
  handleIpc('stats:get-full-profile', (gameDir: string, profileId: string, profileName?: string) => statsService.getFullProfileStats(gameDir, profileId, profileName))
  handleIpc('stats:record-session', (gameDir: string, profileId: string, durationSeconds: number, exitCode?: number) => statsService.recordPlaySession(gameDir, profileId, durationSeconds, exitCode))
  handleIpc('stats:open-folder', (gameDir: string, worldFolder?: string) => statsService.openStatsFolder(gameDir, worldFolder))
}
