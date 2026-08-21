import fsPromises from 'node:fs/promises'
import crypto from 'node:crypto'
import type { AccountState, AccountItem } from '../../shared/types'
import { getAccountConfigPath, ensureLauncherDataDirectory } from './storageService.js'

/** Single-flight MS token refresh — avoids TOO_MANY_REQUESTS on spam load */
let refreshInFlight: Promise<void> | null = null

export function generateOfflineUuid(username: string): string {
  const input = `OfflinePlayer:${username}`
  const hash = crypto.createHash('md5').update(input, 'utf8').digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-')
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p)
    return true
  } catch {
    return false
  }
}

export async function getAccountState(): Promise<AccountState> {
  const filePath = getAccountConfigPath()
  if (!(await pathExists(filePath))) {
    const defaultLocalUuid = generateOfflineUuid('Player')
    return {
      activeAccountId: 'local_Player',
      accounts: [
        {
          id: 'local_Player',
          type: 'local',
          username: 'Player',
          uuid: defaultLocalUuid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ]
    }
  }
  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as any

    // MIGRATION: Check if this is the old schema
    if (parsed.accounts === undefined) {
      const accounts: AccountItem[] = []
      let activeAccountId: string | null = null

      if (parsed.localAccount) {
        const username = parsed.localAccount.username || 'Player'
        const localId = `local_${username.toLowerCase()}`
        accounts.push({
          id: localId,
          type: 'local',
          username: username,
          uuid: generateOfflineUuid(username),
          createdAt: parsed.localAccount.createdAt || new Date().toISOString(),
          updatedAt: parsed.localAccount.updatedAt || new Date().toISOString(),
        })
        if (parsed.mode === 'local') {
          activeAccountId = localId
        }
      }

      if (parsed.microsoftAccount) {
        const msAccount = parsed.microsoftAccount
        const msId = msAccount.id || msAccount.uuid
        accounts.push({
          id: msId,
          type: 'microsoft',
          username: msAccount.username,
          uuid: msAccount.uuid,
          avatarUrl: msAccount.avatarUrl,
          accessToken: msAccount.accessToken,
          refreshToken: msAccount.refreshToken,
          expiresAt: msAccount.expiresAt,
          createdAt: msAccount.createdAt || new Date().toISOString(),
          updatedAt: msAccount.updatedAt || new Date().toISOString(),
        })
        if (parsed.mode === 'microsoft') {
          activeAccountId = msId
        }
      }

      if (accounts.length === 0) {
        const username = 'Player'
        const localId = `local_${username.toLowerCase()}`
        accounts.push({
          id: localId,
          type: 'local',
          username: username,
          uuid: generateOfflineUuid(username),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        activeAccountId = localId
      }

      const migratedState: AccountState = {
        activeAccountId: activeAccountId || accounts[0].id,
        accounts
      }
      await saveAccountState(migratedState)
      return migratedState
    }

    const state = parsed as AccountState
    // Fast path: never block UI load on network auth refresh
    return state
  } catch {
    const defaultLocalUuid = generateOfflineUuid('Player')
    return {
      activeAccountId: 'local_Player',
      accounts: [
        {
          id: 'local_Player',
          type: 'local',
          username: 'Player',
          uuid: defaultLocalUuid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ]
    }
  }
}

async function saveAccountState(state: AccountState): Promise<void> {
  const filePath = getAccountConfigPath()
  await ensureLauncherDataDirectory()
  await fsPromises.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8')
}

export async function addLocalAccount(
  username: string
): Promise<AccountState> {
  if (!username || username.trim().length === 0) {
    throw new Error('Local username không được rỗng.')
  }
  const cleanUsername = username.trim()
  if (cleanUsername.length < 3 || cleanUsername.length > 16) {
    throw new Error('Local username phải từ 3 đến 16 ký tự.')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    throw new Error('Local username chỉ được chứa chữ cái, số và dấu gạch dưới.')
  }

  const state = await getAccountState()
  const localId = `local_${cleanUsername.toLowerCase()}`

  const existing = state.accounts.find(a => a.id === localId)
  if (existing) {
    state.activeAccountId = localId
    await saveAccountState(state)
    return state
  }

  const newAccount: AccountItem = {
    id: localId,
    type: 'local',
    username: cleanUsername,
    uuid: generateOfflineUuid(cleanUsername),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  state.accounts.push(newAccount)
  state.activeAccountId = localId
  await saveAccountState(state)
  return state
}

export async function renameAccountLocally(accountId: string, newName: string): Promise<AccountState> {
  const state = await getAccountState()

  const accIndex = state.accounts.findIndex(a => a.id === accountId)
  if (accIndex === -1) {
    throw new Error('Không tìm thấy tài khoản để đổi tên.')
  }

  // Update username
  state.accounts[accIndex].username = newName

  // Note: For local accounts, we don't change the ID (it stays local_oldname) 
  // because changing the ID would break activeAccountId and local caches.
  // It's perfectly fine to just change the display username.

  await saveAccountState(state)
  return state
}

export async function saveLocalSkin(accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null): Promise<AccountState> {
  const state = await getAccountState()

  const accIndex = state.accounts.findIndex(a => a.id === accountId)
  if (accIndex === -1) {
    throw new Error('Không tìm thấy tài khoản để lưu skin.')
  }

  const acc = state.accounts[accIndex]
  if (skinUrl !== undefined) acc.skinUrl = skinUrl || undefined
  if (skinModel !== undefined) acc.skinModel = skinModel || undefined
  if (capeUrl !== undefined) acc.capeUrl = capeUrl || undefined

  acc.updatedAt = new Date().toISOString()

  await saveAccountState(state)
  return state
}

export async function selectAccount(
  accountId: string
): Promise<AccountState> {
  const state = await getAccountState()
  const account = state.accounts.find(a => a.id === accountId)
  if (!account) {
    throw new Error('Tài khoản không tồn tại.')
  }
  state.activeAccountId = accountId
  await saveAccountState(state)
  return state
}

export async function removeAccount(
  accountId: string
): Promise<AccountState> {
  const state = await getAccountState()
  const index = state.accounts.findIndex(a => a.id === accountId)
  if (index === -1) {
    throw new Error('Tài khoản không tồn tại.')
  }

  state.accounts.splice(index, 1)

  if (state.activeAccountId === accountId) {
    if (state.accounts.length > 0) {
      state.activeAccountId = state.accounts[0].id
    } else {
      const defaultLocalUuid = generateOfflineUuid('Player')
      state.accounts.push({
        id: 'local_Player',
        type: 'local',
        username: 'Player',
        uuid: defaultLocalUuid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      state.activeAccountId = 'local_Player'
    }
  }

  await saveAccountState(state)
  return state
}

export async function saveMicrosoftAccount(
  account: any
): Promise<AccountState> {
  if (!account.username || !account.uuid || !account.accessToken) {
    throw new Error('Thông tin tài khoản Microsoft thiếu các trường bắt buộc.')
  }
  const state = await getAccountState()
  const msId = account.id || account.uuid

  const existingIndex = state.accounts.findIndex(a => a.id === msId)
  const newAccount: AccountItem = {
    id: msId,
    type: 'microsoft',
    username: account.username,
    uuid: account.uuid,
    avatarUrl: account.avatarUrl,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    expiresAt: account.expiresAt,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (existingIndex !== -1) {
    state.accounts[existingIndex] = {
      ...state.accounts[existingIndex],
      ...newAccount,
    }
  } else {
    state.accounts.push(newAccount)
  }

  state.activeAccountId = msId
  await saveAccountState(state)
  return state
}

/** Refresh MS token only when needed (launch / explicit). Single-flight. */
export async function refreshMicrosoftAccountToken(accountId?: string): Promise<AccountState> {
  const state = await getAccountState()
  const id = accountId || state.activeAccountId
  const account = state.accounts.find(a => a.id === id)
  if (!account || account.type !== 'microsoft' || !account.refreshToken) {
    return state
  }

  const expiresAt = account.expiresAt ? new Date(account.expiresAt).getTime() : 0
  const needsRefresh = expiresAt - Date.now() < 5 * 60 * 1000
  if (!needsRefresh) return state

  if (refreshInFlight) {
    await refreshInFlight
    return getAccountState()
  }

  refreshInFlight = (async () => {
    try {
      const { refreshMicrosoftToken } = await import('./microsoftAuthService')
      const refreshed = await refreshMicrosoftToken(account.refreshToken!)
      account.accessToken = refreshed.accessToken
      account.refreshToken = refreshed.refreshToken
      account.expiresAt = refreshed.expiresAt
      account.avatarUrl = refreshed.avatarUrl
      account.updatedAt = new Date().toISOString()
      await saveAccountState(state)
    } catch (error) {
      console.error('Failed to refresh Microsoft token:', error)
      throw error
    } finally {
      refreshInFlight = null
    }
  })()

  await refreshInFlight
  return getAccountState()
}
