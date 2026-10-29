import { shell } from 'electron'
import { handleIpc } from './ipcHelper'
import type { GameContentType } from '../../shared/types'
import {
  deleteGameContent,
  disableGameContent,
  enableGameContent,
  importGameContent,
  resolveContentFolderPath,
  scanGameContent,
  scanMods,
  scanResourcePacks,
  scanShaderPacks,
  getModMetadata,
} from '../services/content/gameContentService'
import {
  inspectModDependencies,
  autoFixModDependencies,
} from '../services/content/modDependencyService'
import { modUpdaterService } from '../services/content/modUpdaterService'
import { modConflictService } from '../services/content/modConflictService'
import {
  getFabricVersions,
  getQuiltVersions,
  installFabric,
  installQuilt,
  getForgeVersions,
  getNeoForgeVersions,
  installForge,
  installNeoForge,
} from '../services/content/modLoaderService'

export function registerContentIpc(): void {
  // Game Content Scanning & Toggling
  handleIpc('content:scan', scanGameContent)
  handleIpc('content:scan-mods', (gameDir: string) => scanMods(gameDir))
  handleIpc('content:scan-resourcepacks', (gameDir: string) => scanResourcePacks(gameDir))
  handleIpc('content:scan-shaderpacks', (gameDir: string) => scanShaderPacks(gameDir))
  handleIpc('content:get-mod-metadata', (_gameDir: string, jarPath: string) => getModMetadata(jarPath))
  handleIpc('content:enable', (gameDir: string, itemPath: string) => enableGameContent(itemPath, gameDir))
  handleIpc('content:disable', (gameDir: string, itemPath: string) => disableGameContent(itemPath, gameDir))
  handleIpc('content:delete', (gameDir: string, itemPath: string) => deleteGameContent(gameDir, itemPath))
  handleIpc('content:import', importGameContent)
  handleIpc('content:open-folder', async (gameDir: string, type: GameContentType) => {
    const folderPath = await resolveContentFolderPath(gameDir, type)
    await shell.openPath(folderPath)
    return true
  })

  // Mod Dependency Analyzer & Resolver
  handleIpc('mods:inspect-dependencies', (gameDir: string, mcVersion: string, loader?: string) =>
    inspectModDependencies(gameDir, mcVersion, loader)
  )
  handleIpc('mods:auto-fix-dependencies', (gameDir: string, mcVersion: string, loader?: string) =>
    autoFixModDependencies(gameDir, mcVersion, loader)
  )

  // Mod Loaders
  handleIpc('modloader:get-fabric-versions', getFabricVersions)
  handleIpc('modloader:get-quilt-versions', getQuiltVersions)
  handleIpc('modloader:install-fabric', installFabric)
  handleIpc('modloader:install-quilt', installQuilt)
  handleIpc('modloader:get-forge-versions', getForgeVersions)
  handleIpc('modloader:get-neoforge-versions', getNeoForgeVersions)
  handleIpc('modloader:install-forge', installForge)
  handleIpc('modloader:install-neoforge', installNeoForge)

  // Mod Auto-Updater
  handleIpc('mod-updater:check', (gameDir?: string, mcVersion?: string, loader?: string) =>
    modUpdaterService.checkForModUpdates(gameDir, mcVersion, loader)
  )
  handleIpc('mod-updater:update-single', (gameDir: string | undefined, item: import('../../shared/types').ModUpdateItem) =>
    modUpdaterService.updateSingleMod(gameDir, item)
  )
  handleIpc('mod-updater:update-all', (gameDir: string | undefined, items: import('../../shared/types').ModUpdateItem[]) =>
    modUpdaterService.updateAllMods(gameDir, items)
  )

  // Mod Conflict & Crash Predictor
  handleIpc('mod-conflict:check', (gameDir?: string, mcVersion?: string, loader?: string) =>
    modConflictService.checkModConflicts(gameDir, mcVersion, loader)
  )
  handleIpc(
    'mod-conflict:resolve',
    (gameDir: string | undefined, option: import('../../shared/types').ResolveConflictOption, mcVersion?: string, loader?: string) =>
      modConflictService.resolveConflict(gameDir, option, mcVersion, loader)
  )
  handleIpc(
    'mod-conflict:resolve-all-critical',
    (gameDir: string | undefined, conflicts: import('../../shared/types').ModConflictItem[], mcVersion?: string, loader?: string) =>
      modConflictService.resolveAllCritical(gameDir, conflicts, mcVersion, loader)
  )
}
