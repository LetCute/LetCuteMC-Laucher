/**
 * launchWorker.ts
 * Runs minecraft-launcher-core in a Worker Thread so the Electron Main
 * Process and UI Renderer are never blocked by the heavy launch I/O.
 */

import { parentPort } from 'node:worker_threads'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import type {
  LauncherLog,
  LaunchJobProgress,
  LaunchStatus,
  WorkerInputMessage,
  WorkerOutputMessage,
  LaunchInput,
  AuthSession,
  MinecraftVersionType,
} from '../../shared/types'
import { Version, launch as xmclLaunch, type ResolvedVersion } from '@xmcl/core'
import { selectBestJavaRuntime } from '../services/javaScannerService'
import { getSettings } from '../services/settingsService'
import { writeErrorLog } from '../services/errorLogService'

if (!parentPort) {
  throw new Error('launchWorker must run inside a worker thread.')
}

// ─── State ────────────────────────────────────────────────────────────────────

let activeJobId: string | null = null
let isCancelled = false
let latestProgressKey = ''

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  postMsg({
    type: 'progress',
    jobId,
    progress: { ...progress, updatedAt: now() },
  })
}

/** Only post progress if key (status:percent:message) actually changed */
function postProgressThrottled(
  jobId: string,
  progress: Omit<LaunchJobProgress, 'updatedAt'>
): void {
  const key = `${progress.status}:${progress.percent}:${progress.message}`
  if (key === latestProgressKey) return
  latestProgressKey = key
  postProgress(jobId, progress)
}

function assertNotCancelled(): void {
  if (isCancelled) throw new Error('Launch cancelled.')
}

function resolveLauncherCoreVersionType(
  versionType: MinecraftVersionType
): 'release' | 'snapshot' | 'old_beta' | 'old_alpha' {
  switch (versionType) {
    case 'release': return 'release'
    case 'snapshot': return 'snapshot'
    case 'old_beta': return 'old_beta'
    case 'old_alpha': return 'old_alpha'
    default: return 'release'
  }
}

function validateAuth(auth: AuthSession | null | undefined): string | null {
  if (!auth) return 'Bạn cần thông tin tài khoản để chơi.'
  if (auth.type === 'virtual') {
    if (!auth.username) return 'Tên người chơi Local không được rỗng.'
    return null
  }
  if (auth.type !== 'microsoft') return 'Phiên đăng nhập không hợp lệ.'
  if (!auth.username || !auth.uuid || !auth.accessToken)
    return 'Phiên Microsoft auth bị thiếu thông tin.'
  return null
}

function validateInput(input: LaunchInput): string | null {
  if (!input.profileId) return 'Thiếu profile ID.'
  if (!input.version) return 'Chưa chọn Minecraft version.'
  if (!input.gameDir) return 'Chưa có thư mục .minecraft.'
  if (input.minMemoryMb < 512) return 'RAM tối thiểu phải từ 512 MB.'
  if (input.maxMemoryMb < input.minMemoryMb) return 'RAM max phải lớn hơn hoặc bằng RAM min.'
  return null
}

// ─── Main launch routine ──────────────────────────────────────────────────────

async function startLaunch(jobId: string, input: LaunchInput): Promise<void> {
  activeJobId = jobId
  isCancelled = false
  latestProgressKey = ''
  postLog(jobId, 'info', `[LaunchWorker] START jobId=${jobId} version=${input.version} gameDir=${input.gameDir}`)

  try {
    // ── Validate input ────────────────────────────────────────────────────
    postStatus(jobId, 'validating')
    postProgress(jobId, {
      status: 'validating',
      title: 'Kiểm tra cấu hình',
      message: 'Đang kiểm tra profile...',
      percent: 2,
    })

    const inputErr = validateInput(input)
    if (inputErr) throw new Error(inputErr)

    const authErr = validateAuth(input.auth)
    if (authErr) throw new Error(authErr)

    assertNotCancelled()

    const auth = input.auth!
    postLog(jobId, 'info', `Người chơi: ${auth.username} (${auth.type === 'virtual' ? 'Local Offline' : 'Microsoft'})`)
    postLog(jobId, 'info', `UUID: ${auth.uuid}`)
    postLog(jobId, 'info', `Thư mục game: ${input.gameDir}`)
    postLog(jobId, 'info', `Minecraft version: ${input.version}`)
    postLog(jobId, 'info', `Loader: vanilla`)

    // ── Check Java ────────────────────────────────────────────────────────
    postStatus(jobId, 'checking_java')
    postProgress(jobId, {
      status: 'checking_java',
      title: 'Kiểm tra Java',
      message: 'Đang tìm Java runtime...',
      percent: 8,
    })
    assertNotCancelled()

    // Static import (CommonJS output, no .js extension)

    const settings = await getSettings()
    const scanDirs = [...settings.customJavaScanDirs]
    const mcRoot = settings.minecraftDirectory

    // resourcePath: thư mục chứa versions/, libraries/, assets/
    // Với profile modpack có gameDir riêng: dùng input.resourcePath (mcRootDir của profile)
    // Với profile thường: dùng mcRoot từ settings
    const resourcePath = (input.resourcePath && input.resourcePath.trim() !== '') 
      ? input.resourcePath 
      : mcRoot

    const javaSelection = await selectBestJavaRuntime(input.version, scanDirs, {
      gameDir: resourcePath,
      preferredJavaPath: input.javaPath,
      allowNewer: false,
    })

    if (!javaSelection.found || !javaSelection.selectedRuntime) {
      throw new Error(javaSelection.message)
    }

    if (javaSelection.warning) {
      postLog(jobId, 'warn', javaSelection.warning)
    }

    const javaPath = javaSelection.selectedRuntime.javaPath
    const javaVer = javaSelection.selectedRuntime.majorVersion
    postLog(jobId, 'success', `Dùng Java ${javaVer}: ${javaPath}`)

    // ── Check version installed ───────────────────────────────────────────
    postStatus(jobId, 'checking_version')
    postProgress(jobId, {
      status: 'checking_version',
      title: 'Kiểm tra phiên bản',
      message: `Đang kiểm tra ${input.version}...`,
      percent: 15,
    })
    assertNotCancelled()

    // Tìm version JSON tại resourcePath (nơi cài Fabric/Vanilla)
    const checkDir = path.join(resourcePath, 'versions', input.version)
    const versionJson = path.join(checkDir, `${input.version}.json`)
    const isInstalled = await pathExists(versionJson)

    if (!isInstalled) {
      postLog(jobId, 'info', `Phiên bản ${input.version} chưa cài. Sẽ tải xuống...`)
    } else {
      postLog(jobId, 'info', 'Phiên bản đã cài. Đang kiểm tra thư viện...')
    }

    // ── Prepare & Launch ──────────────────────────────────────────────────
    postStatus(jobId, 'preparing')
    postProgressThrottled(jobId, {
      status: 'preparing',
      title: 'Chuẩn bị khởi động',
      message: 'Đang khởi tạo launcher...',
      percent: 20,
    })
    assertNotCancelled()

    // XMCL parse version:
    // - Với profile modpack (có mcRootDir hoặc gameDir nằm trong profiles/):
    //   version files đã được copy vào gameDir/versions/ bởi prepareWorker
    //   Nên parse tại gamePath (input.gameDir) để XMCL tìm được đúng JSON
    // - Với profile thường: parse tại resourcePath (mcRoot)
    const hasResourcePath = input.resourcePath && input.resourcePath.trim() !== '' && 
      input.resourcePath.toLowerCase() !== input.gameDir.toLowerCase()
    const isInProfilesPath = input.gameDir.toLowerCase().includes(`${path.sep}profiles${path.sep}`) ||
      input.gameDir.toLowerCase().includes('/profiles/')
    const isModpackProfile = hasResourcePath || (isInProfilesPath && input.gameDir.toLowerCase() !== resourcePath.toLowerCase())
    const parseRoot = isModpackProfile ? input.gameDir : resourcePath
    
    postLog(jobId, 'info', `Parse version tại: ${parseRoot} (isModpackProfile=${isModpackProfile})`)
    const resolved: ResolvedVersion = await Version.parse(parseRoot, input.version)

    // Filter out unsupported JVM flags for Java < 24 (e.g. UseCompactObjectHeaders)
    if (javaVer < 24 && (resolved as any).arguments?.jvm) {
      ;(resolved as any).arguments.jvm = (resolved as any).arguments.jvm.filter((arg: any) => {
        if (typeof arg === 'string') {
          return !arg.includes('UseCompactObjectHeaders')
        }
        if (arg && typeof arg === 'object' && Array.isArray(arg.value)) {
          arg.value = arg.value.filter((v: string) => !v.includes('UseCompactObjectHeaders'))
          return arg.value.length > 0
        }
        return true
      })
    }

    // ── Launch ────────────────────────────────────────────────────────────
    assertNotCancelled()
    postStatus(jobId, 'launching')
    postProgress(jobId, {
      status: 'launching',
      title: 'Khởi động Minecraft',
      message: 'Đang mở Minecraft...',
      percent: 90,
    })

    const customArgs: string[] = []
    if (javaVer >= 17) {
      customArgs.push(
        '--enable-native-access=ALL-UNNAMED',
        '--add-opens=java.base/java.lang=ALL-UNNAMED',
        '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
        '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
        '--add-opens=java.base/java.io=ALL-UNNAMED',
        '--add-opens=java.base/java.net=ALL-UNNAMED',
        '--add-opens=java.base/java.nio=ALL-UNNAMED',
        '--add-opens=java.base/java.util=ALL-UNNAMED',
        '--add-opens=java.base/java.util.concurrent=ALL-UNNAMED',
        '--add-opens=java.base/sun.nio.ch=ALL-UNNAMED'
      )
    }

    // XMCL launch:
    // - gamePath: thư mục chứa saves/, mods/, config/ (profile riêng của modpack)
    // - resourcePath: thư mục chứa versions/, libraries/, assets/ (mcRoot)
    const child = await xmclLaunch({
      gamePath: input.gameDir,
      resourcePath: resourcePath,
      javaPath,
      version: resolved,
      accessToken: auth.accessToken,
      gameProfile: { name: auth.username, id: auth.uuid },
      minMemory: input.minMemoryMb,
      maxMemory: input.maxMemoryMb,
      extraJVMArgs: customArgs,
      server: input.serverAddress ? { ip: input.serverAddress } : undefined,
    })

    const minecraftPid = child.pid ?? null
    if (minecraftPid) {
      postLog(jobId, 'info', `Minecraft process started with PID ${minecraftPid}.`)
      if ((child as any).spawnargs) {
        postLog(jobId, 'info', `Command: ${(child as any).spawnargs.join(' ')}`)
      }
    }

    let lastErrorSummary = ''

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8').trim()
      if (text) {
        postLog(jobId, 'info', text)
        if (text.includes('Exception') || text.includes('Error') || text.includes('IncompatibleModException') || text.includes('net.fabricmc.loader')) {
          lastErrorSummary = text
        }
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8').trim()
      if (text) {
        postLog(jobId, 'error', text)
        lastErrorSummary = text
      }
    })

    child.on('exit', (code) => {
      const ok = code === 0 || code === null
      if (!ok) {
        const errMsg = lastErrorSummary
          ? `Lỗi khởi chạy Minecraft (mã ${code}): ${lastErrorSummary.slice(0, 200)}`
          : `Minecraft thoát lỗi với mã: ${code}`
        postLog(jobId, 'error', errMsg)
        postStatus(jobId, 'failed')
        postMsg({ type: 'finished', jobId, ok: false, message: errMsg })
      } else {
        postLog(jobId, 'success', 'Minecraft kết thúc bình thường.')
        postStatus(jobId, 'closed')
        postMsg({ type: 'finished', jobId, ok: true, message: `Minecraft closed with code ${code}.` })
      }
    })

    postStatus(jobId, 'running')
    postProgress(jobId, {
      status: 'running',
      title: 'Minecraft đang chạy',
      message: 'Game process đã khởi động.',
      percent: 100,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Launch failed.'
    const status: LaunchStatus = message === 'Launch cancelled.' ? 'cancelled' : 'failed'

    postStatus(jobId, status)
    postLog(jobId, status === 'cancelled' ? 'warn' : 'error', message)
    if (status !== 'cancelled') {
      void writeErrorLog('launchWorker', error, {
        jobId,
        version: input.version,
        gameDir: input.gameDir,
        javaPath: input.javaPath,
        authType: input.auth?.type,
      })
    }
    postMsg({ type: 'error', jobId, message })
    postMsg({ type: 'finished', jobId, ok: false, message })
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

parentPort.on('message', (message: WorkerInputMessage) => {
  if (message.type === 'cancel') {
    if (message.jobId === activeJobId) {
      isCancelled = true
    }
    return
  }

  if (message.type === 'start') {
    void startLaunch(message.jobId, message.input)
  }
})
