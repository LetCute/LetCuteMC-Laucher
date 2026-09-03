import fs from 'node:fs/promises'
import path from 'node:path'
import type { AccountItem, AuthSession } from '../../../shared/types'
import { getAccountState } from '../auth/accountService'
import { resolveMissingDependencyOnModrinth, detectLoaderFromVersion } from './modDependencyService'

/**
 * Ensures CustomSkinLoader mod is present and configures LocalSkin + Mojang skin sources.
 * This ensures:
 * 1. Custom offline/local skins saved in launcher render in-game (LocalSkin).
 * 2. Premium/Mojang accounts and other players' skins render correctly on cracked/offline servers.
 */
export async function setupCustomSkinLoaderForLaunch(
  gameDir: string,
  mcVersion: string,
  auth?: AuthSession | null,
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
): Promise<void> {
  const loader = detectLoaderFromVersion(mcVersion)
  // Only inject mod for modded loaders (fabric, quilt, forge, neoforge)
  if (loader === 'unknown' || loader === ('vanilla' as any)) {
    return
  }

  const cslDir = path.join(gameDir, 'CustomSkinLoader')
  const localSkinDir = path.join(cslDir, 'LocalSkin', 'skins')
  const localCapeDir = path.join(cslDir, 'LocalSkin', 'capes')
  const modsDir = path.join(gameDir, 'mods')

  await fs.mkdir(localSkinDir, { recursive: true }).catch(() => {})
  await fs.mkdir(localCapeDir, { recursive: true }).catch(() => {})
  await fs.mkdir(modsDir, { recursive: true }).catch(() => {})

  // 1. Write CustomSkinLoader.json config if not present or ensure LocalSkin is top priority
  const configPath = path.join(cslDir, 'CustomSkinLoader.json')
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
      {
        name: 'Mojang',
        type: 'Mojang',
      },
      {
        name: 'Elyby',
        type: 'Elyby',
      },
      {
        name: 'LittleSkin',
        type: 'CustomSkinAPI',
        root: 'https://littleskin.cn/csl/',
      },
    ],
  }

  try {
    await fs.writeFile(configPath, JSON.stringify(cslConfig, null, 2), 'utf-8')
  } catch (err) {
    log?.('warn', `[SkinLoader] Không thể ghi config CSL: ${String(err)}`)
  }

  // 2. Export local skin and cape for the active account
  try {
    const accountState = await getAccountState()
    const activeAcc: AccountItem | undefined = accountState.accounts.find(
      (a) => a.id === accountState.activeAccountId || (auth && a.username === auth.username)
    )

    if (activeAcc && activeAcc.username) {
      const username = activeAcc.username
      const targetSkinFile = path.join(localSkinDir, `${username}.png`)
      const targetCapeFile = path.join(localCapeDir, `${username}.png`)

      // Skin
      if (activeAcc.skinUrl) {
        const skinBuf = await resolveSkinBuffer(activeAcc.skinUrl)
        if (skinBuf) {
          await fs.writeFile(targetSkinFile, skinBuf)
          log?.('info', `[SkinLoader] Đã áp dụng skin tùy chỉnh cho ${username}.`)
        }
      }

      // Cape
      if (activeAcc.capeUrl) {
        const capeBuf = await resolveSkinBuffer(activeAcc.capeUrl)
        if (capeBuf) {
          await fs.writeFile(targetCapeFile, capeBuf)
        }
      }
    }
  } catch (err) {
    log?.('warn', `[SkinLoader] Lỗi xuất skin local: ${String(err)}`)
  }

  // 3. Ensure CustomSkinLoader JAR exists in mods/
  try {
    const files = await fs.readdir(modsDir).catch(() => [])
    const hasCslJar = files.some(
      (f) => f.toLowerCase().includes('customskinloader') && f.endsWith('.jar')
    )

    if (!hasCslJar) {
      log?.('info', '[SkinLoader] Đang tự tải CustomSkinLoader để hỗ trợ skin server crack...')
      const resolved = await resolveMissingDependencyOnModrinth('customskinloader', mcVersion, loader)
      if (resolved && resolved.downloadUrl) {
        const dest = path.join(modsDir, resolved.fileName)
        const res = await fetch(resolved.downloadUrl, {
          headers: { 'User-Agent': 'LetCuteMC-Launcher/1.0' },
        })
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          await fs.writeFile(dest, buf)
          log?.('info', `[SkinLoader] Đã cài đặt ${resolved.fileName} thành công.`)
        }
      }
    }
  } catch (err) {
    log?.('warn', `[SkinLoader] Không thể tải CustomSkinLoader: ${String(err)}`)
  }
}

async function resolveSkinBuffer(skinUrlOrData: string): Promise<Buffer | null> {
  try {
    if (skinUrlOrData.startsWith('data:image/')) {
      const base64Data = skinUrlOrData.replace(/^data:image\/\w+;base64,/, '')
      return Buffer.from(base64Data, 'base64')
    }

    let url = skinUrlOrData
    if (url.startsWith('//')) url = 'https:' + url
    const res = await fetch(url)
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer())
    }
    return null
  } catch {
    return null
  }
}
