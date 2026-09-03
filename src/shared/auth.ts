import type { AccountItem, AuthSession } from './types'

export const OFFLINE_TOKEN_PLACEHOLDER = 'offline-token-placeholder'
export const DEFAULT_OFFLINE_UUID = '00000000-0000-0000-0000-000000000000'

/**
 * Creates a normalized AuthSession for launching Minecraft from the active account state.
 */
export function buildLaunchAuthSession(
  activeAccount: AccountItem | null | undefined,
  isVirtual: boolean,
  displayUsername: string
): AuthSession {
  if (isVirtual || !activeAccount || activeAccount.type === 'local') {
    return {
      type: 'virtual',
      username: displayUsername || activeAccount?.username || 'Player',
      uuid: activeAccount?.uuid || DEFAULT_OFFLINE_UUID,
      accessToken: OFFLINE_TOKEN_PLACEHOLDER,
    }
  }

  return {
    type: 'microsoft',
    username: activeAccount.username,
    uuid: activeAccount.uuid,
    accessToken: activeAccount.accessToken || '',
    expiresAt: activeAccount.expiresAt,
  }
}
