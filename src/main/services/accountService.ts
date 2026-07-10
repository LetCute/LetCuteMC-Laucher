import fsPromises from 'node:fs/promises'
import type { AccountState, AccountMode, MicrosoftAccount } from '../../shared/types'
import { refreshMicrosoftToken } from './microsoftAuthService'
import { getAccountConfigPath, ensureLauncherDataDirectory } from './storageService.js'

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p)
    return true
  } catch {
    return false
  }
}

const defaultAccountState: AccountState = {
  mode: 'local',
  microsoftAccount: null,
  localAccount: {
    username: 'Player',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

export async function getAccountState(): Promise<AccountState> {
  const filePath = getAccountConfigPath()
  if (!(await pathExists(filePath))) {
    return defaultAccountState
  }
  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as AccountState

    if (parsed.microsoftAccount && parsed.microsoftAccount.refreshToken) {
      const expiresAt = parsed.microsoftAccount.expiresAt ? new Date(parsed.microsoftAccount.expiresAt).getTime() : 0
      const isExpired = expiresAt - Date.now() < 5 * 60 * 1000 // Less than 5 minutes remaining
      if (isExpired) {
        try {
          const refreshed = await refreshMicrosoftToken(parsed.microsoftAccount.refreshToken)
          parsed.microsoftAccount = refreshed
          await saveAccountState(parsed)
        } catch (error) {
          console.error('Failed to auto-refresh Microsoft token on load:', error)
          // If refresh token is invalid or expired, reset to local account
          parsed.microsoftAccount = null
          parsed.mode = 'local'
          await saveAccountState(parsed)
        }
      }
    }

    return {
      mode: parsed.mode ?? 'local',
      microsoftAccount: parsed.microsoftAccount ?? null,
      localAccount: {
        username: parsed.localAccount?.username ?? 'Player',
        createdAt: parsed.localAccount?.createdAt ?? new Date().toISOString(),
        updatedAt: parsed.localAccount?.updatedAt ?? new Date().toISOString(),
      },
    }
  } catch {
    return defaultAccountState
  }
}

async function saveAccountState(state: AccountState): Promise<void> {
  const filePath = getAccountConfigPath()
  await ensureLauncherDataDirectory()
  await fsPromises.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8')
}

export async function updateLocalAccount(
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

  const current = await getAccountState()
  current.localAccount = {
    username: cleanUsername,
    createdAt: current.localAccount.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await saveAccountState(current)
  return current
}

export async function setAccountMode(
  mode: AccountMode
): Promise<AccountState> {
  const current = await getAccountState()
  current.mode = mode
  await saveAccountState(current)
  return current
}

export async function saveMicrosoftAccount(
  account: MicrosoftAccount
): Promise<AccountState> {
  if (!account.username || !account.uuid || !account.accessToken) {
    throw new Error('Thông tin tài khoản Microsoft thiếu các trường bắt buộc.')
  }
  const current = await getAccountState()
  current.microsoftAccount = {
    ...account,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await saveAccountState(current)
  return current
}

export async function logoutMicrosoftAccount(): Promise<AccountState> {
  const current = await getAccountState()
  current.microsoftAccount = null
  current.mode = 'local'
  await saveAccountState(current)
  return current
}
