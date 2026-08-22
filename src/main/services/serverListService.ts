import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'
import * as cheerio from 'cheerio'
import * as nbt from 'prismarine-nbt'
import { MinecraftServer } from '../../shared/types'
import { detectMinecraftDirectory } from './minecraftDirectoryService'

const parseNbt = async (buffer: Buffer | ArrayBuffer) => {
  const res = await nbt.parse(buffer)
  return (res as any)?.parsed || res
}

export class ServerListService {
  private readonly baseUrl = 'https://minecraft-mp.com/country/vietnam'

  /**
   * Fetches and parses the server list from minecraft-mp.com
   * @param page Page number
   */
  async getTopServers(page: number = 1): Promise<MinecraftServer[]> {
    try {
      const { getLauncherDataDirectory, readJsonFile, writeJsonFile } = await import('./storageService.js')
      const cachePath = path.join(getLauncherDataDirectory(), `top-servers-cache-page${page}.json`)
      
      const cache = await readJsonFile<{ timestamp: number, data: MinecraftServer[] }>(cachePath, { timestamp: 0, data: [] })
      const now = Date.now()
      const ONE_DAY = 24 * 60 * 60 * 1000

      if (now - cache.timestamp < ONE_DAY && cache.data.length > 0) {
        return cache.data
      }

      const url = page === 1 ? this.baseUrl + '/' : `${this.baseUrl}/${page}/`
      const res = await fetch(url)

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`)
      }

      const html = await res.text()
      const $ = cheerio.load(html)
      const servers: MinecraftServer[] = []

      $('.servers-table tbody tr').each((_, el) => {
        const $el = $(el)

        // Skip hidden/ad rows that don't have proper data
        if ($el.attr('height') !== '120') return

        const rankStr = $el.find('td:nth-child(1) strong').text().replace('#', '').trim()
        const rank = parseInt(rankStr, 10) || 0

        const $aboutTd = $el.find('td.server-about')
        const name = $aboutTd.find('.server-title-responsive a').text().trim()
        const description = $aboutTd.find('.server-description').text().trim()

        // IP
        const ipRaw = $el.find('.server-ip-main a.btn-server-ip').text()
        // The IP has whitespace and a flag img inside it, clean it up:
        const ip = ipRaw.replace(/\n/g, '').replace(/[\t ]+/g, ' ').trim()

        // Favicon and Banner
        const faviconUrl = $el.find('td:nth-child(1) img').attr('src')
        let bannerUrl = $el.find('.server-card video').attr('src') || $el.find('.server-card video').attr('data-src') || $el.find('.server-card img.card-img-fluid').attr('src')

        // Tags
        const tags: string[] = []
        $aboutTd.find('.list-server-tags .btn-tag').each((__, tagEl) => {
          tags.push($(tagEl).text().trim())
        })

        // Status & Players
        const $statusTd = $el.find('td:nth-child(4)')
        const isOnline = $statusTd.find('.btn-success').length > 0

        const playersBtn = $statusTd.find('.btn-xs-playercount').text() // " 622 / 2026"
        let online = 0
        let max = 0
        const playersMatch = playersBtn.match(/(\d+)\s*\/\s*(\d+)/)
        if (playersMatch) {
          online = parseInt(playersMatch[1], 10)
          max = parseInt(playersMatch[2], 10)
        } else {
          // Sometimes it is inside strong and small tags separately
          const strong = $statusTd.find('strong').text().trim()
          const small = $statusTd.find('small').text().replace('/', '').trim()
          online = parseInt(strong, 10) || 0
          max = parseInt(small, 10) || 0
        }

        // Version
        const version = $statusTd.find('.btn-version-fade').text().trim()

        if (name && ip) {
          servers.push({
            id: `vn_top_${rank}`,
            rank,
            name,
            ip,
            bannerUrl: bannerUrl && bannerUrl.startsWith('/') ? `https://minecraft-mp.com${bannerUrl}` : bannerUrl,
            faviconUrl: faviconUrl && faviconUrl.startsWith('/') ? `https://minecraft-mp.com${faviconUrl}` : faviconUrl,
            description,
            isOnline,
            players: { online, max },
            version,
            tags
          })
        }
      })

      if (servers.length > 0) {
        await writeJsonFile(cachePath, { timestamp: now, data: servers }).catch(() => {})
      }

      return servers
    } catch (error) {
      console.error('[ServerListService] Error fetching servers:', error)
      return []
    }
  }

  /**
   * Injects top servers into a profile's servers.dat
   * Removes previously injected servers by checking letcute_top flag.
   */
  async injectServersToProfile(profileId: string, page: number = 1, targetVersion?: string): Promise<boolean> {
    try {
      console.log(`[ServerListService] Fetching top servers for injection (page ${page}, targetVersion ${targetVersion})`)
      let topServers = await this.getTopServers(page)

      // Filter out offline servers and private servers (whitelist)
      topServers = topServers.filter(srv => {
        if (!srv.isOnline) return false

        const isPrivateTag = srv.tags.some(t => t.toLowerCase().includes('private') || t.toLowerCase().includes('whitelist'))
        const isPrivateNameDesc = srv.name.toLowerCase().includes('private') || srv.description.toLowerCase().includes('private') || srv.description.toLowerCase().includes('whitelist')
        const isPrivateIp = srv.ip.toLowerCase().includes('private server')

        return !isPrivateTag && !isPrivateNameDesc && !isPrivateIp
      })

      if (topServers.length === 0) {
        console.warn('[ServerListService] No servers found to inject')
        return false
      }

      const { getProfiles } = await import('./profileService')
      const profilesStore = await getProfiles()
      const profile = profilesStore.profiles.find(p => p.id === profileId)
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`)
      }

      const defaultMcDirObj = await detectMinecraftDirectory()
      const gameDir = profile.gameDir ?? defaultMcDirObj.path
      const serversDatPath = path.join(gameDir, 'servers.dat')

      let rootData: any
      let currentServers: any[] = []

      // If servers.dat exists, parse it
      if (fs.existsSync(serversDatPath)) {
        const buffer = fs.readFileSync(serversDatPath)
        const parsed = (await parseNbt(buffer)) as any
        // prismarine-nbt typings can be weird, util.promisify returns the first argument `parsed` or an object {parsed, type} depending on version. Let's handle both.
        rootData = parsed.parsed || parsed

        if (rootData.value && rootData.value.servers && rootData.value.servers.value) {
          const srvList = rootData.value.servers.value
          if (srvList.type === 'compound' && Array.isArray(srvList.value)) {
            // Keep servers that DO NOT have our letcute_top tag AND do not have our injected names
            currentServers = srvList.value.filter((srv: any) => {
              const hasTag = srv.letcute_top && srv.letcute_top.value === 1
              const nameStr = srv.name && typeof srv.name.value === 'string' ? srv.name.value : ''
              const isOldInjected = hasTag || nameStr.startsWith('VN#') || nameStr === '§e[VIP] §fAenat Network'
              return !isOldInjected
            })
          }
        }
      } else {
        // Initialize an empty servers.dat NBT structure
        rootData = {
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
      }

      // Convert our fetched servers to NBT compounds
      let newServersNbt = topServers.map((srv, index) => {
        const title = `VN#${srv.rank}`

        const compound: any = {
          name: { type: 'string', value: title },
          ip: { type: 'string', value: srv.ip },
          // Hidden NBT tag that Minecraft ignores, but we use it to recognize our injection!
          letcute_top: { type: 'byte', value: 1 },
          acceptTextures: { type: 'byte', value: 1 }
        }

        return compound
      })

      // Remove the pinned server if it's already in the scraped list to prevent duplicates
      newServersNbt = newServersNbt.filter((srv: any) => srv.ip.value !== 'mc.aenat.net:25565' && srv.ip.value !== 'mc.aenat.net')

      // Pin mc.aenat.net:25565 to the very top
      newServersNbt.unshift({
        name: { type: 'string', value: '§e[VIP] §fAenat Network' },
        ip: { type: 'string', value: 'mc.aenat.net:25565' },
        letcute_top: { type: 'byte', value: 1 },
        acceptTextures: { type: 'byte', value: 1 }
      })

      // Filter out any server in currentServers that has the exact same IP as any new server
      const newIps = new Set(newServersNbt.map((srv: any) => srv.ip.value.toLowerCase()))
      currentServers = currentServers.filter((srv: any) => {
        const ipStr = srv.ip && typeof srv.ip.value === 'string' ? srv.ip.value.toLowerCase() : ''
        return !newIps.has(ipStr)
      })

      // Combine: User's custom servers first, then our injected servers at the bottom
      const mergedServers = [...currentServers, ...newServersNbt]

      // Update rootData
      if (!rootData.value) rootData.value = {}
      if (!rootData.value.servers) {
        rootData.value.servers = { type: 'list', value: { type: 'compound', value: [] } }
      }

      // Prismarine-nbt list format requires the nested type
      rootData.value.servers.value = {
        type: 'compound',
        value: mergedServers
      }

      // Write back uncompressed NBT
      const outBuffer = nbt.writeUncompressed(rootData)
      fs.writeFileSync(serversDatPath, outBuffer)

      console.log(`[ServerListService] Successfully injected ${newServersNbt.length} servers into ${serversDatPath}`)
      return true
    } catch (error) {
      console.error('[ServerListService] Error injecting servers:', error)
      return false
    }
  }
}

export const serverListService = new ServerListService()
