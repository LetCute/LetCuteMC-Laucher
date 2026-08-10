import type {
  LauncherProfile,
  LauncherSettings,
  PrepareGameProgress,
  PreparedProfileState,
  LauncherLogLevel,
} from '../../shared/types'
import { downloadTasks, DownloadTask } from '../services/download-manager'

import { parentPort } from 'node:worker_threads'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { getVersionManifestCacheDir } from '../services/storageService'
import { getCachedVersionManifest } from '../services/versionManifestCacheService'
import { selectBestJavaRuntime } from '../services/javaScannerService'
import { writeErrorLog } from '../services/errorLogService'

async function checkFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, 'r')
    const hash = crypto.createHash('sha1')
    const buffer = Buffer.alloc(64 * 1024)
    let read
    while ((read = await handle.read(buffer, 0, buffer.length, null)).bytesRead > 0) {
      hash.update(buffer.subarray(0, read.bytesRead))
    }
    await handle.close()
    return hash.digest('hex') === expectedHash
  } catch {
    return false
  }
}

async function downloadAsset(
  url: string,
  destPath: string,
  expectedHash: string,
  expectedSize: number
): Promise<void> {
  const partPath = `${destPath}.part`
  const dir = path.dirname(destPath)
  await fs.mkdir(dir, { recursive: true })

  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP status ${res.status}`)

      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (buffer.length !== expectedSize) {
        throw new Error(`Size mismatch: expected ${expectedSize}, got ${buffer.length}`)
      }

      const hash = crypto.createHash('sha1').update(buffer).digest('hex')
      if (hash !== expectedHash) {
        throw new Error(`Hash mismatch: expected ${expectedHash}, got ${hash}`)
      }

      await fs.writeFile(partPath, buffer)
      await fs.rename(partPath, destPath)
      return
    } catch (err) {
      try { await fs.unlink(partPath) } catch {}
      if (attempts >= maxAttempts) {
        throw new Error(`Failed downloading ${url} after ${maxAttempts} attempts: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
}

async function downloadAssetsConcurrently(
  tasks: Array<{ url: string; destPath: string; hash: string; size: number }>,
  concurrencyLimit: number,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  const total = tasks.length
  let current = 0
  let index = 0

  const worker = async () => {
    while (index < tasks.length) {
      const task = tasks[index++]
      await downloadAsset(task.url, task.destPath, task.hash, task.size)
      current++
      onProgress(current, total)
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, total) }, worker)
  await Promise.all(workers)
}

if (!parentPort) {
  throw new Error('prepareWorker must run inside a worker thread.')
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function postProgress(
  profileId: string,
  version: string,
  progress: Omit<PrepareGameProgress, 'profileId' | 'version' | 'updatedAt'>
) {
  parentPort!.postMessage({
    type: 'progress',
    profileId,
    progress: {
      ...progress,
      profileId,
      version,
      updatedAt: new Date().toISOString(),
    },
  })
}

function postLog(level: LauncherLogLevel, message: string) {
  parentPort!.postMessage({
    type: 'log',
    level,
    message,
  })
}

function postFinished(profileId: string, state: PreparedProfileState | null, ok: boolean, message: string) {
  parentPort!.postMessage({
    type: 'finished',
    profileId,
    state,
    ok,
    message,
  })
}

async function startPrepare(profile: LauncherProfile, settings: LauncherSettings, forceRepair?: boolean): Promise<void> {
  const profileId = profile.id
  const version = profile.minecraftVersion
  const mcRoot = settings.minecraftDirectory
  const gameDir = profile.gameDir || mcRoot
  
  // Phát hiện modpack profile:
  // 1. Nếu profile có mcRootDir (tạo sau khi fix)
  // 2. Hoặc gameDir nằm trong subfolder 'profiles/' của mcRoot (tạo trước khi fix - tương thích ngược)
  const hasMcRootDir = !!(profile.mcRootDir && profile.mcRootDir.toLowerCase() !== gameDir.toLowerCase())
  const isInProfilesSubfolder = gameDir.toLowerCase().includes(`${path.sep}profiles${path.sep}`) ||
    gameDir.toLowerCase().includes('/profiles/')
  const isModpackProfile = hasMcRootDir || (isInProfilesSubfolder && gameDir.toLowerCase() !== mcRoot.toLowerCase())

  postLog('info', `[PrepareWorker] START prepare profile=${profileId} version=${version} gameDir=${gameDir} mcRoot=${mcRoot} isModpackProfile=${isModpackProfile}`)

  try {
    postProgress(profileId, version, {
      status: 'checking',
      title: 'Kiểm tra tệp tin',
      message: 'Đang kiểm tra dữ liệu cài đặt của game...',
      percent: 5,
    })

    // 1. Check version folder and metadata json
    const versionDir = path.join(mcRoot, 'versions', version)
    const versionJsonPath = path.join(versionDir, `${version}.json`)

    postLog('info', `[PrepareWorker] Checking paths: versionDir=${versionDir}`)
    let versionJsonReady = await pathExists(versionJsonPath)
    postLog('info', `[PrepareWorker] versionJsonReady=${versionJsonReady}`)

    // If version json is missing, download it from mojang manifest
    if (!versionJsonReady) {
      postLog('info', `Thiếu cấu hình json của phiên bản ${version}. Đang tải...`)
      postLog('info', `Đang tải danh sách phiên bản từ Mojang...`)
      const manifest = await getCachedVersionManifest()
      const versionEntry = manifest.versions.find((v: any) => v.id === version)

      if (!versionEntry) {
        throw new Error(`Phiên bản ${version} không tồn tại trên hệ thống Mojang. Hãy kiểm tra lại hoặc cài đặt thủ công.`)
      }

      await fs.mkdir(versionDir, { recursive: true })
      // Download version json
      const res = await fetch(versionEntry.url)
      if (!res.ok) throw new Error(`Fetch version json failed with status ${res.status}`)
      const verJsonData = await res.json()
      await fs.writeFile(versionJsonPath, JSON.stringify(verJsonData, null, 2), 'utf8')
      versionJsonReady = true
      postLog('success', `Đã tải và lưu cấu hình json của ${version}.`)
    }

    // 2. Read version json details to extract libraries and assets
    let versionJson = JSON.parse(await fs.readFile(versionJsonPath, 'utf8'))
    let clientJarPath = path.join(versionDir, `${version}.jar`)
    let inheritedVersion = 'None'

    // Resolve inheritsFrom if present
    if (versionJson.inheritsFrom) {
      inheritedVersion = versionJson.inheritsFrom
      const parentDir = path.join(mcRoot, 'versions', inheritedVersion)
      const parentJsonPath = path.join(parentDir, `${inheritedVersion}.json`)
      clientJarPath = path.join(parentDir, `${inheritedVersion}.jar`)

      postLog('info', `Phiên bản kế thừa từ: ${inheritedVersion}. Đang kiểm tra cấu hình cha...`)

      if (!(await pathExists(parentJsonPath))) {
        postLog('info', `Đang tải tệp cấu hình của phiên bản cha: ${inheritedVersion}...`)
        const manifest = await getCachedVersionManifest()
        const parentEntry = manifest.versions.find((v: any) => v.id === inheritedVersion)
        if (!parentEntry) {
          throw new Error(`Không tìm thấy cấu hình phiên bản cha ${inheritedVersion} trên Mojang manifest.`)
        }
        await fs.mkdir(parentDir, { recursive: true })
        const res = await fetch(parentEntry.url)
        if (!res.ok) throw new Error(`Tải cấu hình cha thất bại: HTTP status ${res.status}`)
        const parentData = await res.json()
        await fs.writeFile(parentJsonPath, JSON.stringify(parentData, null, 2), 'utf8')
      }

      const parentJson = JSON.parse(await fs.readFile(parentJsonPath, 'utf8'))
      postLog('info', `Cấu hình cha ${inheritedVersion} đã sẵn sàng.`)
    }

    // Use XMCL Core to parse and resolve the entire version correctly (including inheritsFrom and libraries)
    const { Version } = await import('@xmcl/core')
    const resolvedVersion = await Version.parse(mcRoot, version)

    let clientJarReady = await pathExists(clientJarPath)
    postLog('info', `[PrepareWorker] Client Jar path: ${clientJarPath} (Ready: ${clientJarReady})`)

    const downloadQueue: DownloadTask[] = []

    // 2a. Add client jar task if missing
    if (!clientJarReady && resolvedVersion.downloads?.client) {
      downloadQueue.push({
        id: `client-jar-${resolvedVersion.id}`,
        url: resolvedVersion.downloads.client.url,
        destinationPath: clientJarPath,
        sha1: resolvedVersion.downloads.client.sha1,
        size: resolvedVersion.downloads.client.size,
        label: `Minecraft Client ${inheritedVersion !== 'None' ? inheritedVersion : version} Jar`,
      })
    }

    // 2b. Check libraries (XMCL already handles OS rules and Fabric/Quilt maven URLs)
    for (const lib of resolvedVersion.libraries) {
      if (lib.download) {
        const libPath = path.join(mcRoot, 'libraries', lib.download.path)
        if (!(await pathExists(libPath))) {
          downloadQueue.push({
            id: lib.name,
            url: lib.download.url,
            destinationPath: libPath,
            sha1: lib.download.sha1,
            size: lib.download.size || 0,
            label: path.basename(lib.download.path),
          })
        }
      }
    }

    // 2c. Check assetIndex and assets
    if (resolvedVersion.assetIndex) {
      const assetIndexDir = path.join(mcRoot, 'assets', 'indexes')
      const assetIndexPath = path.join(assetIndexDir, `${resolvedVersion.assetIndex.id}.json`)
      await fs.mkdir(assetIndexDir, { recursive: true })

      if (!(await pathExists(assetIndexPath))) {
        postLog('info', `Đang tải asset index: ${resolvedVersion.assetIndex.id}...`)
        const res = await fetch(resolvedVersion.assetIndex.url)
        if (!res.ok) throw new Error(`Tải asset index thất bại: HTTP status ${res.status}`)
        const indexData = await res.json()
        await fs.writeFile(assetIndexPath, JSON.stringify(indexData, null, 2), 'utf8')
      }

      // Read asset index objects
      const assetIndex = JSON.parse(await fs.readFile(assetIndexPath, 'utf8'))
      if (assetIndex.objects) {
        const objects = assetIndex.objects
        const assetTasks: Array<{ url: string; destPath: string; hash: string; size: number }> = []

        postLog('info', `Đang kiểm tra các tệp asset (âm thanh, hình ảnh...)...`)
        postProgress(profileId, version, {
          status: 'checking',
          title: 'Kiểm tra tệp tin game',
          message: 'Đang kiểm tra các tệp tài nguyên game...',
          percent: 30,
        })

        for (const key of Object.keys(objects)) {
          const obj = objects[key]
          const first2 = obj.hash.substring(0, 2)
          const assetDest = path.join(mcRoot, 'assets', 'objects', first2, obj.hash)
          
          let needsDownload = false
          if (!(await pathExists(assetDest))) {
            needsDownload = true
          } else {
            // Check size
            const stat = await fs.stat(assetDest)
            if (stat.size !== obj.size) {
              needsDownload = true
            } else if (forceRepair) {
              // Full SHA-1 verification only if Repair mode is active
              const hashMatch = await checkFileHash(assetDest, obj.hash)
              if (!hashMatch) {
                needsDownload = true
              }
            }
          }

          if (needsDownload) {
            assetTasks.push({
              url: `https://resources.download.minecraft.net/${first2}/${obj.hash}`,
              destPath: assetDest,
              hash: obj.hash,
              size: obj.size,
            })
          }
        }

        if (assetTasks.length > 0) {
          postLog('info', `Phát hiện ${assetTasks.length} tài nguyên (assets) còn thiếu hoặc bị lỗi. Bắt đầu tải...`)
          
          await downloadAssetsConcurrently(assetTasks, 8, (current, total) => {
            postProgress(profileId, version, {
              status: 'downloading',
              title: `Tải tài nguyên (${current}/${total})`,
              message: `Đang tải tài nguyên game...`,
              percent: Math.min(95, Math.round((current / total) * 60) + 30),
            })
          })
          postLog('success', `Đã tải hoàn tất ${assetTasks.length} tệp tài nguyên.`)
        } else {
          postLog('info', `Tất cả tài nguyên (assets) đều đầy đủ và hợp lệ.`)
        }
      }
    }

    // 3. Trigger download queue
    if (downloadQueue.length > 0) {
      postLog('info', `Tìm thấy ${downloadQueue.length} tệp tin còn thiếu. Bắt đầu chuẩn bị tải...`)
      postProgress(profileId, version, {
        status: 'downloading',
        title: 'Tải tệp game còn thiếu',
        message: `Đang chuẩn bị tải ${downloadQueue.length} thư viện...`,
        percent: 10,
      })

      await downloadTasks(downloadQueue, {
        concurrency: settings.downloadConcurrency ?? 8,
        onProgress: (prog) => {
          postProgress(profileId, version, {
            status: 'downloading',
            title: `Tải game (${prog.current}/${prog.total})`,
            message: `Tải: ${prog.label}`,
            percent: Math.min(90, Math.round((prog.current / prog.total) * 80) + 10),
            current: prog.current,
            total: prog.total,
          })
        },
        onLog: (lvl, msg) => postLog(lvl, msg),
      })
    }

    // Verify client jar exists
    const finalClientJarReady = await pathExists(clientJarPath)
    if (!finalClientJarReady) {
      throw new Error(`Tệp Client Jar chưa được tải hoặc không tồn tại tại: "${clientJarPath}".`)
    }

    // ── Bước thêm: Copy version folder vào profile's gameDir nếu là modpack profile ──
    // Modpack profile có gameDir riêng cần có versions/ của nó để Minecraft client tìm thấy và tránh xung đột
    if (isModpackProfile) {
      postProgress(profileId, version, {
        status: 'checking',
        title: 'Sao chép dữ liệu phiên bản',
        message: 'Đang sao chép tệp phiên bản vào thư mục profile...',
        percent: 92,
      })

      // Copy toàn bộ các version folder cần thiết (bao gồm cả inheritsFrom chain)
      const versionsToCopy: string[] = [version]
      if (inheritedVersion !== 'None') {
        versionsToCopy.push(inheritedVersion)
      }

      for (const ver of versionsToCopy) {
        const srcVersionDir = path.join(mcRoot, 'versions', ver)
        const dstVersionDir = path.join(gameDir, 'versions', ver)

        if (!(await pathExists(srcVersionDir))) {
          postLog('warn', `[PrepareWorker] Version source folder không tồn tại: ${srcVersionDir}, bỏ qua copy.`)
          continue
        }

        await fs.mkdir(dstVersionDir, { recursive: true })

        // Copy tất cả file trong folder version (json, jar, natives-info...)
        const entries = await fs.readdir(srcVersionDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isFile()) {
            const srcFile = path.join(srcVersionDir, entry.name)
            const dstFile = path.join(dstVersionDir, entry.name)
            // Chỉ copy nếu file đích chưa tồn tại hoặc forceRepair
            const dstExists = await pathExists(dstFile)
            if (!dstExists || forceRepair) {
              await fs.copyFile(srcFile, dstFile)
              postLog('info', `[PrepareWorker] Đã sao chép: ${entry.name} → ${dstVersionDir}`)
            }
          }
        }
        postLog('success', `[PrepareWorker] Phiên bản ${ver} đã được sao chép vào profile.`)
      }
    }

    // Log detailed summary
    postLog('info', `[PrepareWorker] HOÀN TẤT CHUẨN BỊ GAME:`)
    postLog('info', ` - Phiên bản game con (child version): ${version}`)
    postLog('info', ` - Phiên bản kế thừa (inherited version): ${inheritedVersion}`)
    postLog('info', ` - Resolved Client Jar: ${clientJarPath}`)
    postLog('info', ` - Asset Index ID: ${resolvedVersion.assetIndex?.id || 'None'}`)
    postLog('info', ` - Tổng số thư viện (libraries): ${resolvedVersion.libraries?.length || 0}`)

    // Check Java Selection status
    const javaSelection = await selectBestJavaRuntime(version, settings.customJavaScanDirs, {
      gameDir: mcRoot,
    })

    const finalState: PreparedProfileState = {
      profileId,
      version,
      gameDir,
      isReady: true,
      checkedAt: new Date().toISOString(),
      versionJsonReady: true,
      librariesReady: true,
      assetsReady: true,
      javaReady: javaSelection.found,
      missingFiles: 0,
      message: 'Cấu hình sẵn sàng để khởi chạy.',
    }

    postProgress(profileId, version, {
      status: 'ready',
      title: 'Hoàn tất chuẩn bị',
      message: 'Trò chơi đã sẵn sàng.',
      percent: 100,
    })

    postFinished(profileId, finalState, true, 'Prepared successfully.')
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    postLog('error', `Prepare failed: ${errMessage}`)
    void writeErrorLog('prepareWorker', error, { profileId, version, gameDir })
    postProgress(profileId, version, {
      status: 'failed',
      title: 'Lỗi chuẩn bị game',
      message: errMessage,
      percent: 100,
    })
    postFinished(profileId, null, false, errMessage)
  }
}

// Lắng nghe tín hiệu từ main thread
parentPort.on('message', (message: any) => {
  if (message.type === 'start') {
    void startPrepare(message.profile, message.settings, message.forceRepair)
  }
})
