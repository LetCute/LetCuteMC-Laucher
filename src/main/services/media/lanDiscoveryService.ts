/**
 * lanDiscoveryService.ts
 * Listens for Minecraft LAN worlds broadcast over UDP multicast (224.0.2.60:4445).
 * Standard Minecraft LAN broadcast format: [MOTD]motd_text[/MOTD][AD]port[/AD]
 */

import dgram from 'node:dgram'
import { EventEmitter } from 'node:events'
import { BrowserWindow } from 'electron'

export interface LanServerInfo {
  motd: string
  address: string
  port: number
  lastSeen: number
}

const MULTICAST_ADDR = '224.0.2.60'
const MULTICAST_PORT = 4445
const SERVER_EXPIRATION_MS = 5000 // Remove after 5 seconds of silence

export class LanDiscoveryService extends EventEmitter {
  private socket: dgram.Socket | null = null
  private discoveredServers: Map<string, LanServerInfo> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private isListening = false

  public start(): void {
    if (this.isListening) return

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

      this.socket.on('error', (err) => {
        console.warn('[LanDiscovery] Socket error:', err.message)
      })

      this.socket.on('message', (msg, rinfo) => {
        this.parseLanPacket(msg.toString('utf8'), rinfo.address)
      })

      this.socket.on('listening', () => {
        try {
          this.socket?.addMembership(MULTICAST_ADDR)
          this.isListening = true
          console.log(`[LanDiscovery] Listening for Minecraft LAN broadcasts on ${MULTICAST_ADDR}:${MULTICAST_PORT}`)
        } catch (e) {
          console.warn('[LanDiscovery] Failed to add multicast membership:', e)
        }
      })

      this.socket.bind(MULTICAST_PORT)

      // Start expiration cleanup ticker
      this.cleanupInterval = setInterval(() => {
        this.pruneExpiredServers()
      }, 2000)
    } catch (err) {
      console.warn('[LanDiscovery] Could not initialize LAN scanner socket:', err)
    }
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    if (this.socket) {
      try {
        if (this.isListening) {
          this.socket.dropMembership(MULTICAST_ADDR)
        }
        this.socket.close()
      } catch {}
      this.socket = null
    }

    this.isListening = false
    this.discoveredServers.clear()
  }

  public getDiscoveredServers(): LanServerInfo[] {
    this.pruneExpiredServers()
    return Array.from(this.discoveredServers.values())
  }

  private parseLanPacket(content: string, ipAddress: string): void {
    // Format: [MOTD]World Name[/MOTD][AD]Port[/AD]
    const motdMatch = content.match(/\[MOTD\]([\s\S]*?)\[\/MOTD\]/i)
    const adMatch = content.match(/\[AD\](\d+)\[\/AD\]/i)

    if (!adMatch || !adMatch[1]) return

    const motd = motdMatch?.[1] ?? 'Minecraft LAN World'
    const port = parseInt(adMatch[1], 10)
    const key = `${ipAddress}:${port}`

    const isNew = !this.discoveredServers.has(key)
    const serverInfo: LanServerInfo = {
      motd,
      address: ipAddress,
      port,
      lastSeen: Date.now(),
    }

    this.discoveredServers.set(key, serverInfo)

    if (isNew) {
      this.emitChange()
    }
  }

  private pruneExpiredServers(): void {
    const now = Date.now()
    let changed = false

    for (const [key, srv] of this.discoveredServers.entries()) {
      if (now - srv.lastSeen > SERVER_EXPIRATION_MS) {
        this.discoveredServers.delete(key)
        changed = true
      }
    }

    if (changed) {
      this.emitChange()
    }
  }

  private emitChange(): void {
    const list = Array.from(this.discoveredServers.values())
    this.emit('servers-updated', list)

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('lan-servers:updated', list)
      }
    }
  }
}

export const lanDiscoveryService = new LanDiscoveryService()
