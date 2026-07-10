import { useState, useEffect } from 'react'
import { McVersion, fetchMinecraftVersions, downloadAndInstallVersion, GameProfile } from '../utils/minecraftVersions'

export function useMinecraftVersions() {
  const [versions, setVersions] = useState<McVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadVersions = async () => {
      try {
        setLoading(true)
        const data = await fetchMinecraftVersions()
        setVersions(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load versions')
        setVersions([])
      } finally {
        setLoading(false)
      }
    }

    loadVersions()
  }, [])

  return { versions, loading, error }
}

export function useGameProfile() {
  const [profile, setProfile] = useState<GameProfile | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const downloadVersion = async (versionId: string, profileName: string) => {
    setInstalling(true)
    setInstallError(null)
    setProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 30
        })
      }, 500)

      const result = await downloadAndInstallVersion(versionId, (p) => setProgress(p))
      
      clearInterval(progressInterval)

      if (result.success) {
        const newProfile: GameProfile = {
          name: profileName,
          versionId,
          downloadPath: result.path || '',
          status: 'installed',
          progress: 100
        }
        setProfile(newProfile)
        setProgress(100)
      } else {
        setInstallError(result.error || 'Download failed')
        setProgress(0)
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Installation error')
      setProgress(0)
    } finally {
      setInstalling(false)
    }
  }

  return { profile, installing, installError, progress, downloadVersion }
}
