import { Client } from 'discord-rpc'
import { getSettings } from './settingsService'

// Thay mã Client ID của bạn vào đây (Tạo từ https://discord.com/developers/applications)
// Hiện tại tôi đang để một mã giả để tránh lỗi, hãy thay thế nó sau!
const CLIENT_ID = '1355902925607534592' // REPLACE_ME

let rpcClient: Client | null = null
let isConnected = false
let reconnectTimer: NodeJS.Timeout | null = null

export async function initDiscordRpc(): Promise<void> {
  const settings = await getSettings()
  if (!settings.enableDiscordRpc) return

  if (rpcClient) return

  rpcClient = new Client({ transport: 'ipc' })

  rpcClient.on('ready', () => {
    isConnected = true
    console.log('[Discord RPC] Đã kết nối với Discord')
    setIdle()
  })

  rpcClient.on('disconnected', () => {
    isConnected = false
    console.log('[Discord RPC] Bị ngắt kết nối')
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
  if (!rpcClient || !isConnected) return

  rpcClient.setActivity({
    details: 'Đang ở sảnh chờ',
    state: 'Chuẩn bị vào game...',
    startTimestamp: new Date(),
    largeImageKey: 'logo', // Thay bằng tên ảnh bạn đã upload lên Discord Developer Portal
    largeImageText: 'LetCuteMC Launcher',
    instance: false,
  }).catch(err => console.error('[Discord RPC] Lỗi khi set Idle:', err))
}

export function setPlaying(version: string, profileName: string): void {
  if (!rpcClient || !isConnected) return

  rpcClient.setActivity({
    details: `Đang chơi: ${profileName}`,
    state: `Phiên bản: ${version}`,
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
    console.log('[Discord RPC] Đã đóng kết nối')
  }
}
