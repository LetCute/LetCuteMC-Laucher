/**
 * useLauncherJob.ts
 * React hook that manages Minecraft launch job state.
 * - Fetches initial state from Main via getLaunchState()
 * - Subscribes to batched launcher events via onLauncherEvent()
 * - Batches all events in a single setState call (no per-event re-renders)
 * - Ring buffer: keeps max 500 logs in Renderer
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  LaunchInput,
  LaunchJobState,
  LauncherEvent,
  LauncherLog,
} from '../../shared/types'
import { launcherClient } from '../services/launcherClient'

const MAX_RENDERER_LOGS = 500

const BUSY_STATUSES = new Set([
  'validating',
  'preparing',
  'checking_java',
  'checking_version',
  'downloading',
  'launching',
])

// ─── Event reducer (pure, no side effects) ───────────────────────────────────

function reduceEvents(state: LaunchJobState, events: LauncherEvent[]): LaunchJobState {
  let next = state

  for (const event of events) {
    switch (event.type) {
      case 'state':
        next = event.state
        break

      case 'progress':
        next = { ...next, status: event.progress.status, progress: event.progress }
        break

      case 'status':
        next = { ...next, status: event.status }
        break

      case 'logs': {
        const merged: LauncherLog[] = [...next.logs, ...event.logs].slice(-MAX_RENDERER_LOGS)
        next = { ...next, logs: merged }
        break
      }

      case 'finished':
        next = event.state
        break
    }
  }

  return next
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLauncherJob() {
  const [state, setState] = useState<LaunchJobState | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  // ── Load initial state & subscribe to events ────────────────────────────
  useEffect(() => {
    let mounted = true

    // Fetch initial state snapshot (guard: API may not be ready in dev hot-reload)
    launcherClient.getLaunchState()
      .then((initialState) => {
        if (mounted) setState(initialState)
      })
      .catch((err) => {
        console.warn('[useLauncherJob] getLaunchState failed (API not ready?):', err)
      })

    // Subscribe to batched events from Main
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = launcherClient.onLauncherEvent((events) => {
        setState((current) => {
          if (!current) return current
          return reduceEvents(current, events)
        })
      })
    } catch (err) {
      console.warn('[useLauncherJob] onLauncherEvent failed (API not ready?):', err)
    }

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────

  const startLaunch = useCallback(async (input: LaunchInput) => {
    setIsStarting(true)
    setLaunchError(null)
    try {
      const result = await launcherClient.startLaunch(input)
      if (!result.ok) {
        setLaunchError(result.message)
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định'
      setLaunchError(msg)
      return { ok: false, jobId: null, message: msg }
    } finally {
      setIsStarting(false)
    }
  }, [])

  const cancelLaunch = useCallback(async () => {
    try {
      return await launcherClient.cancelLaunch()
    } catch (err) {
      console.error('Cancel launch error:', err)
      return { ok: false, message: 'Lỗi khi hủy launch' }
    }
  }, [])

  const clearLogs = useCallback(async () => {
    try {
      await launcherClient.clearLaunchLogs()
      // Also clear logs in local state
      setState((prev) => prev ? { ...prev, logs: [] } : prev)
    } catch (err) {
      console.error('Clear logs error:', err)
    }
  }, [])

  // ── Derived state ─────────────────────────────────────────────────────────

  const isBusy = useMemo(() => {
    return state ? BUSY_STATUSES.has(state.status) : false
  }, [state?.status])

  const isRunning = state?.status === 'running'
  const isFailed  = state?.status === 'failed'
  const isClosed  = state?.status === 'closed'
  const isCancelled = state?.status === 'cancelled'

  return {
    state,
    isStarting,
    isBusy,
    isRunning,
    isFailed,
    isClosed,
    isCancelled,
    launchError,
    startLaunch,
    cancelLaunch,
    clearLogs,
  }
}
