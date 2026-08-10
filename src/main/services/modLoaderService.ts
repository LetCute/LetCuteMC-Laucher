import {
  getFabricLoaders,
  installFabric as xmclInstallFabric,
  getQuiltLoaders,
  installQuiltVersion as xmclInstallQuilt
} from '@xmcl/installer'
import type { ModLoaderVersion } from '../../shared/types'

export async function getFabricVersions(): Promise<ModLoaderVersion[]> {
  try {
    const loaders = await getFabricLoaders()
    return loaders.map(l => ({
      version: l.version,
      stable: l.stable ?? true,
    }))
  } catch (error) {
    console.error('Failed to get Fabric versions:', error)
    return []
  }
}

export async function getQuiltVersions(): Promise<ModLoaderVersion[]> {
  try {
    const loaders = await getQuiltLoaders()
    return loaders.map(l => ({
      version: l.version,
      stable: true, // Quilt doesn't strictly have a stable boolean in the same way, we assume true or parse
    }))
  } catch (error) {
    console.error('Failed to get Quilt versions:', error)
    return []
  }
}

export async function installFabric(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  try {
    const versionName = await xmclInstallFabric({
      minecraftVersion: mcVersion,
      version: loaderVersion,
      minecraft: gameDir,
    })
    return versionName
  } catch (error) {
    console.error('Failed to install Fabric:', error)
    throw new Error(`Cài đặt Fabric thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function installQuilt(mcVersion: string, loaderVersion: string, gameDir: string): Promise<string> {
  try {
    const versionName = await xmclInstallQuilt({
      minecraftVersion: mcVersion,
      version: loaderVersion,
      minecraft: gameDir,
    })
    return versionName
  } catch (error) {
    console.error('Failed to install Quilt:', error)
    throw new Error(`Cài đặt Quilt thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
