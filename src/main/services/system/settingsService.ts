import type { LauncherSettings } from '../../../shared/types'
import {
  getSettingsFilePath,
  ensureLauncherDataDirectory,
  readJsonFile,
  writeJsonFile,
} from './storageService.js'
import {
  resolveEffectivePerformance,
  recommendPerformance,
} from './performanceTunerService.js'
import type { EffectivePerformanceSettings } from '../../../shared/types'
import { getSystemPerformanceInfo } from './systemInfoService.js'

const DEFAULT_SETTINGS: LauncherSettings = {
  minecraftDirectory: '',
  customJavaScanDirs: [],
  defaultMinMemoryMb: 2048,
  defaultMaxMemoryMb: 4096,
  checkJavaOnStartup: true,
  checkVersionsOnStartup: true,
  autoCloseLauncherAfterStart: true,
  enableAutoPrepareGame: true,
  downloadConcurrency: 8,
  manifestCacheTtlMs: 21600000,
  fastLaunchMode: true,
  enableOptimizedJvmArgs: true,
  performanceMode: 'auto',
  enableDiscordRpc: true,
  uiGraphicQuality: 'auto',
}

function migrateSettings(raw: Partial<LauncherSettings> & Record<string, unknown>): LauncherSettings {
  const rec = recommendPerformance()
  const merged: LauncherSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    performanceMode: (raw.performanceMode === 'manual' ? 'manual' : 'auto'),
  }

  if (raw.performanceMode === undefined) {
    merged.defaultMinMemoryMb = rec.recommendedMinRam
    merged.defaultMaxMemoryMb = rec.recommendedMaxRam
    merged.downloadConcurrency = rec.recommendedConcurrency
    merged.performanceMode = 'auto'
  }

  merged.downloadConcurrency = Math.max(1, Math.min(merged.downloadConcurrency, 16))
  return merged
}

export async function getSettings(): Promise<LauncherSettings> {
  const filePath = getSettingsFilePath()
  const raw = await readJsonFile<Partial<LauncherSettings>>(filePath, { ...DEFAULT_SETTINGS })
  const settings = migrateSettings(raw)
  // Always pin to detected/default .minecraft — path not user-editable
  const { getDefaultMinecraftDirectory } = await import('./storageService.js')
  settings.minecraftDirectory = getDefaultMinecraftDirectory()
  return settings
}

export async function updateSettings(
  input: Partial<LauncherSettings>
): Promise<LauncherSettings> {
  await ensureLauncherDataDirectory()
  const current = await getSettings()
  // Ignore any attempt to change minecraftDirectory
  const { minecraftDirectory: _ignored, ...safeInput } = input || {}
  const updated = migrateSettings({ ...current, ...safeInput })
  const { getDefaultMinecraftDirectory } = await import('./storageService.js')
  updated.minecraftDirectory = getDefaultMinecraftDirectory()
  await writeJsonFile(getSettingsFilePath(), updated)
  return updated
}

export async function getEffectivePerformanceSettings(): Promise<EffectivePerformanceSettings> {
  const info = getSystemPerformanceInfo()
  const settings = await getSettings()
  return resolveEffectivePerformance(settings, info)
}

export { DEFAULT_SETTINGS }

