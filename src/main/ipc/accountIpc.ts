import { handleIpc } from './ipcHelper'
import {
  getAccountState,
  selectAccount,
  addLocalAccount,
  removeAccount,
  saveMicrosoftAccount,
  refreshMicrosoftAccountToken,
  renameAccountLocally,
  saveLocalSkin,
} from '../services/auth/accountService'
import { loginWithMicrosoft } from '../services/auth/microsoftAuthService'
import {
  fetchMojangProfile,
  uploadMojangSkin,
  changeMojangCape,
  checkMojangNameChange,
  changeMojangName,
} from '../services/auth/mojangApiService'

// ─── LRU Cache for base64 textures (max 50 items, 1 hour TTL) ─────────────────

interface TextureCacheEntry {
  data: string
  timestamp: number
}

const textureCache = new Map<string, TextureCacheEntry>()
const MAX_TEXTURE_CACHE_SIZE = 50
const TEXTURE_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCachedTexture(key: string): string | null {
  const entry = textureCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TEXTURE_CACHE_TTL_MS) {
    textureCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedTexture(key: string, data: string): void {
  // Evict oldest entries if cache exceeds max size
  if (textureCache.size >= MAX_TEXTURE_CACHE_SIZE) {
    const oldestKey = textureCache.keys().next().value
    if (oldestKey) textureCache.delete(oldestKey)
  }
  textureCache.set(key, { data, timestamp: Date.now() })
}

export function registerAccountIpc(): void {
  handleIpc('account:get', getAccountState)
  handleIpc('account:select', (accountId: string) => selectAccount(accountId))
  handleIpc('account:add-local', (username: string) => addLocalAccount(username))
  handleIpc('account:rename-locally', (accountId: string, newName: string) => renameAccountLocally(accountId, newName))
  handleIpc('account:save-local-skin', (accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null) => {
    return saveLocalSkin(accountId, skinUrl, skinModel, capeUrl)
  })
  handleIpc('account:remove', (accountId: string) => removeAccount(accountId))
  handleIpc('account:save-microsoft', (account: any) => saveMicrosoftAccount(account))
  handleIpc('account:login-microsoft', () => loginWithMicrosoft())
  handleIpc('account:refresh-microsoft', (accountId: string) => refreshMicrosoftAccountToken(accountId))

  // Skin and texture utilities
  handleIpc('mojang:fetch-texture', async (url: string) => {
    try {
      if (!url) return null
      if (url.startsWith('data:image')) return url

      let targetUrl = url.trim()
      const nmcSkinMatch = targetUrl.match(/namemc\.com\/skin\/([a-fA-F0-9]+)/i)
      const nmcTexMatch = targetUrl.match(/namemc\.com\/texture\/([a-fA-F0-9]+)/i)
      if (nmcSkinMatch) {
        targetUrl = `https://textures.minecraft.net/texture/${nmcSkinMatch[1]}`
      } else if (nmcTexMatch) {
        targetUrl = `https://textures.minecraft.net/texture/${nmcTexMatch[1]}`
      } else if (/^[a-fA-F0-9]{64}$/.test(targetUrl)) {
        targetUrl = `https://textures.minecraft.net/texture/${targetUrl}`
      }

      if (targetUrl.startsWith('http://textures.minecraft.net')) {
        targetUrl = targetUrl.replace('http://', 'https://')
      }

      // Check in-memory cache first
      const cached = getCachedTexture(targetUrl)
      if (cached) return cached

      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      })
      if (!res.ok) return null
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64Data = `data:image/png;base64,${buffer.toString('base64')}`

      // Store in LRU cache
      setCachedTexture(targetUrl, base64Data)

      return base64Data
    } catch {
      return null
    }
  })

  handleIpc('account:lookup-player-skin', async (query: string) => {
    try {
      if (!query || !query.trim()) return null
      let cleanQuery = query.trim()

      const profMatch = cleanQuery.match(/namemc\.com\/profile\/([a-zA-Z0-9_.-]+)/i)
      if (profMatch) {
        cleanQuery = profMatch[1]
      }

      // 1. Try Mojang Official API
      try {
        const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanQuery)}`, {
          headers: { 'User-Agent': 'LetCuteMC-Launcher' },
        })
        if (profileRes.ok) {
          const profileData = (await profileRes.json()) as { id: string; name: string }
          if (profileData?.id) {
            const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${profileData.id}`, {
              headers: { 'User-Agent': 'LetCuteMC-Launcher' },
            })
            if (sessionRes.ok) {
              const sessionData = (await sessionRes.json()) as any
              const prop = sessionData.properties?.find((p: any) => p.name === 'textures')
              if (prop?.value) {
                const tex = JSON.parse(Buffer.from(prop.value, 'base64').toString())
                const skin = tex?.textures?.SKIN
                const cape = tex?.textures?.CAPE
                if (skin?.url) {
                  return {
                    url: skin.url.replace('http://', 'https://'),
                    model: (skin.metadata?.model === 'slim' ? 'slim' : 'default') as 'slim' | 'default',
                    capeUrl: cape?.url ? cape.url.replace('http://', 'https://') : undefined,
                    username: profileData.name,
                    uuid: profileData.id,
                  }
                }
              }
            }
          }
        }
      } catch {}

      // 2. Fallback: PlayerDB API
      try {
        const playerDbRes = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(cleanQuery)}`, {
          headers: { 'User-Agent': 'LetCuteMC-Launcher' },
        })
        if (playerDbRes.ok) {
          const dbData = (await playerDbRes.json()) as any
          if (dbData?.code === 'player.found' && dbData?.data?.player) {
            const p = dbData.data.player
            if (p.skin_texture) {
              return {
                url: p.skin_texture.replace('http://', 'https://'),
                model: 'default' as 'default',
                username: p.username || cleanQuery,
                uuid: p.id,
              }
            }
          }
        }
      } catch {}

      return null
    } catch {
      return null
    }
  })

  // Mojang API endpoints
  handleIpc('mojang:get-profile', (accessToken: string) => fetchMojangProfile(accessToken))
  handleIpc('mojang:upload-skin', (accessToken: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim') =>
    uploadMojangSkin(accessToken, Buffer.from(fileBuffer), variant)
  )
  handleIpc('mojang:change-cape', (accessToken: string, capeId: string) => changeMojangCape(accessToken, capeId))
  handleIpc('mojang:check-name-change', (accessToken: string) => checkMojangNameChange(accessToken))
  handleIpc('mojang:change-name', (accessToken: string, newName: string) => changeMojangName(accessToken, newName))
}
