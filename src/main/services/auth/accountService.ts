import fsPromises from 'node:fs/promises'
import crypto from 'node:crypto'
import { safeStorage } from 'electron'
import type { AccountState, AccountItem, MicrosoftAccount } from '../../../shared/types'
import { getAccountConfigPath, ensureLauncherDataDirectory } from '../system/storageService.js'

/** Single-flight MS token refresh — avoids TOO_MANY_REQUESTS on spam load */
let refreshInFlight: Promise<void> | null = null

const ENC_PREFIX = 'enc:'

function encryptSecret(val?: string): string | undefined {
  if (!val) return undefined
  if (!safeStorage.isEncryptionAvailable()) return val
  try {
    const encrypted = safeStorage.encryptString(val)
    return `${ENC_PREFIX}${encrypted.toString('base64')}`
  } catch {
    return val
  }
}

function decryptSecret(val?: string): string | undefined {
  if (!val) return undefined
  if (!val.startsWith(ENC_PREFIX)) return val
  if (!safeStorage.isEncryptionAvailable()) return val
  try {
    const base64Data = val.slice(ENC_PREFIX.length)
    const buf = Buffer.from(base64Data, 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return val
  }
}

export function generateOfflineUuid(username: string): string {
  const input = `OfflinePlayer:${username}`
  const hash = crypto.createHash('md5').update(input, 'utf8').digest()
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x30
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80
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
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('[AccountService] File tài khoản bị hỏng, không thể parse JSON. Khôi phục mặc định.')
      const defaultLocalUuid = generateOfflineUuid('Player')
      return {
        activeAccountId: 'local_Player',
        accounts: [{
          id: 'local_Player',
          type: 'local',
          username: 'Player',
          uuid: defaultLocalUuid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Dữ liệu tài khoản không hợp lệ.')
    }

    const data = parsed as Record<string, unknown>

    // MIGRATION: Check if this is the old schema
    if (data.accounts === undefined) {
      const accounts: AccountItem[] = []
      let activeAccountId: string | null = null

      const legacyLocal = data.localAccount as Record<string, unknown> | undefined
      if (legacyLocal && typeof legacyLocal === 'object') {
        const username = (typeof legacyLocal.username === 'string' ? legacyLocal.username : '') || 'Player'
        const localId = `local_${username.toLowerCase()}`
        accounts.push({
          id: localId,
          type: 'local',
          username: username,
          uuid: generateOfflineUuid(username),
          createdAt: (typeof legacyLocal.createdAt === 'string' ? legacyLocal.createdAt : '') || new Date().toISOString(),
          updatedAt: (typeof legacyLocal.updatedAt === 'string' ? legacyLocal.updatedAt : '') || new Date().toISOString(),
        })
        if (data.mode === 'local') {
          activeAccountId = localId
        }
      }

      const legacyMs = data.microsoftAccount as Record<string, unknown> | undefined
      if (legacyMs && typeof legacyMs === 'object') {
        const msId = (typeof legacyMs.id === 'string' ? legacyMs.id : '') || (typeof legacyMs.uuid === 'string' ? legacyMs.uuid : '')
        accounts.push({
          id: msId,
          type: 'microsoft',
          username: typeof legacyMs.username === 'string' ? legacyMs.username : '',
          uuid: typeof legacyMs.uuid === 'string' ? legacyMs.uuid : '',
          avatarUrl: typeof legacyMs.avatarUrl === 'string' ? legacyMs.avatarUrl : undefined,
          accessToken: typeof legacyMs.accessToken === 'string' ? legacyMs.accessToken : undefined,
          refreshToken: typeof legacyMs.refreshToken === 'string' ? legacyMs.refreshToken : undefined,
          expiresAt: typeof legacyMs.expiresAt === 'string' ? legacyMs.expiresAt : undefined,
          createdAt: (typeof legacyMs.createdAt === 'string' ? legacyMs.createdAt : '') || new Date().toISOString(),
          updatedAt: (typeof legacyMs.updatedAt === 'string' ? legacyMs.updatedAt : '') || new Date().toISOString(),
        })
        if (data.mode === 'microsoft') {
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
        activeAccountId: activeAccountId || accounts[0]?.id || null,
        accounts
      }
      await saveAccountState(migratedState)
      return migratedState
    }

    // Validate new schema shape
    if (!Array.isArray(data.accounts)) {
      throw new Error('Dữ liệu tài khoản thiếu trường accounts.')
    }
    const state: AccountState = {
      activeAccountId: typeof data.activeAccountId === 'string' ? data.activeAccountId : null,
      accounts: data.accounts as AccountItem[],
    }
    // Decrypt tokens for runtime in-memory use
    for (const acc of state.accounts) {
      if (acc.type === 'microsoft') {
        acc.accessToken = decryptSecret(acc.accessToken)
        acc.refreshToken = decryptSecret(acc.refreshToken)
      }
    }
    return state
  } catch (error) {
    console.error('[AccountService] Lỗi đọc file tài khoản, khôi phục mặc định:', error instanceof Error ? error.message : error)
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
  // Clone to avoid mutating in-memory runtime state while saving encrypted version
  const copy: AccountState = {
    activeAccountId: state.activeAccountId,
    accounts: state.accounts.map(acc => {
      if (acc.type === 'microsoft') {
        return {
          ...acc,
          accessToken: encryptSecret(acc.accessToken),
          refreshToken: encryptSecret(acc.refreshToken),
        }
      }
      return { ...acc }
    })
  }
  await fsPromises.writeFile(filePath, JSON.stringify(copy, null, 2), 'utf-8')
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
  const cleanUsername = (newName || '').trim()
  if (cleanUsername.length < 3 || cleanUsername.length > 16) {
    throw new Error('Tên tài khoản phải từ 3 đến 16 ký tự.')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    throw new Error('Tên tài khoản chỉ được chứa chữ cái, chữ số và dấu gạch dưới.')
  }

  const state = await getAccountState()

  const acc = state.accounts.find(a => a.id === accountId)
  if (!acc) {
    throw new Error('Không tìm thấy tài khoản để đổi tên.')
  }

  if (acc.type !== 'local') {
    throw new Error('Chỉ có thể đổi tên hiển thị của tài khoản offline.')
  }

  // Update username
  acc.username = cleanUsername
  acc.updatedAt = new Date().toISOString()

  // Note: For local accounts, we don't change the ID (it stays local_oldname) 
  // because changing the ID would break activeAccountId and local caches.
  // It's perfectly fine to just change the display username.

  await saveAccountState(state)
  return state
}

export async function saveLocalSkin(accountId: string, skinUrl: string | null, skinModel: string | null, capeUrl: string | null): Promise<AccountState> {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Mã tài khoản không hợp lệ.')
  }

  const state = await getAccountState()

  const acc = state.accounts.find(a => a.id === accountId)
  if (!acc) {
    throw new Error('Không tìm thấy tài khoản để lưu skin.')
  }
  if (skinUrl !== undefined) acc.skinUrl = skinUrl || undefined
  if (skinModel !== undefined) {
    acc.skinModel = skinModel === 'slim' ? 'slim' : skinModel === 'default' ? 'default' : undefined
  }
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
    if (state.accounts.length > 0 && state.accounts[0]) {
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
  account: MicrosoftAccount
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

