import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import type {
  LauncherProfile,
  LauncherSettings,
  PreparedProfileState,
  PrepareGameProgress,
  PrepareGameResult,
} from '../../shared/types'
import { writeErrorLog } from './errorLogService'
import { getPreparedProfilesCachePath } from './storageService.js'

let currentWorker: Worker | null = null
let activeProfileId: string | null = null

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function getCachePath(): string {
  return getPreparedProfilesCachePath()
}

/** Resolve prepareWorker path for both dev and packaged builds. */
function resolvePrepareWorkerPath(): string {
  // Prefer relative path next to this service (works in dev + asar)
  let workerPath = path.join(__dirname, '../workers/prepareWorker.js')
  // Worker threads cannot execute from inside app.asar — use unpacked twin
  if (workerPath.includes(`${path.sep}app.asar${path.sep}`) || workerPath.includes('/app.asar/')) {
    workerPath = workerPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
      .replace('/app.asar/', '/app.asar.unpacked/')
  }
  // Fallback for unusual pack layouts
  if (app.isPackaged && !workerPath.includes('app.asar.unpacked')) {
    workerPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'dist-electron',
      'main',
      'workers',
      'prepareWorker.js'
    )
  }
  return workerPath
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

export async function getPreparedProfiles(): Promise<Record<string, PreparedProfileState>> {
  const filePath = getCachePath()
  if (!(await pathExists(filePath))) return {}
  try {
    const data = await fs.readFile(filePath, 'utf8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export async function savePreparedProfileState(
  state: PreparedProfileState
): Promise<void> {
  const filePath = getCachePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const all = await getPreparedProfiles()
  all[state.profileId] = state
  await fs.writeFile(filePath, JSON.stringify(all, null, 2), 'utf8')
}

export async function clearPreparedProfilesCache(): Promise<boolean> {
  const filePath = getCachePath()
  try {
    if (await pathExists(filePath)) {
      await fs.unlink(filePath)
    }
    return true
  } catch {
    return false
  }
}

export async function checkPreparedProfile(
  profile: LauncherProfile,
  settings: LauncherSettings
): Promise<PreparedProfileState> {
  const gameDir = profile.gameDir || settings.minecraftDirectory
  const mcRootDir = profile.mcRootDir || settings.minecraftDirectory
  
  // Phát hiện modpack profile (tương thích cả profile cũ và mới):
  // 1. Có mcRootDir (profile tạo sau khi fix)
  // 2. Hoặc gameDir nằm trong subfolder profiles/ (profile cũ)
  const hasMcRootDir = !!(profile.mcRootDir && profile.mcRootDir.toLowerCase() !== gameDir.toLowerCase())
  const isInProfilesSubfolder = gameDir.toLowerCase().includes(`${path.sep}profiles${path.sep}`) ||
    gameDir.toLowerCase().includes('/profiles/')
  const isModpackProfile = hasMcRootDir || (isInProfilesSubfolder && gameDir.toLowerCase() !== mcRootDir.toLowerCase())
  
  // Với modpack profile: prepareWorker đã copy version vào gameDir/versions/ → kiểm tra tại đó
  // Với profile thường: kiểm tra tại mcRootDir (= gameDir)
  const versionCheckDir = isModpackProfile ? gameDir : mcRootDir
  
  const cached = await getPreparedProfiles()

  if (cached[profile.id]) {
    // Quick validation: kiểm tra version JSON và JAR tại đường dẫn đúng
    const record = cached[profile.id]
    const versionDir = path.join(versionCheckDir, 'versions', profile.minecraftVersion)
    const versionJsonPath = path.join(versionDir, `${profile.minecraftVersion}.json`)
    
    let clientJarPath = path.join(versionDir, `${profile.minecraftVersion}.jar`)
    let jsonExists = await pathExists(versionJsonPath)
    
    if (jsonExists) {
      try {
        const content = await fs.readFile(versionJsonPath, 'utf8')
        const json = JSON.parse(content)
        if (json.inheritsFrom) {
          const parentVersion = json.inheritsFrom
          // Parent version jar \u0111\u01b0\u1ee3c copy v\u00e0o gameDir c\u00f9ng n\u01a1i
          clientJarPath = path.join(versionCheckDir, 'versions', parentVersion, `${parentVersion}.jar`)
        }
      } catch (_) {
        jsonExists = false
      }
    }

    const exists = jsonExists && (await pathExists(clientJarPath))
    if (exists) {
      return record
    }
  }

  // Fallback to minimal state
  return {
    profileId: profile.id,
    version: profile.minecraftVersion,
    gameDir,
    isReady: false,
    checkedAt: new Date().toISOString(),
    versionJsonReady: false,
    librariesReady: false,
    assetsReady: false,
    javaReady: false,
    missingFiles: -1,
    message: 'Ch\u01b0a \u0111\u01b0\u1ee3c chu\u1ea9n b\u1ecb ho\u1eb7c c\u00f2n thi\u1ebfu t\u1ec7p tin.',
  }
}

export async function prepareGameFiles(
  profile: LauncherProfile,
  settings: LauncherSettings,
  forceRepair?: boolean
): Promise<PrepareGameResult> {
  console.log('[PrepareService] prepareGameFiles called for', profile.id, profile.minecraftVersion, 'forceRepair=', forceRepair)
  if (currentWorker) {
    if (activeProfileId === profile.id) {
      console.log('[PrepareService] Worker already active for same profile')
      return { ok: true, state: null, message: 'Đang chuẩn bị phiên bản này ở background.' }
    }
    // Cancel old active worker
    console.log('[PrepareService] Terminating old prepare worker')
    await currentWorker.terminate().catch(() => { })
    currentWorker = null
  }

  activeProfileId = profile.id
  const workerPath = resolvePrepareWorkerPath()
  console.log('[PrepareService] Spawning prepareWorker at', workerPath)
  currentWorker = new Worker(workerPath)

  currentWorker.on('message', (msg: any) => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return

    if (msg.type === 'progress') {
      win.webContents.send('prepare:progress', msg.progress)
    } else if (msg.type === 'log') {
      console.log('[PrepareWorker]', msg.level, msg.message)
      // Optionally forward to renderer logs later
    } else if (msg.type === 'finished') {
      console.log('[PrepareService] Worker finished ok=', msg.ok, 'msg=', msg.message)
      if (msg.ok && msg.state) {
        void savePreparedProfileState(msg.state)
        if (msg.state.autoInstalledJavaPath) {
          console.log('[PrepareService] Auto-installed Java detected, updating profile:', msg.state.autoInstalledJavaPath)
          import('./profileService.js').then(({ updateProfile }) => {
            void updateProfile(msg.state.profileId, { javaPath: msg.state.autoInstalledJavaPath })
          })
        }
      }
      // prepareWorker already dumps failures to log_error
      currentWorker = null
      activeProfileId = null
    }
  })

  currentWorker.on('error', (err) => {
    console.error('[Prepare Service] Worker error:', err)
    void writeErrorLog('prepareService:worker', err, { activeProfileId })
    currentWorker = null
    activeProfileId = null
  })

  currentWorker.on('exit', () => {
    currentWorker = null
    activeProfileId = null
  })

  currentWorker.postMessage({
    type: 'start',
    profile,
    settings,
    forceRepair,
  })

  return { ok: true, state: null, message: 'Bắt đầu tiến trình chuẩn bị tệp game.' }
}

export async function cancelPrepareGame(): Promise<boolean> {
  if (currentWorker) {
    await currentWorker.terminate().catch(() => { })
    currentWorker = null
    activeProfileId = null
    return true
  }
  return false
}

export function isPrepareActiveForProfile(profileId: string): boolean {
  return currentWorker !== null && activeProfileId === profileId
}
