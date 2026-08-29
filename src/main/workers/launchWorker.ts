/**
 * launchWorker.ts
 * Runs minecraft-launcher-core in a Worker Thread so the Electron Main
 * Process and UI Renderer are never blocked by the heavy launch I/O.
 */


import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import type {
  LauncherLog,
  LaunchJobProgress,
  LaunchStatus,
  WorkerInputMessage,
  WorkerOutputMessage,
  LaunchInput,
  AuthSession,
} from '../../shared/types'
type ResolvedVersion = import('@xmcl/core').ResolvedVersion
import { ensureJavaRuntime } from '../services/launcher/javaResolver'
import { diagnoseAndRecoverCrash } from '../services/launcher/crashDiagnostic'
import { getSettings } from '../services/system/settingsService'
import { writeErrorLog } from '../services/media/errorLogService'
import { autoFixModDependencies, inspectModDependencies, detectLoaderFromVersion } from '../services/content/modDependencyService'
import { initGlobalHttpDispatcher } from '../services/system/httpAgent'

const parentPort = process.parentPort
if (!parentPort) {
  throw new Error('launchWorker must run inside a utilityProcess.')
}

let activeJobId: string | null = null
let isCancelled = false
let latestProgressKey = ''

function now(): string {
  return new Date().toISOString()
}

function createLog(level: LauncherLog['level'], message: string): LauncherLog {
  return { id: crypto.randomUUID(), level, message, createdAt: now() }
}

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

function postMsg(message: WorkerOutputMessage): void {
  parentPort!.postMessage(message)
}

function postLog(jobId: string, level: LauncherLog['level'], message: string): void {
  postMsg({ type: 'log', jobId, log: createLog(level, message) })
}

function postStatus(jobId: string, status: LaunchStatus): void {
  postMsg({ type: 'status', jobId, status })
}

function postProgress(jobId: string, progress: Omit<LaunchJobProgress, 'updatedAt'>): void {
  const key = `${progress.status}:${Math.floor(progress.percent)}:${progress.message}`
  if (key === latestProgressKey) return
  latestProgressKey = key
  postMsg({
    type: 'progress',
    jobId,
    progress: { ...progress, updatedAt: now() },
  })
}

function assertNotCancelled(): void {
  if (isCancelled) throw new Error('LAUNCH_CANCELLED')
}

function validateRealLaunchAuth(auth: AuthSession | null | undefined): string | null {
  if (!auth) return 'Bạn cần thông tin tài khoản để chơi.'
  if (auth.type === 'virtual') {
    if (!auth.username) return 'Tên người chơi Local không được rỗng.'
    return null
  }
  if (auth.type !== 'microsoft') return 'Phiên đăng nhập không hợp lệ.'
  if (!auth.username || !auth.uuid || !auth.accessToken) return 'Phiên Microsoft auth bị thiếu thông tin.'
  return null
}

function validateLaunchInput(input: LaunchInput): string | null {
  if (!input.profileId) return 'Thiếu profile ID.'
  if (!input.version) return 'Chưa chọn Minecraft version.'
  if (!input.gameDir) return 'Chưa có thư mục .minecraft.'
  if (input.minMemoryMb < 512) return 'RAM tối thiểu phải từ 512 MB.'
  if (input.maxMemoryMb < input.minMemoryMb) return 'RAM tối đa không thể nhỏ hơn RAM tối thiểu.'
  return null
}

async function startLaunch(jobId: string, input: LaunchInput): Promise<void> {
  activeJobId = jobId
  isCancelled = false
  initGlobalHttpDispatcher()

  try {
    const inputErr = validateLaunchInput(input)
    if (inputErr) {
      postLog(jobId, 'error', `[Validation] ${inputErr}`)
      postStatus(jobId, 'failed')
      postProgress(jobId, { status: 'failed', title: 'Lỗi khởi động', message: inputErr, percent: 100 })
      return
    }

    const settings = await getSettings()
    const resourcePath = input.resourcePath || settings.minecraftDirectory || input.gameDir
    const auth = input.auth

    const authErr = validateRealLaunchAuth(auth)
    if (authErr) {
      postLog(jobId, 'error', `[Auth] ${authErr}`)
      postStatus(jobId, 'failed')
      postProgress(jobId, { status: 'failed', title: 'Lỗi tài khoản', message: authErr, percent: 100 })
      return
    }

    postStatus(jobId, 'preparing')
    postProgress(jobId, { status: 'preparing', title: 'Chuẩn bị khởi động', message: 'Đang kiểm tra tài nguyên...', percent: 10 })

    // 1. Resolve Java Runtime
    assertNotCancelled()
    postProgress(jobId, { status: 'preparing', title: 'Kiểm tra Java', message: 'Đang xác thực môi trường Java...', percent: 25 })
    const javaResult = await ensureJavaRuntime({
      mcVersion: input.version,
      customJavaPath: input.javaPath,
      log: (level, msg) => postLog(jobId, level, msg),
    })

    // 2. Mod dependency check
    assertNotCancelled()
    const modsDir = path.join(input.gameDir, 'mods')
    if (await pathExists(modsDir)) {
      try {
        const loader = detectLoaderFromVersion(input.version)
        const inspection = await inspectModDependencies(input.gameDir, input.version, loader)
        if (inspection.missingDependencies.length > 0) {
          postLog(jobId, 'warn', `Phát hiện ${inspection.missingDependencies.length} mod còn thiếu dependency. Đang tự tải bổ sung...`)
          await autoFixModDependencies(input.gameDir, input.version, loader, (msg) => postLog(jobId, 'info', msg))
        }
      } catch (modErr) {
        postLog(jobId, 'warn', `Bỏ qua kiểm tra mod: ${modErr instanceof Error ? modErr.message : String(modErr)}`)
      }
    }

    // 3. Resolve Version & JVM flags
    assertNotCancelled()
    const versionInGameDir = path.join(input.gameDir, 'versions', input.version, `${input.version}.json`)
    const parseRoot = (await pathExists(versionInGameDir)) ? input.gameDir : resourcePath

    const { Version, launch: xmclLaunch } = await import('@xmcl/core')
    const { optimizerService } = await import('../services/system/optimizerService')
    const resolved: ResolvedVersion = await Version.parse(parseRoot, input.version)

    // Filter incompatible JVM flags
    if (javaResult.majorVersion < 24 && (resolved as any).arguments?.jvm) {
      ;(resolved as any).arguments.jvm = (resolved as any).arguments.jvm.filter((arg: any) => {
        if (typeof arg === 'string') return !arg.includes('UseCompactObjectHeaders')
        if (arg && typeof arg === 'object' && Array.isArray(arg.value)) {
          arg.value = arg.value.filter((v: string) => !v.includes('UseCompactObjectHeaders'))
          return arg.value.length > 0
        }
        return true
      })
    }

    // 4. Launch game process
    assertNotCancelled()
    postStatus(jobId, 'launching')
    postProgress(jobId, { status: 'launching', title: 'Khởi động Minecraft', message: 'Đang mở Minecraft...', percent: 90 })

    const jvmPreset = input.jvmPreset || settings.jvmPreset || 'aikar'
    const customArgs = optimizerService.buildOptimizedJvmArgs({
      preset: jvmPreset,
      customJvmArgs: input.customJvmArgs ?? settings.customJvmArgs ?? '',
      javaMajorVersion: javaResult.majorVersion,
      maxRamMb: input.maxMemoryMb,
    })
    const gpuEnv = optimizerService.getGpuEnvironmentVariables(input.enableDedicatedGpu ?? settings.enableDedicatedGpu ?? true)

    const child = await xmclLaunch({
      gamePath: input.gameDir,
      resourcePath,
      javaPath: javaResult.javaPath,
      version: resolved,
      accessToken: auth!.accessToken,
      gameProfile: { name: auth!.username, id: auth!.uuid },
      minMemory: input.minMemoryMb,
      maxMemory: input.maxMemoryMb,
      extraJVMArgs: customArgs,
      server: input.serverAddress ? { ip: input.serverAddress } : undefined,
      spawn: (command: string, args?: readonly string[], options?: any) => {
        let filteredArgs = (args || []) as string[]
        if (javaResult.majorVersion <= 21) {
          filteredArgs = filteredArgs.filter((a) => a !== '--sun-misc-unsafe-memory-access=allow')
        }
        return spawn(command, filteredArgs, { ...options, env: { ...(options?.env || process.env), ...gpuEnv } })
      },
    })

    if (child.pid) {
      postLog(jobId, 'info', `Minecraft process started with PID ${child.pid}.`)
      optimizerService.applyGameProcessBoost(child.pid)
    }

    const accumulatedLogs: string[] = []
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8').trim()
      if (text) {
        postLog(jobId, 'info', text)
        accumulatedLogs.push(text)
        if (accumulatedLogs.length > 200) accumulatedLogs.shift()
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8').trim()
      if (text) {
        postLog(jobId, 'error', text)
        accumulatedLogs.push(text)
        if (accumulatedLogs.length > 200) accumulatedLogs.shift()
      }
    })

    child.on('exit', async (code) => {
      const ok = code === 0 || code === null
      if (!ok) {
        const recovery = await diagnoseAndRecoverCrash(input.gameDir, accumulatedLogs)
        if (recovery) {
          postLog(jobId, 'warn', `[AutoRecovery] ${recovery.summary}`)
        }
        postStatus(jobId, 'failed')
        postProgress(jobId, { status: 'failed', title: 'Minecraft bị đóng đột ngột', message: `Tiến trình kết thúc với mã ${code}.`, percent: 100 })
        postMsg({ type: 'finished', jobId, ok: false, message: `Minecraft crash với mã thoát ${code}` })
      } else {
        postStatus(jobId, 'idle')
        postProgress(jobId, { status: 'idle', title: 'Sẵn sàng', message: 'Minecraft đã kết thúc bình thường.', percent: 0 })
        postMsg({ type: 'finished', jobId, ok: true, message: 'Game kết thúc bình thường' })
      }
      activeJobId = null
    })

    postStatus(jobId, 'running')
    postProgress(jobId, { status: 'running', title: 'Minecraft đang chạy', message: 'Chúc bạn chơi game vui vẻ!', percent: 100 })
  } catch (error) {
    if ((error as Error)?.message === 'LAUNCH_CANCELLED' || isCancelled) {
      postLog(jobId, 'info', 'Khởi động game đã bị huỷ.')
      postStatus(jobId, 'cancelled')
      postMsg({ type: 'finished', jobId, ok: false, message: 'Launch cancelled' })
      return
    }
    const errMsg = error instanceof Error ? error.message : String(error)
    postLog(jobId, 'error', `Khởi động thất bại: ${errMsg}`)
    void writeErrorLog('launchWorker', error, { jobId, profileId: input.profileId, version: input.version })
    postStatus(jobId, 'failed')
    postProgress(jobId, { status: 'failed', title: 'Lỗi khởi động', message: errMsg, percent: 100 })
    postMsg({ type: 'error', jobId, message: errMsg })
  }
}

parentPort.on('message', (e: any) => {
  const message = (e.data || e) as WorkerInputMessage
  if (message.type === 'start') {
    void startLaunch(message.jobId, message.input)
  } else if (message.type === 'cancel' && activeJobId === message.jobId) {
    isCancelled = true
    postLog(message.jobId, 'info', 'Nhận tín hiệu huỷ tiến trình khởi động...')
  }
})
