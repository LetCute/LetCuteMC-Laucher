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
import { utilityProcess, type UtilityProcess } from 'electron'
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
} from '../../../shared/types'
import { getAccountState, generateOfflineUuid } from '../auth/accountService'
import { writeErrorLog } from '../media/errorLogService'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LOGS = 500
const FLUSH_INTERVAL_MS = 150

// ─── Module-level state ───────────────────────────────────────────────────────

let currentWorker: UtilityProcess | null = null
let currentState: LaunchJobState = createIdleState()
let eventQueue: LauncherEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let currentVersion: string = ''
let currentProfileName: string = ''
let currentProfileId: string = ''
let currentGameDir: string = ''
let gameStartTime: number | null = null
let activeJobId: string | null = null
/** True while launcher is hidden because Minecraft is running */
let hiddenForGame = false


import { getProfiles } from '../profile/profileService.js'
import { eventBus } from '../eventBus.js'
import { taskManagerService } from '../system/taskManagerService.js'

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

let cachedLaunchWorkerPath: string | null = null

function resolveWorkerPath(fileName: string): string {
  if (cachedLaunchWorkerPath) return cachedLaunchWorkerPath
  // UtilityProcess supports asar natively.
  // When compiled, launchManager.js is in dist-electron/main/services/launcher/,
  // so worker is at dist-electron/main/workers/ (../../workers)
  const candidate1 = path.join(__dirname, '../../workers', fileName)
  const candidate2 = path.join(__dirname, '../workers', fileName)
  try {
    const fsSync = require('node:fs')
    if (fsSync.existsSync(candidate1)) {
      cachedLaunchWorkerPath = candidate1
      return candidate1
    }
    if (fsSync.existsSync(candidate2)) {
      cachedLaunchWorkerPath = candidate2
      return candidate2
    }
  } catch {}
  cachedLaunchWorkerPath = candidate1
  return candidate1
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
        if (activeJobId) {
          taskManagerService.completeTask(activeJobId, 'Game đang chạy')
          activeJobId = null
        }
      }
      if (msg.status === 'closed' || msg.status === 'failed' || msg.status === 'cancelled') {
        showLauncherAfterGame()
      }
      break
    }

    case 'progress': {
      currentState.progress = msg.progress
      currentState.status = msg.progress.status
      enqueueEvent({ type: 'progress', jobId: msg.jobId, progress: msg.progress })
      if (activeJobId) {
        taskManagerService.updateTaskProgress(activeJobId, msg.progress.percent || 0, msg.progress.message || msg.progress.title)
      }
      if (msg.progress.status === 'running') {
        gameStartTime = Date.now()
        hideLauncherForGame()
        eventBus.emit('game:started', {
          jobId: msg.jobId,
          profileId: currentProfileId,
          profileName: currentProfileName,
          versionId: currentVersion,
          gameDir: currentGameDir,
        })
        if (activeJobId) {
          taskManagerService.completeTask(activeJobId, 'Game đang chạy')
          activeJobId = null
        }
      }
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
      currentState.endedAt = now()
      if (activeJobId) {
        taskManagerService.failTask(activeJobId, msg.message)
        activeJobId = null
      }
      enqueueEvent({ type: 'status', jobId: msg.jobId, status: 'failed' })
      enqueueEvent({ type: 'finished', jobId: msg.jobId, state: currentState })
      // worker already dumps to log_error
      showLauncherAfterGame()
      break
    }

    case 'finished': {
      currentState.endedAt = now()

      let durationMs: number | undefined
      if (gameStartTime) {
        durationMs = Date.now() - gameStartTime
        gameStartTime = null
      }

      if (!msg.ok && currentState.status !== 'cancelled') {
        currentState.status = 'failed'
        currentState.error = msg.message
        eventBus.emit('game:crashed', {
          jobId: msg.jobId,
          profileId: currentProfileId,
          profileName: currentProfileName,
          versionId: currentVersion,
          gameDir: currentGameDir,
          error: msg.message,
        })
      } else {
        if (currentState.status !== 'cancelled') {
          currentState.status = 'closed'
        }
        eventBus.emit('game:exited', {
          jobId: msg.jobId,
          profileId: currentProfileId,
          profileName: currentProfileName,
          versionId: currentVersion,
          gameDir: currentGameDir,
          code: 0,
          durationMs,
        })
      }

      if (activeJobId) {
        if (msg.ok) {
          taskManagerService.completeTask(activeJobId, 'Hoàn tất khởi động')
        } else {
          taskManagerService.failTask(activeJobId, msg.message)
        }
        activeJobId = null
      }

      enqueueEvent({ type: 'finished', jobId: msg.jobId, state: currentState })
      showLauncherAfterGame()

      // Don't terminate here if game is 'running' — 'close' event already fired from worker
      currentWorker?.kill()
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
  currentProfileId = input.profileId
  currentGameDir = input.gameDir || ''

  // Deduplicate and block if prepare worker is running for the same profile
  const { isPrepareActiveForProfile } = await import('./prepareGameService.js')
  if (isPrepareActiveForProfile(input.profileId)) {
    return {
      ok: false,
      jobId: null,
      message: 'Phiên bản game đang trong tiến trình chuẩn bị tải tệp tin.',
    }
  }

  const busy = ['validating', 'preparing', 'checking_java', 'checking_version', 'downloading', 'launching', 'running']
  if (currentWorker && busy.includes(currentState.status)) {
    return {
      ok: false,
      jobId: currentState.jobId,
      message: 'Một game đang chạy hoặc đang khởi động.',
    }
  }

  // Terminate stale worker if any
  if (currentWorker) {
    currentWorker.kill()
    currentWorker = null
  }

  const jobId = crypto.randomUUID()

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

  activeJobId = taskManagerService.createTask(`Khởi động: ${currentProfileName || input.version}`)

  // Broadcast initial state immediately
  enqueueEvent({ type: 'state', state: getLaunchState() })

  // Ensure game directory structure exists before starting the job
  try {
    const { ensureGameDirectoryStructure } = await import('../system/storageService.js')
    await ensureGameDirectoryStructure(input.gameDir)
  } catch (err) {
    const errMsg = (err as Error).message
    console.error('[LaunchManager] ensureGameDirectoryStructure failed:', errMsg)
    currentState.status = 'failed'
    currentState.error = errMsg
    if (activeJobId) {
      taskManagerService.failTask(activeJobId, errMsg)
      activeJobId = null
    }
    enqueueEvent({ type: 'state', state: getLaunchState() })
    return {
      ok: false,
      jobId,
      message: errMsg,
    }
  }

  // Inject top servers for this version automatically
  try {
    const { serverListService } = await import('../media/serverListService.js')
    // Run and wait to ensure servers.dat is written before game launch
    await serverListService.injectServersToProfile(input.profileId, 1, input.version)
      .catch((err: any) => console.error('[LaunchManager] Failed to inject servers:', err))
  } catch (err) {
    console.error('[LaunchManager] Failed to load serverListService:', err)
  }

  // Create worker
  const workerPath = getWorkerPath()

  // Assert dependencies exist
  assertLaunchWorkerDependencies()

  currentWorker = utilityProcess.fork(workerPath)

  currentWorker.on('message', (e: any) => {
    handleWorkerMessage(e as WorkerOutputMessage)
  })

  currentWorker.on('error', (err) => {
    currentState.status = 'failed'
    currentState.error = err
    currentState.endedAt = now()
    if (activeJobId) {
      taskManagerService.failTask(activeJobId, err)
      activeJobId = null
    }
    eventBus.emit('game:crashed', {
      jobId,
      profileId: currentProfileId,
      profileName: currentProfileName,
      versionId: currentVersion,
      gameDir: currentGameDir,
      error: err,
    })
    void writeErrorLog('launchManager:worker', new Error(err), { jobId, status: currentState.status })
    enqueueEvent({ type: 'finished', jobId, state: getLaunchState() })
    currentWorker = null
  })

  currentWorker.on('exit', (code) => {
    if (code !== 0 && currentState.status !== 'failed' && currentState.status !== 'cancelled' && currentState.status !== 'closed') {
      currentState.status = 'failed'
      currentState.error = `Launch worker exited with code ${code}.`
      currentState.endedAt = now()
      if (activeJobId) {
        taskManagerService.failTask(activeJobId, currentState.error)
        activeJobId = null
      }
      eventBus.emit('game:crashed', {
        jobId,
        profileId: currentProfileId,
        profileName: currentProfileName,
        versionId: currentVersion,
        gameDir: currentGameDir,
        error: currentState.error,
        exitCode: code,
      })
      void writeErrorLog('launchManager:workerExit', new Error(`exit ${code}`), { jobId, code, status: currentState.status })
    }
    currentWorker = null
  })

  // Refresh token on launch if using microsoft auth (not on app load)
  if (input.auth && input.auth.type === 'microsoft') {
    try {
      const { refreshMicrosoftAccountToken } = await import('../auth/accountService')
      const accountState = await refreshMicrosoftAccountToken()
      const activeAccount = accountState.accounts.find((a: any) => a.id === accountState.activeAccountId && a.type === 'microsoft')
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
    // await writeErrorLog('launchManager:startLaunchJob', err, { profileId: input.profileId, version: input.version })
    return { ok: false, jobId: null, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function cancelLaunchJob(): Promise<CancelLaunchResult> {
  if (!currentWorker || !currentState.jobId) {
    return { ok: false, message: 'Không có launch job nào đang chạy.' }
  }
  showLauncherAfterGame()
  if (activeJobId) {
    taskManagerService.failTask(activeJobId, 'Đã hủy')
    activeJobId = null
  }

  currentWorker.postMessage({ type: 'cancel', jobId: currentState.jobId })

  currentState.status = 'cancelled'
  currentState.endedAt = now()

  enqueueEvent({ type: 'state', state: getLaunchState() })

  currentWorker.kill()
  currentWorker = null

  return { ok: true, message: 'Launch job đã bị hủy.' }
}

export function clearJobLogs(): boolean {
  currentState.logs = []
  enqueueEvent({ type: 'state', state: getLaunchState() })
  return true
}

