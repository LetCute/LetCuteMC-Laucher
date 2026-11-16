import fs from 'node:fs/promises'
import path from 'node:path'
import type { AccountItem, AuthSession } from '../../../shared/types'
import { getAccountState } from '../auth/accountService'
import { resolveMissingDependencyOnModrinth, detectLoaderFromVersion } from './modDependencyService'

export async function setupCustomSkinLoaderForLaunch(
  gameDir: string,
  mcVersion: string,
  auth: AuthSession | null | undefined,
  enabled: boolean,
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
): Promise<void> {
  const modsDir = path.join(gameDir, 'mods')

  if (!enabled) {
    const files = await fs.readdir(modsDir).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return []
      throw err
    })
    const cslJars = files.filter(
      (file) => file.toLowerCase().includes('customskinloader') && file.toLowerCase().endsWith('.jar')
    )
    await Promise.all(cslJars.map((file) => fs.unlink(path.join(modsDir, file))))
    if (cslJars.length > 0) {
      log?.('info', 'Đã gỡ CustomSkinLoader theo cài đặt skin.')
    }
    return
  }

  const loader = detectLoaderFromVersion(mcVersion)
  if (loader === 'unknown') {
    log?.('info', 'CustomSkinLoader chỉ được cài cho phiên bản game có mod loader.')
    return
  }

  const cslDir = path.join(gameDir, 'CustomSkinLoader')
  const localSkinDir = path.join(cslDir, 'LocalSkin', 'skins')
  const localCapeDir = path.join(cslDir, 'LocalSkin', 'capes')
  await Promise.all([
    fs.mkdir(localSkinDir, { recursive: true }),
    fs.mkdir(localCapeDir, { recursive: true }),
    fs.mkdir(modsDir, { recursive: true }),
  ])

  const cslConfig = {
    version: '15.0',
    loadlist: [
      {
        name: 'LocalSkin',
        type: 'LocalSkin',
        checkPNG: true,
        skin: 'LocalSkin/skins/{USERNAME}.png',
        cape: 'LocalSkin/capes/{USERNAME}.png',
        elytra: 'LocalSkin/capes/{USERNAME}.png',
      },
      { name: 'Mojang', type: 'Mojang' },
      { name: 'Elyby', type: 'Elyby' },
      {
        name: 'LittleSkin',
        type: 'CustomSkinAPI',
        root: 'https://littleskin.cn/csl/',
      },
    ],
  }
  await fs.writeFile(
    path.join(cslDir, 'CustomSkinLoader.json'),
    JSON.stringify(cslConfig, null, 2),
    'utf-8'
  )

  const accountState = await getAccountState()
  const activeAcc: AccountItem | undefined = accountState.accounts.find(
    (account) =>
      account.id === accountState.activeAccountId ||
      (!!auth?.username && account.username === auth.username)
  )

  if (activeAcc?.username) {
    for (const [url, destination, kind] of [
      [activeAcc.skinUrl, path.join(localSkinDir, `${activeAcc.username}.png`), 'skin'],
      [activeAcc.capeUrl, path.join(localCapeDir, `${activeAcc.username}.png`), 'cape'],
    ] as const) {
      if (!url) continue
      try {
        const image = await resolveSkinBuffer(url)
        if (image) {
          await fs.writeFile(destination, image)
          if (kind === 'skin') {
            log?.('info', `Đã áp dụng skin tùy chỉnh cho ${activeAcc.username}.`)
          }
        }
      } catch (err) {
        log?.('warn', `Không thể tải ${kind} của ${activeAcc.username}: ${String(err)}`)
      }
    }
  }

  const files = await fs.readdir(modsDir)
  const hasCslJar = files.some(
    (file) => file.toLowerCase().includes('customskinloader') && file.toLowerCase().endsWith('.jar')
  )
  if (hasCslJar) return

  const resolved = await resolveMissingDependencyOnModrinth('customskinloader', mcVersion, loader)
  if (!resolved?.downloadUrl) {
    throw new Error(`Không tìm thấy bản CustomSkinLoader tương thích với Minecraft ${mcVersion} (${loader}).`)
  }

  const response = await fetch(resolved.downloadUrl, {
    headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
  })
  if (!response.ok) {
    throw new Error(`Tải CustomSkinLoader thất bại: HTTP ${response.status}.`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(path.join(modsDir, resolved.fileName), buffer)
  log?.('info', `Đã cài đặt ${resolved.fileName}.`)
}

async function resolveSkinBuffer(skinUrlOrData: string): Promise<Buffer | null> {
  if (skinUrlOrData.startsWith('data:image/')) {
    const base64Data = skinUrlOrData.replace(/^data:image\/\w+;base64,/, '')
    return Buffer.from(base64Data, 'base64')
  }

  const url = skinUrlOrData.startsWith('//') ? `https:${skinUrlOrData}` : skinUrlOrData
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}.`)
  }
  return Buffer.from(await response.arrayBuffer())
}
