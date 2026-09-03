// discord-rpc is lazy-loaded to avoid cold-start penalty
type DiscordRpcClient = import('discord-rpc').Client
import { getSettings } from './settingsService'
import { eventBus } from '../eventBus'
import { formatVersionDisplay } from '../../../shared/types'

// Thay mã Client ID của bạn vào đây (Tạo từ https://discord.com/developers/applications)
// Hiện tại tôi đang để một mã giả để tránh lỗi, hãy thay thế nó sau!
const CLIENT_ID = '1355902925607534592' // REPLACE_ME

let rpcClient: DiscordRpcClient | null = null
let isConnected = false
let reconnectTimer: NodeJS.Timeout | null = null
let busInitialized = false

function registerEventBusListeners(): void {
  if (busInitialized) return
  busInitialized = true

  eventBus.on('game:started', (payload) => {
    setPlaying(payload.versionId, payload.profileName)
  })

  eventBus.on('game:exited', () => {
    setIdle()
  })

  eventBus.on('game:crashed', () => {
    setIdle()
  })
}

export async function initDiscordRpc(): Promise<void> {
  registerEventBusListeners()
  const settings = await getSettings()

  if (rpcClient) return

  const { Client } = await import('discord-rpc')
  rpcClient = new Client({ transport: 'ipc' })

  rpcClient.on('ready', () => {
    isConnected = true
    //console.log('[Discord RPC] Đã kết nối với Discord')
    setIdle()
  })

  rpcClient.on('disconnected', () => {
    isConnected = false
    //console.log('[Discord RPC] Bị ngắt kết nối')
    rpcClient = null
    reconnectTimer = setTimeout(initDiscordRpc, 15000)
  })

  try {
    await rpcClient.login({ clientId: CLIENT_ID })
  } catch (error) {
    console.error('[Discord RPC] Lỗi kết nối (Có thể do Client ID chưa đúng hoặc chưa mở Discord):', error)
    rpcClient = null
    isConnected = false
  }
}

export function setIdle(): void {
  setCustomActivity('Đang ở sảnh chờ', 'Chuẩn bị vào game...')
}

export function setCustomActivity(details: string, state: string): void {
  if (!rpcClient || !isConnected) return

  rpcClient.setActivity({
    details,
    state,
    startTimestamp: new Date(),
    largeImageKey: 'logo', // Thay bằng tên ảnh bạn đã upload lên Discord Developer Portal
    largeImageText: 'LetCuteMC Launcher',
    instance: false,
  }).catch(err => console.error('[Discord RPC] Lỗi khi set Activity:', err))
}

export function setPlaying(version: string, profileName: string): void {
  if (!rpcClient || !isConnected) return

  const displayVer = formatVersionDisplay(version) || version
  rpcClient.setActivity({
    details: `Đang chơi: ${profileName}`,
    state: `Phiên bản: ${displayVer}`,
    startTimestamp: new Date(),
    largeImageKey: 'logo',
    largeImageText: 'LetCuteMC Launcher',
    smallImageKey: 'playing', // Tên ảnh icon nhỏ
    smallImageText: 'In-Game',
    instance: false,
  }).catch(err => console.error('[Discord RPC] Lỗi khi set Playing:', err))
}

export function clearActivity(): void {
  if (!rpcClient || !isConnected) return
  rpcClient.clearActivity().catch(err => console.error('[Discord RPC] Lỗi clear Activity:', err))
}

export async function stopDiscordRpc(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (rpcClient) {
    try {
      await rpcClient.destroy()
    } catch (err) {
      console.error('[Discord RPC] Lỗi khi đóng kết nối:', err)
    }
    rpcClient = null
    isConnected = false
    //console.log('[Discord RPC] Đã đóng kết nối')
  }
}
