import { useEffect, useState, useCallback } from 'react'
import type { LauncherProfile, LauncherSettings, PrepareGameProgress, PreparedProfileState } from '../../shared/types'
import { launcherClient } from '../services/launcherClient'

export function usePrepareGame(
  activeProfile: LauncherProfile | null,
  settings: LauncherSettings
) {
  const [prepareState, setPrepareState] = useState<PreparedProfileState | null>(null)
  const [progress, setProgress] = useState<PrepareGameProgress | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

  // 1. Check if profile is ready on active profile change
  const checkStatus = useCallback(async () => {
    if (!activeProfile) {
      setPrepareState(null)
      return
    }
    try {
      const state = await launcherClient.checkPreparedProfile(activeProfile, settings)
      setPrepareState(state)
    } catch (e) {
      console.error('[Prepare Hook] Check prepared profile failed:', e)
    }
  }, [activeProfile?.id, activeProfile?.minecraftVersion, settings])

  useEffect(() => {
    void checkStatus()
  }, [checkStatus])

  // 2. Listen to prepare progress
  useEffect(() => {
    const unsubscribe = launcherClient.onPrepareGameProgress((prog) => {
      if (activeProfile && prog.profileId === activeProfile.id) {
        setProgress(prog)
        if (prog.status === 'downloading' || prog.status === 'checking') {
          setIsPreparing(true)
        } else if (prog.status === 'ready' || prog.status === 'failed' || prog.status === 'cancelled') {
          setIsPreparing(false)
          void checkStatus() // refetch final check state
        }
      }
    })
    return () => unsubscribe()
  }, [activeProfile?.id, checkStatus])

  // 3. Start background prepare
  const startPrepare = useCallback(async (forceRepair?: boolean) => {
    if (!activeProfile) return
    setIsPreparing(true)
    setProgress({
      profileId: activeProfile.id,
      version: activeProfile.minecraftVersion,
      status: 'checking',
      title: forceRepair ? 'Sửa lỗi game' : 'Khởi động',
      message: forceRepair ? 'Đang chuẩn bị quét toàn bộ tệp tin game...' : 'Bắt đầu kiểm tra cấu hình game...',
      percent: 0,
      updatedAt: new Date().toISOString(),
    })
    try {
      await launcherClient.prepareGame(activeProfile, settings, forceRepair)
    } catch (e) {
      console.error('[Prepare Hook] Start prepare failed:', e)
      setIsPreparing(false)
    }
  }, [activeProfile, settings])

  // 4. Cancel prepare
  const cancelPrepare = useCallback(async () => {
    try {
      await launcherClient.cancelPrepareGame()
      setIsPreparing(false)
      setProgress(null)
      void checkStatus()
    } catch (e) {
      console.error('[Prepare Hook] Cancel prepare failed:', e)
    }
  }, [checkStatus])

  // 5. Auto prepare if enabled in settings (longer debounce; low-end skips via effective settings)
  useEffect(() => {
    if (!activeProfile || !settings.enableAutoPrepareGame) return

    // Debounce 1500ms — avoid thrashing UI on profile switch / weak machines
    const timer = setTimeout(async () => {
      const state = await launcherClient.checkPreparedProfile(activeProfile, settings)
      if (!state.isReady && !isPreparing) {
        void startPrepare()
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [activeProfile?.id, activeProfile?.minecraftVersion, settings.enableAutoPrepareGame, startPrepare])

  return {
    prepareState,
    progress,
    isPreparing,
    startPrepare,
    cancelPrepare,
    checkStatus,
  }
}
