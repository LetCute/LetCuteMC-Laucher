export interface McVersion {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
}

export interface GameProfile {
  name: string
  versionId: string
  downloadPath: string
  status: 'pending' | 'downloading' | 'installed' | 'error'
  progress?: number
  error?: string
}

let versionCache: McVersion[] | null = null

export async function fetchMinecraftVersions(): Promise<McVersion[]> {
  if (versionCache) {
    return versionCache
  }
  return []
}

export async function downloadAndInstallVersion(
  versionId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // Simulate download with progress updates
    return new Promise((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 20
        if (progress > 100) progress = 100
        
        onProgress?.(progress)
        
        if (progress >= 100) {
          clearInterval(interval)
          const versionPath = `AppData\\Roaming\\LetCuteMC\\versions\\${versionId}`
          resolve({ 
            success: true, 
            path: versionPath 
          })
        }
      }, 300)
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function getVersionsForCreate(): Promise<McVersion[]> {
  const versions = await fetchMinecraftVersions()
  return versions.filter(v => v.type === 'release' || v.type === 'snapshot')
}


