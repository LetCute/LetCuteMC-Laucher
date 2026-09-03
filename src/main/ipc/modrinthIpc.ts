import { handleIpc } from './ipcHelper'
import {
  searchModrinth,
  getModrinthVersions,
  installModrinthModpack,
  installLocalModrinthModpack,
  getStoreInstallations,
  installModrinthMod,
  uninstallStoreItem,
} from '../services/content/modrinthService'
import { getSettings } from '../services/system/settingsService'
import { getDefaultMinecraftDirectory } from '../services/system/storageService'
import { serverListService } from '../services/media/serverListService'

export function registerModrinthIpc(): void {
  handleIpc('modrinth:search', async ({ query, projectType, offset, gameVersion, loader }: { query: string; projectType: string; offset: number; gameVersion?: string; loader?: string }) => {
    return searchModrinth(query, projectType, offset, gameVersion, loader)
  })

  handleIpc('modrinth:get-versions', async ({ projectId }: { projectId: string }) => {
    return getModrinthVersions(projectId)
  })

  handleIpc('modrinth:install-modpack', async ({ versionId, profileName }: { versionId: string; profileName: string }) => {
    const currentSettings = await getSettings()
    const mcRootDir = currentSettings.minecraftDirectory || getDefaultMinecraftDirectory()
    return await installModrinthModpack(versionId, profileName, mcRootDir)
  })

  handleIpc('modrinth:install-local-modpack', async ({ mrpackPath, profileName }: { mrpackPath: string; profileName: string }) => {
    const currentSettings = await getSettings()
    const mcRootDir = currentSettings.minecraftDirectory || getDefaultMinecraftDirectory()
    return await installLocalModrinthModpack(mrpackPath, profileName, mcRootDir)
  })

  // Store Management
  handleIpc('server-list:get', async ({ page }: { page?: number }) => {
    return serverListService.getTopServers(page)
  })

  handleIpc('server-list:inject', async ({ profileId, page }: { profileId: string; page?: number }) => {
    return serverListService.injectServersToProfile(profileId, page)
  })

  handleIpc('store:get-installations', async (gameDir: string) => {
    return getStoreInstallations(gameDir)
  })

  handleIpc('store:install-mod', async ({ versionId, gameDir }: { versionId: string; gameDir: string }) => {
    await installModrinthMod(versionId, gameDir)
    return true
  })

  handleIpc('store:uninstall-item', async ({ projectId, gameDir }: { projectId: string; gameDir: string }) => {
    return uninstallStoreItem(projectId, gameDir)
  })
}
