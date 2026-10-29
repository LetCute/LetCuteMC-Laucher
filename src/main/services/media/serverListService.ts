import * as fs from 'fs'
import * as path from 'path'
// cheerio and prismarine-nbt are lazy-loaded to reduce cold-start time
import { MinecraftServer } from '../../../shared/types'
import { detectMinecraftDirectory } from '../launcher/minecraftDirectoryService'

let cheerioModule: typeof import('cheerio') | null = null
async function getCheerio() {
  return (cheerioModule ??= await import('cheerio'))
}

let nbtModule: typeof import('prismarine-nbt') | null = null
async function getNbt() {
  return (nbtModule ??= await import('prismarine-nbt'))
}

const parseNbt = async (buffer: Buffer | ArrayBuffer) => {
  const nbt = await getNbt()
  const res = await nbt.parse(buffer)
  return (res as any)?.parsed || res
}

export interface PinnedServerConfig {
  ip: string
  name: string
  description?: string
  version?: string
  tags?: string[]
  matchIps?: string[]
  bannerUrl?: string
  faviconUrl?: string
}

export const PINNED_SERVERS_URL = 'https://storage.letcute.com/letcutemc-launcher/pinned-servers.json'

/**
 * Danh sách server ghim mặc định (fallback khi không có mạng).
 */
export const DEFAULT_PINNED_SERVERS: PinnedServerConfig[] = [
  {
    ip: 'choi.novusmc.online',
    // Minecraft color formatting: §6 = Vàng cam (Gold), §e = Vàng sáng (Yellow), §l = In đậm (Bold)
    name: '§6§l[Server Chill Lắm] §e§lNovusMC',
    description: 'Server Chill Lắm - NovusMC máy chủ Minecraft sinh tồn cộng đồng vui vẻ',
    version: '1.20.x - 1.21.x',
    tags: ['Survival', 'Chill', 'SMP', 'VietNam'],
    matchIps: ['choi.novusmc.online', 'novusmc.online', 'choi.novusmc.online:25565', 'choi.novusmc.online:19012']
  },
  {
    ip: 'mc.aenat.net:25565',
    name: '§e§l[VIP] §f§lAenat Network',
    description: 'Aenat Network - Máy chủ Minecraft Việt Nam',
    version: '1.20.x - 1.21.x',
    tags: ['VIP', 'Network', 'VietNam'],
    matchIps: ['mc.aenat.net', 'mc.aenat.net:25565']
  }
]

export let PINNED_SERVERS: PinnedServerConfig[] = [...DEFAULT_PINNED_SERVERS]

export function normalizeIp(ip?: string): string {
  return ip ? ip.toLowerCase().trim().replace(/:(?:25565|19012|\d+)$/, '') : ''
}

export function findPinnedServer(ip?: string, customList?: PinnedServerConfig[]): PinnedServerConfig | undefined {
  if (!ip) return undefined
  const clean = normalizeIp(ip)
  const full = ip.toLowerCase().trim()
  const list = customList ?? PINNED_SERVERS

  return list.find(pinned => {
    const pinnedClean = normalizeIp(pinned.ip)
    if (clean === pinnedClean || full === pinned.ip.toLowerCase().trim()) return true
    return pinned.matchIps?.some(m => normalizeIp(m) === clean || m.toLowerCase().trim() === full) ?? false
  })
}

export function isPinnedServerIp(ip?: string, customList?: PinnedServerConfig[]): boolean {
  return findPinnedServer(ip, customList) !== undefined
}

// Backward compatibility
export const NOVUS_SERVER_IP = DEFAULT_PINNED_SERVERS[0]?.ip ?? 'choi.novusmc.online'
export const NOVUS_SERVER_NAME = DEFAULT_PINNED_SERVERS[0]?.name ?? '§6§l[Server Chill Lắm] §e§lNovusMC'
export const isNovusServerIp = isPinnedServerIp

export class ServerListService {
  private readonly baseUrl = 'https://minecraft-mp.com/country/vietnam'
  private fetchPinnedPromise: Promise<PinnedServerConfig[]> | null = null

  /**
   * Lấy danh sách pinned servers từ remote URL hoặc cache, fallback về DEFAULT_PINNED_SERVERS nếu lỗi.
   */
  async getPinnedServers(forceRefresh = false): Promise<PinnedServerConfig[]> {
    if (!forceRefresh && this.fetchPinnedPromise) {
      return this.fetchPinnedPromise
    }

    const task = this.resolvePinnedServers(forceRefresh)
    this.fetchPinnedPromise = task
    try {
      return await task
    } finally {
      this.fetchPinnedPromise = null
    }
  }

  private async resolvePinnedServers(forceRefresh = false): Promise<PinnedServerConfig[]> {
    const { getLauncherDataDirectory, readJsonFile, writeJsonFile } = await import('../system/storageService.js')
    const cachePath = path.join(getLauncherDataDirectory(), 'pinned-servers-cache.json')
    const ONE_DAY = 24 * 60 * 60 * 1000

    let diskCache: { timestamp: number; servers: PinnedServerConfig[] } | null = null
    try {
      diskCache = (await readJsonFile(cachePath, { timestamp: 0, servers: [] })) as {
        timestamp: number
        servers: PinnedServerConfig[]
      }
    } catch {
      diskCache = null
    }

    const now = Date.now()
    if (!forceRefresh && diskCache && Array.isArray(diskCache.servers) && diskCache.servers.length > 0 && now - diskCache.timestamp < ONE_DAY) {
      PINNED_SERVERS = diskCache.servers
      return PINNED_SERVERS
    }

    try {
      const res = await fetch(PINNED_SERVERS_URL, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const parsed = this.parsePinnedServersJson(data)

      if (parsed.length > 0) {
        PINNED_SERVERS = parsed
        await writeJsonFile(cachePath, { timestamp: now, servers: parsed }).catch(() => {})
        return parsed
      }
    } catch (err) {
      console.warn('[ServerListService] Fetch remote pinned servers failed:', err instanceof Error ? err.message : String(err))
    }

    if (diskCache && Array.isArray(diskCache.servers) && diskCache.servers.length > 0) {
      PINNED_SERVERS = diskCache.servers
      return diskCache.servers
    }

    PINNED_SERVERS = [...DEFAULT_PINNED_SERVERS]
    return PINNED_SERVERS
  }

  private parsePinnedServersJson(data: any): PinnedServerConfig[] {
    const rawList = Array.isArray(data) ? data : (Array.isArray(data?.servers) ? data.servers : [])
    const result: PinnedServerConfig[] = []

    for (const item of rawList) {
      if (!item || typeof item.ip !== 'string' || typeof item.name !== 'string') continue
      const ip = item.ip.trim()
      const name = item.name.trim()
      if (!ip || !name) continue

      result.push({
        ip,
        name,
        description: typeof item.description === 'string' ? item.description.trim() : undefined,
        version: typeof item.version === 'string' ? item.version.trim() : undefined,
        tags: Array.isArray(item.tags)
          ? item.tags.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
          : undefined,
        matchIps: Array.isArray(item.matchIps)
          ? item.matchIps.filter((m: any) => typeof m === 'string' && m.trim()).map((m: string) => m.trim())
          : undefined,
        bannerUrl: typeof item.bannerUrl === 'string' && item.bannerUrl.startsWith('http') ? item.bannerUrl.trim() : undefined,
        faviconUrl: typeof item.faviconUrl === 'string' && item.faviconUrl.startsWith('http') ? item.faviconUrl.trim() : undefined
      })
    }

    return result
  }

  /**
   * Đảm bảo các server trong PINNED_SERVERS luôn ở đầu danh sách theo thứ tự mảng.
   * Nếu có ở dưới thì xóa khỏi vị trí cũ và đẩy lên đầu; nếu chưa có thì thêm mới vào đầu.
   */
  promotePinnedServers(servers: MinecraftServer[], page: number = 1, customPinned?: PinnedServerConfig[]): MinecraftServer[] {
    const pinnedList = customPinned ?? PINNED_SERVERS
    const list = servers.filter(s => !isPinnedServerIp(s.ip, pinnedList))
    if (page > 1) return list

    const pinnedItems: MinecraftServer[] = pinnedList.map((pinned, index) => {
      const existing = servers.find(s => {
        const found = findPinnedServer(s.ip, pinnedList)
        return found?.ip.toLowerCase() === pinned.ip.toLowerCase()
      })

      if (existing) {
        return {
          ...existing,
          name: pinned.name,
          ip: pinned.ip,
          rank: index + 1,
          bannerUrl: pinned.bannerUrl ?? existing.bannerUrl,
          faviconUrl: pinned.faviconUrl ?? existing.faviconUrl,
          description: pinned.description || existing.description,
          tags: pinned.tags || existing.tags,
          version: pinned.version || existing.version,
          isOnline: true
        }
      }

      return {
        id: `pinned_server_${index + 1}`,
        rank: index + 1,
        name: pinned.name,
        ip: pinned.ip,
        bannerUrl: pinned.bannerUrl,
        faviconUrl: pinned.faviconUrl,
        description: pinned.description ?? 'Máy chủ cộng đồng Minecraft',
        isOnline: true,
        players: { online: 0, max: 500 },
        version: pinned.version ?? '1.20.x - 1.21.x',
        tags: pinned.tags ?? ['Community', 'VietNam']
      }
    })

    return [...pinnedItems, ...list]
  }

  promoteNovusServer(servers: MinecraftServer[], page: number = 1): MinecraftServer[] {
    return this.promotePinnedServers(servers, page)
  }

  /**
   * Fetches and parses the server list from minecraft-mp.com
   * @param page Page number
   */
  async getTopServers(page: number = 1): Promise<MinecraftServer[]> {
    let pinnedList: PinnedServerConfig[] = PINNED_SERVERS
    try {
      pinnedList = await this.getPinnedServers()
      const { getLauncherDataDirectory, readJsonFile, writeJsonFile } = await import('../system/storageService.js')
      const cachePath = path.join(getLauncherDataDirectory(), `top-servers-cache-page${page}.json`)

      const cache = (await readJsonFile(cachePath, { timestamp: 0, data: [] })) as { timestamp: number, data: MinecraftServer[] }
      const now = Date.now()
      const ONE_DAY = 24 * 60 * 60 * 1000

      if (now - cache.timestamp < ONE_DAY && cache.data.length > 0) {
        return this.promotePinnedServers(cache.data, page, pinnedList)
      }

      const url = page === 1 ? this.baseUrl + '/' : `${this.baseUrl}/${page}/`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

      const html = await res.text()
      const cheerio = await getCheerio()
      const $ = cheerio.load(html)
      const servers: MinecraftServer[] = []

      $('.servers-table tbody tr').each((_, el) => {
        const $el = $(el)
        if ($el.attr('height') !== '120') return

        const rank = parseInt($el.find('td:nth-child(1) strong').text().replace('#', '').trim(), 10) || 0
        const $aboutTd = $el.find('td.server-about')
        const name = $aboutTd.find('.server-title-responsive a').text().trim()
        const description = $aboutTd.find('.server-description').text().trim()
        const ip = $el.find('.server-ip-main a.btn-server-ip').text().replace(/\s+/g, ' ').trim()

        const faviconUrl = $el.find('td:nth-child(1) img').attr('src')
        const bannerUrl = $el.find('.server-card video').attr('src') || $el.find('.server-card video').attr('data-src') || $el.find('.server-card img.card-img-fluid').attr('src')

        const tags: string[] = []
        $aboutTd.find('.list-server-tags .btn-tag').each((__, tagEl) => {
          tags.push($(tagEl).text().trim())
        })

        const $statusTd = $el.find('td:nth-child(4)')
        const isOnline = $statusTd.find('.btn-success').length > 0
        const playersBtn = $statusTd.find('.btn-xs-playercount').text()
        const playersMatch = playersBtn.match(/(\d+)\s*\/\s*(\d+)/)

        let online = 0
        let max = 0
        if (playersMatch && playersMatch[1] && playersMatch[2]) {
          online = parseInt(playersMatch[1], 10)
          max = parseInt(playersMatch[2], 10)
        } else {
          online = parseInt($statusTd.find('strong').text().trim(), 10) || 0
          max = parseInt($statusTd.find('small').text().replace('/', '').trim(), 10) || 0
        }

        const version = $statusTd.find('.btn-version-fade').text().trim()

        if (name && ip) {
          servers.push({
            id: `vn_top_${rank}`,
            rank,
            name,
            ip,
            bannerUrl: bannerUrl?.startsWith('/') ? `https://minecraft-mp.com${bannerUrl}` : bannerUrl,
            faviconUrl: faviconUrl?.startsWith('/') ? `https://minecraft-mp.com${faviconUrl}` : faviconUrl,
            description,
            isOnline,
            players: { online, max },
            version,
            tags
          })
        }
      })

      const finalServers = this.promotePinnedServers(servers, page, pinnedList)
      if (finalServers.length > 0) {
        await writeJsonFile(cachePath, { timestamp: now, data: finalServers }).catch(() => {})
      }
      return finalServers
    } catch (error) {
      console.error('[ServerListService] Error fetching servers:', error)
      return this.promotePinnedServers([], page, pinnedList)
    }
  }

  /**
   * Injects top servers into a profile's servers.dat
   * Chỉ xóa các server có ký hiệu VN#, giữ nguyên 100% server do người dùng tự thêm.
   * Các server đặc biệt (NovusMC, Aenat) luôn được ghim ở vị trí đầu tiên.
   */
  async injectServersToProfile(profileId: string, page: number = 1, _targetVersion?: string): Promise<boolean> {
    try {
      const topServers = await this.getTopServers(page)
      if (topServers.length === 0) return false

      const { getProfiles } = await import('../profile/profileService')
      const profilesStore = await getProfiles()
      const profile = profilesStore.profiles.find((p: any) => p.id === profileId)
      if (!profile) throw new Error(`Profile ${profileId} not found`)

      const defaultMcDirObj = await detectMinecraftDirectory()
      const gameDir = profile.gameDir ?? defaultMcDirObj.path
      const serversDatPath = path.join(gameDir, 'servers.dat')

      // Set lưu các IP đã có (pinned + user servers) để không inject trùng lặp
      const existingIps = new Set<string>()

      // 1. Tạo compounds cho pinned servers luôn nằm ở vị trí đầu (index 0, 1, ...)
      const pinnedList = await this.getPinnedServers()
      const pinnedCompounds = pinnedList.map(pinned => {
        existingIps.add(pinned.ip.toLowerCase().trim())
        existingIps.add(normalizeIp(pinned.ip))
        pinned.matchIps?.forEach(m => {
          existingIps.add(m.toLowerCase().trim())
          existingIps.add(normalizeIp(m))
        })

        return {
          name: { type: 'string', value: pinned.name },
          ip: { type: 'string', value: pinned.ip },
          acceptTextures: { type: 'byte', value: 1 }
        }
      })

      // 2. Đọc file servers.dat hiện tại (nếu có)
      let rootData: any = {
        name: '',
        type: 'compound',
        value: {
          servers: {
            type: 'list',
            value: {
              type: 'compound',
              value: []
            }
          }
        }
      }

      let userServers: any[] = []
      try {
        const buffer = await fs.promises.readFile(serversDatPath)
        const parsed = (await parseNbt(buffer)) as any
        rootData = parsed.parsed || parsed

        const srvList = rootData?.value?.servers
        let rawServers: any[] = []
        if (Array.isArray(srvList?.value?.value)) {
          rawServers = srvList.value.value
        } else if (Array.isArray(srvList?.value)) {
          rawServers = srvList.value
        }

        userServers = rawServers.filter((srv: any) => {
          const nameStr = typeof srv.name?.value === 'string' ? srv.name.value.trim() : (typeof srv.name === 'string' ? srv.name : '')
          const ipStr = typeof srv.ip?.value === 'string' ? srv.ip.value.trim() : (typeof srv.ip === 'string' ? srv.ip : '')

          // CHỈ xóa server do launcher thêm vào qua ký hiệu VN#
          if (nameStr.startsWith('VN#') || /^VN#\d+/i.test(nameStr)) {
            return false
          }

          // Server đặc biệt luôn được đưa lên đầu, nên bỏ ở vị trí cũ để không trùng lặp
          if (isPinnedServerIp(ipStr, pinnedList) || pinnedList.some(p => nameStr === p.name || nameStr.includes(p.name))) {
            return false
          }

          // Ghi nhận IP server người dùng để tránh inject trùng từ danh sách web
          if (ipStr) {
            existingIps.add(ipStr.toLowerCase())
            existingIps.add(normalizeIp(ipStr))
          }

          // Giữ lại toàn bộ server do người dùng tự thêm
          return true
        })
      } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code
        if (code !== 'ENOENT') {
          console.warn('[ServerListService] Error reading servers.dat, re-initializing:', err instanceof Error ? err.message : String(err))
        }
      }

      // 3. Chuẩn bị top servers từ web (chỉ thêm những server chưa có trong pinned hoặc server người dùng)
      const newServersNbt: any[] = []
      for (const srv of topServers) {
        if (!srv.isOnline || isPinnedServerIp(srv.ip, pinnedList)) continue

        const clean = normalizeIp(srv.ip)
        const full = srv.ip.toLowerCase().trim()
        if (existingIps.has(clean) || existingIps.has(full)) continue

        const isPrivate =
          srv.tags.some(t => t.toLowerCase().includes('private') || t.toLowerCase().includes('whitelist')) ||
          srv.name.toLowerCase().includes('private') ||
          srv.description.toLowerCase().includes('private') ||
          srv.description.toLowerCase().includes('whitelist') ||
          srv.ip.toLowerCase().includes('private server')

        if (isPrivate) continue

        existingIps.add(clean)
        existingIps.add(full)

        newServersNbt.push({
          name: { type: 'string', value: `VN#${srv.rank}` },
          ip: { type: 'string', value: srv.ip },
          acceptTextures: { type: 'byte', value: 1 }
        })
      }

      // Danh sách cuối cùng: [Pinned Servers (Novus, Aenat), User Servers, Top VN Servers (VN#)]
      const mergedServers = [...pinnedCompounds, ...userServers, ...newServersNbt]

      if (!rootData.value) rootData.value = {}
      rootData.value.servers = {
        type: 'list',
        value: {
          type: 'compound',
          value: mergedServers
        }
      }

      // Ghi NBT không nén bất đồng bộ (non-blocking)
      const nbt = await getNbt()
      const outBuffer = nbt.writeUncompressed(rootData)
      await fs.promises.writeFile(serversDatPath, outBuffer)

      return true
    } catch (error) {
      console.error('[ServerListService] Error injecting servers:', error)
      return false
    }
  }
}

export const serverListService = new ServerListService()

