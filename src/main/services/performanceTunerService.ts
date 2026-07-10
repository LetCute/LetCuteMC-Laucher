import type {
  AutoPerformanceRecommendation,
  EffectivePerformanceSettings,
  LauncherSettings,
  SystemPerformanceInfo,
} from '../../shared/types'
import { getSystemPerformanceInfo } from './systemInfoService.js'

/** Pure rules: machine → safe defaults. Never Realtime. Auto concurrency ≤ 10. */
export function recommendPerformance(
  info: SystemPerformanceInfo = getSystemPerformanceInfo()
): AutoPerformanceRecommendation {
  if (info.isLowEnd) {
    return {
      recommendedMinRam: 1024,
      recommendedMaxRam: 2048,
      recommendedConcurrency: 4,
      recommendedBoostDurationMs: 30000,
      recommendedBoostPriority: 'above_normal',
      reason: `Máy yếu (${info.totalRamGb}GB RAM, ${info.cpuCores} cores) — ưu tiên ổn định, tránh lag.`,
    }
  }
  if (info.isHighEnd) {
    return {
      recommendedMinRam: 4096,
      recommendedMaxRam: 8192,
      recommendedConcurrency: 10,
      recommendedBoostDurationMs: 45000,
      recommendedBoostPriority: 'high',
      reason: `Máy mạnh (${info.totalRamGb}GB RAM, ${info.cpuCores} cores) — tối ưu tốc độ an toàn.`,
    }
  }
  // mid
  return {
    recommendedMinRam: 2048,
    recommendedMaxRam: 4096,
    recommendedConcurrency: 8,
    recommendedBoostDurationMs: 45000,
    recommendedBoostPriority: 'above_normal',
    reason: `Máy trung bình (${info.totalRamGb}GB RAM, ${info.cpuCores} cores) — cân bằng tốc độ/ổn định.`,
  }
}

/** Resolve settings used at runtime. Auto mode ignores manual knobs. */
export function resolveEffectivePerformance(
  settings: LauncherSettings,
  info: SystemPerformanceInfo = getSystemPerformanceInfo()
): EffectivePerformanceSettings {
  const recommendation = recommendPerformance(info)
  const mode = settings.performanceMode ?? 'auto'

  if (mode === 'auto') {
    // Low-end: skip aggressive auto-prepare to avoid UI lag
    const enableAutoPrepare = !info.isLowEnd && (settings.enableAutoPrepareGame !== false)
    return {
      enableLaunchBoost: true,
      launchBoostDurationMs: recommendation.recommendedBoostDurationMs,
      launchBoostPriority: recommendation.recommendedBoostPriority,
      enableAutoPrepareGame: enableAutoPrepare,
      downloadConcurrency: recommendation.recommendedConcurrency,
      fastLaunchMode: true,
      enableOptimizedJvmArgs: true,
      defaultMinMemoryMb: recommendation.recommendedMinRam,
      defaultMaxMemoryMb: recommendation.recommendedMaxRam,
      performanceMode: 'auto',
      recommendation,
      systemInfo: info,
    }
  }

  // Manual: clamp concurrency ≤ 16, never Realtime (type already excludes it)
  const concurrency = Math.max(1, Math.min(settings.downloadConcurrency ?? 8, 16))
  let priority = settings.launchBoostPriority ?? 'above_normal'
  if (priority !== 'above_normal' && priority !== 'high') priority = 'above_normal'
  // Low-end demote high → above_normal
  if (info.isLowEnd && priority === 'high') priority = 'above_normal'

  return {
    enableLaunchBoost: settings.enableLaunchBoost ?? true,
    launchBoostDurationMs: Math.max(5000, Math.min(settings.launchBoostDurationMs ?? 45000, 120000)),
    launchBoostPriority: priority,
    enableAutoPrepareGame: settings.enableAutoPrepareGame ?? true,
    downloadConcurrency: concurrency,
    fastLaunchMode: settings.fastLaunchMode ?? true,
    enableOptimizedJvmArgs: settings.enableOptimizedJvmArgs ?? true,
    defaultMinMemoryMb: settings.defaultMinMemoryMb ?? recommendation.recommendedMinRam,
    defaultMaxMemoryMb: settings.defaultMaxMemoryMb ?? recommendation.recommendedMaxRam,
    performanceMode: 'manual',
    recommendation,
    systemInfo: info,
  }
}
