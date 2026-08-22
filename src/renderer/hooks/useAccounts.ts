import { useState, useEffect, useMemo, useCallback } from 'react'
import type { AccountState, MicrosoftAccount } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useToast } from '../components/ui/Toast'

interface UseAccountsOptions {
  initialState?: AccountState
  onStateChange?: (state: AccountState) => void
  appendLog?: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
}

export function useAccounts(options?: UseAccountsOptions) {
  const { showToast } = useToast()
  const [accountState, setInternalAccountState] = useState<AccountState>(
    options?.initialState || {
      activeAccountId: null,
      accounts: [],
    }
  )
  const [loading, setLoading] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Synchronize when external initialState changes
  useEffect(() => {
    if (options?.initialState) {
      setInternalAccountState(options.initialState)
    }
  }, [options?.initialState])

  const setAccountState = useCallback(
    (newState: AccountState) => {
      setInternalAccountState(newState)
      options?.onStateChange?.(newState)
    },
    [options]
  )

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const state = await launcherClient.getAccountState()
      setAccountState(state)
      return state
    } catch (e) {
      console.error('Failed to load account state:', e)
    } finally {
      setLoading(false)
    }
  }, [setAccountState])

  const selectAccount = useCallback(
    async (accountId: string) => {
      try {
        const updated = await launcherClient.selectAccount(accountId)
        setAccountState(updated)
        const acc = updated.accounts.find((a) => a.id === accountId)
        if (acc) {
          options?.appendLog?.('info', `Đã chuyển sang tài khoản: ${acc.username}`)
          showToast('success', `Đã chuyển sang tài khoản "${acc.username}"`)
        }
        return updated
      } catch (e: any) {
        showToast('error', e?.message || 'Không thể chọn tài khoản này.')
      }
    },
    [setAccountState, options, showToast]
  )

  const removeAccount = useCallback(
    async (accountId: string) => {
      try {
        const acc = accountState.accounts.find((a) => a.id === accountId)
        const updated = await launcherClient.removeAccount(accountId)
        setAccountState(updated)
        if (acc) {
          options?.appendLog?.('info', `Đã xóa tài khoản: ${acc.username}`)
          showToast('info', `Đã xóa tài khoản "${acc.username}"`)
        }
        return updated
      } catch (e: any) {
        showToast('error', e?.message || 'Không thể xóa tài khoản.')
      }
    },
    [accountState.accounts, setAccountState, options, showToast]
  )

  const addLocalAccount = useCallback(
    async (username: string) => {
      const trimmed = username.trim()
      if (!trimmed) {
        showToast('error', 'Vui lòng nhập tên người chơi.')
        return
      }
      try {
        const updated = await launcherClient.addLocalAccount(trimmed)
        setAccountState(updated)
        options?.appendLog?.('success', `Đã thêm tài khoản Offline: ${trimmed}`)
        showToast('success', `Đã tạo tài khoản Offline "${trimmed}" thành công!`)
        return updated
      } catch (e: any) {
        showToast('error', e?.message || 'Không thể tạo tài khoản Offline.')
      }
    },
    [setAccountState, options, showToast]
  )

  const loginMicrosoft = useCallback(async () => {
    setIsLoggingIn(true)
    try {
      options?.appendLog?.('info', 'Bắt đầu đăng nhập tài khoản Microsoft...')
      const msAccount: MicrosoftAccount = await launcherClient.loginMicrosoft()
      const updated = await launcherClient.saveMicrosoftAccount(msAccount)
      setAccountState(updated)
      options?.appendLog?.('success', `Đăng nhập Microsoft thành công: ${msAccount.username}`)
      showToast('success', `Đăng nhập Microsoft thành công: ${msAccount.username}`)
      return updated
    } catch (e: any) {
      console.error('Microsoft login failed:', e)
      options?.appendLog?.('error', `Đăng nhập Microsoft thất bại: ${e?.message || e}`)
      showToast('error', e?.message || 'Đăng nhập Microsoft thất bại.')
    } finally {
      setIsLoggingIn(false)
    }
  }, [setAccountState, options, showToast])

  const renameAccount = useCallback(
    async (accountId: string, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed) return
      try {
        const updated = await launcherClient.renameAccountLocally(accountId, trimmed)
        setAccountState(updated)
        showToast('success', `Đã đổi tên thành "${trimmed}"`)
        return updated
      } catch (e: any) {
        showToast('error', e?.message || 'Không thể đổi tên tài khoản.')
      }
    },
    [setAccountState, showToast]
  )

  const refreshMicrosoftAccount = useCallback(
    async (accountId?: string) => {
      try {
        const updated = await launcherClient.refreshMicrosoftAccount(accountId)
        setAccountState(updated)
        return updated
      } catch (e) {
        console.error('Failed to refresh Microsoft account:', e)
      }
    },
    [setAccountState]
  )

  const accounts = useMemo(() => accountState?.accounts || [], [accountState])

  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountState?.activeAccountId) || null
  }, [accounts, accountState?.activeAccountId])

  const displayUsername = activeAccount?.username || 'Player'
  const isVirtual = !activeAccount || activeAccount.type === 'local'
  const hasMicrosoftAccount = activeAccount?.type === 'microsoft'

  const getAccountAvatar = useCallback((account: any): { url: string; isFullSkin: boolean } => {
    if (!account) return { url: './assets/steve.png', isFullSkin: false }
    if (account.skinUrl) {
      return { url: account.skinUrl, isFullSkin: true }
    }
    return {
      url:
        account.type === 'microsoft'
          ? `https://minotar.net/helm/${account.username}/64.png`
          : './assets/steve.png',
      isFullSkin: false,
    }
  }, [])

  return {
    accountState,
    setAccountState,
    accounts,
    activeAccount,
    activeAccountId: accountState?.activeAccountId,
    displayUsername,
    isVirtual,
    hasMicrosoftAccount,
    loading,
    isLoggingIn,
    fetchAccounts,
    selectAccount,
    removeAccount,
    addLocalAccount,
    loginMicrosoft,
    renameAccount,
    refreshMicrosoftAccount,
    getAccountAvatar,
  }
}
