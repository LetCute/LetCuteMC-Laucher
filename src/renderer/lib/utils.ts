import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatVersionDisplay(versionStr?: string): string {
  if (!versionStr) return ''
  const str = versionStr.trim()
  const lower = str.toLowerCase()

  // Match loader pattern if present
  const isFabric = lower.includes('fabric')
  const isQuilt = lower.includes('quilt')
  const isNeoForge = lower.includes('neoforge')
  const isForge = lower.includes('forge') && !isNeoForge

  // Extract base Minecraft version (e.g. 1.20.1, 1.21.4, 26.2)
  let baseVer = str
    .replace(/^(?:fabric|quilt|neoforge|forge)-loader-[^-]+-/i, '')
    .replace(/^(\d+(?:\.\d+)+)-(?:fabric|quilt|forge|neoforge).*/i, '$1')

  const matchStandard = baseVer.match(/(?:^|[^0-9])(1\.\d+(?:\.\d+)?)/)
  if (matchStandard) {
    baseVer = matchStandard[1]
  } else {
    const matchGen = baseVer.match(/^(\d+(?:\.\d+)+)/)
    if (matchGen) baseVer = matchGen[1]
  }

  if (isFabric) return `Fabric ${baseVer}`
  if (isQuilt) return `Quilt ${baseVer}`
  if (isNeoForge) return `NeoForge ${baseVer}`
  if (isForge) return `Forge ${baseVer}`
  return baseVer
}
