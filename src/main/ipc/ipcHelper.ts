import { ipcMain } from 'electron'
import type { ServiceResponse } from '../../shared/types'

/**
 * Type-safe IPC Handler wrapper with consistent error reporting.
 * Catches errors, logs them, and re-throws with a clean message.
 * Use this for handlers where the Renderer already expects raw values or throws.
 */
export function handleIpc<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs) => {
    try {
      return await handler(...args)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown IPC error'
      console.error(`[IPC Error] Channel "${channel}":`, error)
      throw new Error(message)
    }
  })
}

/**
 * Safe IPC Handler that wraps results in ServiceResponse<T>.
 * Never throws — always returns { success, data?, error? }.
 * Use this for new handlers where the Renderer expects ServiceResponse.
 *
 * @example
 *   handleIpcSafe('profile:create', async (input) => {
 *     const profile = await createProfile(input)
 *     return profile  // auto-wrapped as { success: true, data: profile }
 *   })
 */
export function handleIpcSafe<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs): Promise<ServiceResponse<TResult>> => {
    try {
      const result = await handler(...args)
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown IPC error'
      const code = (error as any)?.code as string | undefined
      console.error(`[IPC Error] Channel "${channel}":`, message)
      return { success: false, error: message, code }
    }
  })
}

/**
 * Throttle helper for IPC event emitters (worker progress, logs).
 * Returns a function that only forwards calls at most once per `intervalMs`.
 */
export function createIpcThrottle<T extends (...args: any[]) => void>(
  fn: T,
  intervalMs: number = 120
): T {
  let lastCall = 0
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args
    const now = Date.now()
    const elapsed = now - lastCall

    if (elapsed >= intervalMs) {
      lastCall = now
      fn(...args)
      return
    }

    // Schedule trailing call to ensure the last value is always delivered
    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        lastCall = Date.now()
        if (lastArgs) fn(...lastArgs)
      }, intervalMs - elapsed)
    }
  }) as T

  return throttled
}
