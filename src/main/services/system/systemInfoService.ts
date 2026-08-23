import os from 'node:os'
import type { SystemPerformanceInfo } from '../../../shared/types'

export function getSystemPerformanceInfo(): SystemPerformanceInfo {
  const cpuCores = os.cpus().length
  const totalRamGb = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10
  const platform = process.platform

  // Low: < 8GB RAM or ≤ 2 cores
  // Mid: 8–16GB RAM, 4–8 cores
  // High: > 16GB RAM, ≥ 8 cores
  const isLowEnd = totalRamGb < 8 || cpuCores <= 2
  const isHighEnd = totalRamGb > 16 && cpuCores >= 8
  const isMidEnd = !isLowEnd && !isHighEnd

  return { cpuCores, totalRamGb, platform, isLowEnd, isMidEnd, isHighEnd }
}

