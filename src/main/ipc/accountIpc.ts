import { handleIpc } from './ipcHelper'
import type { AccountItem } from '../../shared/types'
import {
  getAccountState,
  selectAccount,
  addLocalAccount,
  removeAccount,
  saveMicrosoftAccount,
  refreshMicrosoftAccountToken,
  renameAccountLocally,
  saveLocalSkin,
  sanitizeAccountState,
  getValidAccessToken,
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
  handleIpc('account:get', async () => sanitizeAccountState(await getAccountState()))
  handleIpc('account:select', async (accountId: string) => sanitizeAccountState(await selectAccount(accountId)))
  handleIpc('account:add-local', async (username: string) => sanitizeAccountState(await addLocalAccount(username)))
  handleIpc('account:rename-locally', async (accountId: string, newName: string) =>
    sanitizeAccountState(await renameAccountLocally(accountId, newName))
  )
  handleIpc(
    'account:save-local-skin',
    async (accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null) => {
      return sanitizeAccountState(await saveLocalSkin(accountId, skinUrl, skinModel, capeUrl))
    }
  )
  handleIpc('account:remove', async (accountId: string) => sanitizeAccountState(await removeAccount(accountId)))
  handleIpc('account:save-microsoft', async (account: AccountItem) =>
    sanitizeAccountState(await saveMicrosoftAccount(account))
  )
  handleIpc('account:login-microsoft', async () => {
    const msAccount = await loginWithMicrosoft()
    const updated = await saveMicrosoftAccount(msAccount)
    return sanitizeAccountState(updated)
  })
  handleIpc('account:refresh-microsoft', async (accountId: string) =>
    sanitizeAccountState(await refreshMicrosoftAccountToken(accountId))
  )

  // Skin and texture utilities
  handleIpc('mojang:fetch-texture', async (url: string) => {
    try {
      if (!url) return null
      if (url.startsWith('data:image')) return url

      let targetUrl = url.trim()
      const nmcSkinMatch = targetUrl.match(/namemc\.com\/skin\/([a-fA-F0-9]+)/i)
      const nmcTexMatch = targetUrl.match(/namemc\.com\/texture\/([a-fA-F0-9]+)/i)
      if (nmcSkinMatch?.[1]) {
        targetUrl = `https://textures.minecraft.net/texture/${nmcSkinMatch[1]}`
      } else if (nmcTexMatch?.[1]) {
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
      if (profMatch?.[1]) {
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
              const sessionData = (await sessionRes.json()) as {
                properties?: Array<{ name: string; value: string }>
              }
              const prop = sessionData.properties?.find((p) => p.name === 'textures')
              if (prop?.value) {
                try {
                  const tex = JSON.parse(Buffer.from(prop.value, 'base64').toString('utf8'))
                  const skin = tex?.textures?.SKIN
                  const cape = tex?.textures?.CAPE
                  if (skin?.url) {
                    return {
                      url: (skin.url as string).replace('http://', 'https://'),
                      model: (skin.metadata?.model === 'slim' ? 'slim' : 'default') as 'slim' | 'default',
                      capeUrl: cape?.url ? (cape.url as string).replace('http://', 'https://') : undefined,
                      username: profileData.name,
                      uuid: profileData.id,
                    }
                  }
                } catch {
                  // ignore corrupt textures payload
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
  async function resolveAccessToken(target: string): Promise<string> {
    if (!target) throw new Error('Missing account identifier or token.')
    const state = await getAccountState()
    const found = state.accounts.find(a => a.id === target)
    if (found) {
      return getValidAccessToken(found.id)
    }
    return target
  }

  handleIpc('mojang:get-profile', async (target: string) => {
    const token = await resolveAccessToken(target)
    return fetchMojangProfile(token)
  })
  handleIpc('mojang:upload-skin', async (target: string, fileBuffer: ArrayBuffer, variant: 'classic' | 'slim') => {
    const token = await resolveAccessToken(target)
    return uploadMojangSkin(token, Buffer.from(fileBuffer), variant)
  })
  handleIpc('mojang:change-cape', async (target: string, capeId: string) => {
    const token = await resolveAccessToken(target)
    return changeMojangCape(token, capeId)
  })
  handleIpc('mojang:check-name-change', async (target: string) => {
    const token = await resolveAccessToken(target)
    return checkMojangNameChange(token)
  })
  handleIpc('mojang:change-name', async (target: string, newName: string) => {
    const token = await resolveAccessToken(target)
    return changeMojangName(token, newName)
  })
}
