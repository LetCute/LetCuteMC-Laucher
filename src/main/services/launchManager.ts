/**
 * launchManager.ts
 * Manages a single Minecraft launch job using a Worker Thread.
 * - Batches events and flushes to Renderer every 150ms (no IPC spam)
 * - Ring buffer: max 500 log entries
 * - Deduplicates consecutive identical logs
 */

import { BrowserWindow } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { createRequire } from 'node:module'
import {
  CancelLaunchResult,
  LaunchInput,
  LaunchJobProgress,
  LaunchJobState,
  LauncherEvent,
  LauncherLog,
  StartLaunchResult,
  WorkerOutputMessage,
} from '../../shared/types'
import { getAccountState, generateOfflineUuid } from './accountService'
import { writeErrorLog } from './errorLogService'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LOGS = 500
const FLUSH_INTERVAL_MS = 150

// ─── Module-level state ───────────────────────────────────────────────────────

let currentWorker: Worker | null = null
let currentState: LaunchJobState = createIdleState()
let eventQueue: LauncherEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
/** True while launcher is hidden because Minecraft is running */
let hiddenForGame = false

let currentProfileName = 'Unknown Profile'
let currentVersion = 'Unknown Version'

import { getProfiles } from './profileService.js'
import { setPlaying, setIdle } from './discordRpcService.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

/** Hide launcher completely (no window, no taskbar) while MC runs */
function hideLauncherForGame(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.hide()
  win.setSkipTaskbar(true)
  hiddenForGame = true
}

/** Restore launcher after MC exits */
function showLauncherAfterGame(): void {
  if (!hiddenForGame) return
  const win = getMainWindow()
  if (!win || win.isDestroyed()) {
    hiddenForGame = false
    return
  }
  win.setSkipTaskbar(false)
  win.show()
  win.focus()
  hiddenForGame = false
}

export function isGameRunning(): boolean {
  return currentState.status === 'running'
}

export function isLauncherHiddenForGame(): boolean {
  return hiddenForGame
}

function createIdleProgress(): LaunchJobProgress {
  return {
    status: 'idle',
    title: 'Sẵn sàng',
    message: 'Launcher sẵn sàng khởi động.',
    percent: 0,
    updatedAt: now(),
  }
}

function createIdleState(): LaunchJobState {
  return {
    jobId: null,
    status: 'idle',
    progress: createIdleProgress(),
    logs: [],
    startedAt: null,
    endedAt: null,
    error: null,
  }
}

function resolveWorkerPath(fileName: string): string {
  // Workers must load from asar.unpacked in packaged builds
  let p = path.join(__dirname, '../workers', fileName)
  if (p.includes(`${path.sep}app.asar${path.sep}`) || p.includes('/app.asar/')) {
    p = p
      .replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
      .replace('/app.asar/', '/app.asar.unpacked/')
  }
  return p
}

function getWorkerPath(): string {
  return resolveWorkerPath('launchWorker.js')
}

export function assertLaunchWorkerDependencies(): void {
  const workerPath = getWorkerPath()
  const requireFromWorker = createRequire(workerPath)
  const requiredPackages = [
    '@xmcl/core',
    '@xmcl/unzip',
    'yauzl'
  ]

  const missingPackages = requiredPackages.filter((packageName) => {
    try {
      requireFromWorker.resolve(packageName)
      return false
    } catch {
      return true
    }
  })

  if (missingPackages.length === 0) {
    return
  }

  throw new Error(
    `Launch worker dependencies are missing: ${missingPackages.join(', ')}`
  );
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function flushEvents(): void {
  if (flushTimer) return

  flushTimer = setTimeout(() => {
    flushTimer = null
    const win = getMainWindow()

    if (win && !win.isDestroyed() && eventQueue.length > 0) {
      const batch = eventQueue
      eventQueue = []
      win.webContents.send('launcher:event-batch', batch)
    } else {
      eventQueue = []
    }
  }, FLUSH_INTERVAL_MS)
}

function enqueueEvent(event: LauncherEvent): void {
  eventQueue.push(event)
  flushEvents()
}

function appendLog(log: LauncherLog): void {
  // Deduplicate: skip if last log has same level + message
  const latest = currentState.logs.at(-1)
  if (latest?.level === log.level && latest.message === log.message) return

  currentState.logs.push(log)

  // Ring buffer: keep last MAX_LOGS entries
  if (currentState.logs.length > MAX_LOGS) {
    currentState.logs = currentState.logs.slice(-MAX_LOGS)
  }
}

// ─── Worker message handler ───────────────────────────────────────────────────

function handleWorkerMessage(msg: WorkerOutputMessage): void {
  switch (msg.type) {
    case 'status': {
      currentState.status = msg.status
      enqueueEvent({ type: 'status', jobId: msg.jobId, status: msg.status })
      if (msg.status === 'running') {
        hideLauncherForGame()
        setPlaying(currentVersion, currentProfileName)
      }
      if (msg.status === 'closed' || msg.status === 'failed' || msg.status === 'cancelled') {
        showLauncherAfterGame()
        setIdle()
      }
      break
    }

    case 'progress': {
      currentState.progress = msg.progress
      currentState.status = msg.progress.status
      enqueueEvent({ type: 'progress', jobId: msg.jobId, progress: msg.progress })
      if (msg.progress.status === 'running') hideLauncherForGame()
      break
    }

    case 'log': {
      appendLog(msg.log)
      enqueueEvent({ type: 'logs', jobId: msg.jobId, logs: [msg.log] })
      break
    }

    case 'error': {
      currentState.error = msg.message
      currentState.status = 'failed'
      // worker already dumps to log_error
      showLauncherAfterGame()
      break
    }

    case 'finished': {
      currentState.endedAt = now()

      if (!msg.ok && currentState.status !== 'cancelled') {
        currentState.status = 'failed'
        currentState.error = msg.message
        // worker already dumps to log_error
      }

      // If the game closed normally, mark it
      if (msg.ok && currentState.status !== 'cancelled') {
        currentState.status = 'closed'
      }

      enqueueEvent({ type: 'finished', jobId: msg.jobId, state: currentState })
      showLauncherAfterGame()

      // Don't terminate here if game is 'running' — 'close' event already fired from worker
      currentWorker?.terminate().catch(() => {/* ignore */ })
      currentWorker = null
      break
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getLaunchState(): LaunchJobState {
  return { ...currentState, logs: [...currentState.logs] }
}

export async function startLaunchJob(input: LaunchInput): Promise<StartLaunchResult> {
  console.log('[LaunchManager] startLaunchJob', {
    profileId: input.profileId,
    version: input.version,
    gameDir: input.gameDir,
    javaPath: input.javaPath,
    authType: input.auth?.type,
  })

  try {
    const store = await getProfiles()
    const p = store.profiles.find(p => p.id === input.profileId)
    if (p) {
      currentProfileName = p.name
    }
  } catch (err) {
    console.error('Failed to get profile name for RPC:', err)
  }
  currentVersion = input.version

  // Deduplicate and block if prepare worker is running for the same profile
  const { isPrepareActiveForProfile } = await import('./prepareGameService.js')
  if (isPrepareActiveForProfile(input.profileId)) {
    console.warn('[LaunchManager] Rejected: prepare worker is active for profile', input.profileId)
    return {
      ok: false,
      jobId: null,
      message: 'Phiên bản game đang trong tiến trình chuẩn bị tải tệp tin.',
    }
  }

  const busy = ['validating', 'preparing', 'checking_java', 'checking_version', 'downloading', 'launching', 'running']
  if (currentWorker && busy.includes(currentState.status)) {
    console.warn('[LaunchManager] Rejected: busy status=', currentState.status)
    return {
      ok: false,
      jobId: currentState.jobId,
      message: 'Một game đang chạy hoặc đang khởi động.',
    }
  }

  // Terminate stale worker if any
  if (currentWorker) {
    console.log('[LaunchManager] Terminating stale worker')
    await currentWorker.terminate().catch(() => {/* ignore */ })
    currentWorker = null
  }

  const jobId = crypto.randomUUID()
  console.log('[LaunchManager] New jobId=', jobId)

  currentState = {
    jobId,
    status: 'validating',
    progress: {
      status: 'validating',
      title: 'Bắt đầu khởi động',
      message: 'Đang kiểm tra thư mục game...',
      percent: 1,
      updatedAt: now(),
    },
    logs: [],
    startedAt: now(),
    endedAt: null,
    error: null,
  }

  // Broadcast initial state immediately
  enqueueEvent({ type: 'state', state: getLaunchState() })

  // Ensure game directory structure exists before starting the job
  try {
    const { ensureGameDirectoryStructure } = await import('./storageService.js')
    await ensureGameDirectoryStructure(input.gameDir)
  } catch (err) {
    const errMsg = (err as Error).message
    console.error('[LaunchManager] ensureGameDirectoryStructure failed:', errMsg)
    currentState.status = 'failed'
    currentState.error = errMsg
    enqueueEvent({ type: 'state', state: getLaunchState() })
    return {
      ok: false,
      jobId,
      message: errMsg,
    }
  }

  // Create worker
  const workerPath = getWorkerPath()
  console.log('[LaunchManager] Spawning launchWorker at', workerPath)
  
  // Assert dependencies exist
  assertLaunchWorkerDependencies()

  currentWorker = new Worker(workerPath)

  currentWorker.on('message', (msg: WorkerOutputMessage) => {
    handleWorkerMessage(msg)
  })

  currentWorker.on('error', (err) => {
    currentState.status = 'failed'
    currentState.error = err.message
    currentState.endedAt = now()
    void writeErrorLog('launchManager:worker', err, { jobId, status: currentState.status })
    enqueueEvent({ type: 'finished', jobId, state: getLaunchState() })
    currentWorker = null
  })

  currentWorker.on('exit', (code) => {
    if (code !== 0 && currentState.status !== 'failed' && currentState.status !== 'cancelled' && currentState.status !== 'closed') {
      currentState.status = 'failed'
      currentState.error = `Launch worker exited with code ${code}.`
      currentState.endedAt = now()
      void writeErrorLog('launchManager:workerExit', new Error(`exit ${code}`), { jobId, code, status: currentState.status })
    }
    currentWorker = null
  })

  // Refresh token on launch if using microsoft auth (not on app load)
  if (input.auth && input.auth.type === 'microsoft') {
    try {
      const { refreshMicrosoftAccountToken } = await import('./accountService')
      const accountState = await refreshMicrosoftAccountToken()
      const activeAccount = accountState.accounts.find(a => a.id === accountState.activeAccountId && a.type === 'microsoft')
      if (activeAccount) {
        input.auth.accessToken = activeAccount.accessToken || ''
        input.auth.uuid = activeAccount.uuid
        input.auth.username = activeAccount.username
        input.auth.expiresAt = activeAccount.expiresAt
      }
    } catch (error) {
      console.error('Failed to pre-refresh Microsoft token for launch:', error)
    }
  } else if (input.auth && input.auth.type === 'virtual') {
    input.auth.uuid = generateOfflineUuid(input.auth.username)
  }

  // Send start message to worker
  currentWorker.postMessage({ type: 'start', jobId, input })

  return { ok: true, jobId, message: 'Launch job started.' }
}

// Catch-all for startLaunchJob unexpected errors
// (wrap in try if needed at call site; here we just export helper)
export async function safeStartLaunchJob(input: LaunchInput): Promise<StartLaunchResult> {
  try {
    return await startLaunchJob(input)
  } catch (err) {
    await writeErrorLog('launchManager:startLaunchJob', err, { profileId: input.profileId, version: input.version })
    return { ok: false, jobId: null, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function cancelLaunchJob(): Promise<CancelLaunchResult> {
  if (!currentWorker || !currentState.jobId) {
    return { ok: false, message: 'Không có launch job nào đang chạy.' }
  }
  showLauncherAfterGame()

  currentWorker.postMessage({ type: 'cancel', jobId: currentState.jobId })

  currentState.status = 'cancelled'
  currentState.endedAt = now()

  enqueueEvent({ type: 'state', state: getLaunchState() })

  await currentWorker.terminate().catch(() => {/* ignore */ })
  currentWorker = null

  return { ok: true, message: 'Launch job đã bị hủy.' }
}

export function clearJobLogs(): boolean {
  currentState.logs = []
  enqueueEvent({ type: 'state', state: getLaunchState() })
  return true
}
