import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
// adm-zip is lazy-loaded to reduce cold-start time
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ModrinthSearchResult, ModrinthVersion } from '../../../shared/types'
import { downloadTasks } from '../system/downloadManager'
import { createProfile, updateProfile } from '../profile/profileService'
import {
  installFabric,
  installQuilt,
  installForge,
  installNeoForge,
  getForgeVersions,
  getNeoForgeVersions,
  getFabricVersions,
} from './modLoaderService'
// @xmcl/modrinth is lazy-loaded to reduce cold-start time
let _client: any = null
async function getModrinthClient() {
  if (!_client) {
    const { ModrinthV2Client } = await import('@xmcl/modrinth')
    _client = new ModrinthV2Client()
  }
  return _client
}

import { taskManagerService } from '../system/taskManagerService.js'

export async function searchModrinth(
  query: string,
  projectType: string = 'modpack',
  offset: number = 0,
  gameVersion?: string,
  loader?: string
): Promise<ModrinthSearchResult> {
  const client = await getModrinthClient()
  const facetList: string[] = [`project_type:${projectType}`]

  if (gameVersion && gameVersion !== 'all') {
    facetList.push(`versions:${gameVersion}`)
  }

  if (loader && loader !== 'all' && loader !== 'unknown') {
    facetList.push(`categories:${loader}`)
  }

  const facets = JSON.stringify(facetList.map((f) => [f]))

  const res = await client.searchProjects({
    query,
    facets,
    offset,
    limit: 20,
  })
  return res as unknown as ModrinthSearchResult
}

export async function getModrinthVersions(projectId: string): Promise<ModrinthVersion[]> {
  const client = await getModrinthClient()
  const res = await client.getProjectVersions(projectId)
  return res as unknown as ModrinthVersion[]
}

async function downloadFileToTemp(url: string, filename: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), 'letcutemc-modrinth')
  await fs.mkdir(tempDir, { recursive: true })
  
  const dest = path.join(tempDir, filename)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)
  const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
  if (!res.ok) throw new Error(`Failed to download ${url}`)
  
  // ponytail: stream to disk — avoids buffering large .mrpack files in RAM
  if (!res.body) throw new Error('Response body is null')
  await pipeline(
    Readable.fromWeb(res.body as any),
    createWriteStream(dest)
  )
  return dest
}

export async function installModrinthModpack(versionId: string, profileName: string, gameDataDir: string): Promise<string> {
  const taskId = taskManagerService.createTask(`Cài đặt Modpack: ${profileName}`, 'install-modpack')
  
  // Run async
  Promise.resolve().then(async () => {
    try {
      taskManagerService.updateTaskProgress(taskId, 5, `Đang lấy thông tin Modpack phiên bản ${versionId}...`)
      const client = await getModrinthClient()
      
      let versionInfo: any;
      try {
        versionInfo = await client.getProjectVersion(versionId)
      } catch(e) {
        throw new Error('Không thể lấy thông tin phiên bản Modpack')
      }
      
      const mrpackFile = versionInfo.files.find((f: any) => f.filename.endsWith('.mrpack'))
      if (!mrpackFile) throw new Error('Không tìm thấy file .mrpack trong phiên bản này')
      
      taskManagerService.updateTaskProgress(taskId, 10, `Đang tải file .mrpack...`)
      const mrpackPath = await downloadFileToTemp(mrpackFile.url, mrpackFile.filename)
      let iconUrl: string | null = null
      try {
        const projectInfo = await client.getProject(versionInfo.project_id)
        iconUrl = (projectInfo as any).icon_url || null
      } catch (e) {
        // Ignore icon fetch error
      }
      
      await _installMrpack(mrpackPath, profileName, gameDataDir, taskId, true, iconUrl, versionInfo.loaders)
    } catch (e) {
      try {
        taskManagerService.failTask(taskId, e instanceof Error ? e.message : 'Lỗi không xác định')
      } catch (failErr) {
        console.error('[Modrinth] Failed to update task status:', failErr)
      }
    }
  }).catch((unhandledErr) => {
    console.error('[Modrinth] Unhandled error in installModrinthModpack:', unhandledErr)
  })
  
  return taskId
}

export async function installLocalModrinthModpack(mrpackPath: string, profileName: string, gameDataDir: string): Promise<string> {
  if (!mrpackPath || typeof mrpackPath !== 'string' || !mrpackPath.toLowerCase().endsWith('.mrpack')) {
    throw new Error('Tệp không đúng định dạng .mrpack.')
  }
  if (!profileName || typeof profileName !== 'string' || !profileName.trim()) {
    throw new Error('Tên profile không được để trống.')
  }
  const cleanProfileName = profileName.trim()
  const taskId = taskManagerService.createTask(`Cài đặt Modpack từ tệp: ${cleanProfileName}`, 'install-modpack')
  
  // Run async
  Promise.resolve().then(async () => {
    try {
      await _installMrpack(mrpackPath, cleanProfileName, gameDataDir, taskId, false)
    } catch (e) {
      try {
        taskManagerService.failTask(taskId, e instanceof Error ? e.message : 'Lỗi không xác định')
      } catch (failErr) {
        console.error('[Modrinth] Failed to update task status:', failErr)
      }
    }
  }).catch((unhandledErr) => {
    console.error('[Modrinth] Unhandled error in installLocalModrinthModpack:', unhandledErr)
  })
  
  return taskId
}

async function _installMrpack(
  mrpackPath: string,
  profileName: string,
  gameDataDir: string,
  taskId: string,
  cleanupZip: boolean,
  iconUrl?: string | null,
  fallbackLoaders?: string[]
): Promise<string> {
  // 3. Extract and parse modrinth.index.json
  taskManagerService.updateTaskProgress(taskId, 15, `Đang phân tích cấu trúc Modpack...`)
  const unzipper = await import('unzipper')
  
  const zipDirectory = await unzipper.Open.file(mrpackPath)
  const indexFile = zipDirectory.files.find((f: any) => f.path === 'modrinth.index.json')
  if (!indexFile) throw new Error('File .mrpack không hợp lệ (thiếu modrinth.index.json)')

  const indexContent = await indexFile.buffer()
  const indexData = JSON.parse(indexContent.toString('utf-8'))
  
  const minecraftVersion = indexData.dependencies?.minecraft
  if (!minecraftVersion) throw new Error('Không xác định được phiên bản Minecraft')
  
  // 4. Create profile directory (riêng biệt cho modpack này)
  const safeProfileName = profileName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const profileGameDir = path.join(gameDataDir, 'profiles', safeProfileName)
  
  // gameDataDir = mcRoot (chứa versions/, libraries/, assets/)
  // profileGameDir = nơi chứa mods/, configs/, saves/ của modpack này
  const mcRootDir = gameDataDir
  
  // 5. Create new profile (lưu mcRootDir để launchWorker biết dùng resourcePath đúng)
  const createdProfile = await createProfile({
    name: profileName,
    minecraftVersion: minecraftVersion,
    gameDir: profileGameDir,
    mcRootDir: mcRootDir, // <-- lưu thư mục chứa versions/libraries/assets
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
  })

  // Register rollback callback in case task is cancelled
  taskManagerService.registerCancelCallback(taskId, async () => {
    try {
      const { deleteProfile } = await import('../profile/profileService.js')
      await deleteProfile(createdProfile.id)
    } catch (rollbackErr) {
      console.error('[Modrinth] Rollback failed on cancel:', rollbackErr)
    }
  })

  if (taskManagerService.isCancelled(taskId)) {
    throw new Error('Đã hủy tác vụ')
  }

  taskManagerService.updateTaskProgress(taskId, 20, `Đã tạo Cấu hình game riêng biệt: ${profileName}`)
  
  if (iconUrl) {
    try {
      const iconPath = path.join(profileGameDir, 'icon.png')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(iconUrl, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer())
        await fs.writeFile(iconPath, buffer)
      }
    } catch (e) {
      // Ignore icon download error
    }
  }
  
  // Install Modloader if needed
  let finalMinecraftVersion = minecraftVersion;
  const deps = indexData.dependencies || {}

  if (deps['fabric-loader'] || deps['fabric']) {
    const loaderVer = deps['fabric-loader'] || deps['fabric']
    taskManagerService.updateTaskProgress(taskId, 25, `Đang cài đặt Fabric Loader ${loaderVer}...`)
    finalMinecraftVersion = await installFabric(minecraftVersion, loaderVer, mcRootDir)
    await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
    taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt Fabric thành công.')
  } else if (deps['quilt-loader'] || deps['quilt']) {
    const loaderVer = deps['quilt-loader'] || deps['quilt']
    taskManagerService.updateTaskProgress(taskId, 25, `Đang cài đặt Quilt Loader ${loaderVer}...`)
    finalMinecraftVersion = await installQuilt(minecraftVersion, loaderVer, mcRootDir)
    await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
    taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt Quilt thành công.')
  } else if (deps['forge'] || deps['forge-loader']) {
    const forgeVer = deps['forge'] || deps['forge-loader']
    taskManagerService.updateTaskProgress(taskId, 25, `Đang cài đặt Forge ${forgeVer}...`)
    finalMinecraftVersion = await installForge(minecraftVersion, forgeVer, mcRootDir)
    await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
    taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt Forge thành công.')
  } else if (deps['neoforge'] || deps['neoforge-loader']) {
    const neoVer = deps['neoforge'] || deps['neoforge-loader']
    taskManagerService.updateTaskProgress(taskId, 25, `Đang cài đặt NeoForge ${neoVer}...`)
    finalMinecraftVersion = await installNeoForge(minecraftVersion, neoVer, mcRootDir)
    await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
    taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt NeoForge thành công.')
  } else if (fallbackLoaders && fallbackLoaders.length > 0) {
    // Fallback if indexData.dependencies didn't specify loader version explicitly
    if (fallbackLoaders.includes('forge')) {
      taskManagerService.updateTaskProgress(taskId, 25, `Đang tìm và cài đặt Forge cho ${minecraftVersion}...`)
      try {
        const forgeList = await getForgeVersions()
        const forgeItem = forgeList.find(f => f.version.startsWith(minecraftVersion))
        if (forgeItem) {
          finalMinecraftVersion = await installForge(minecraftVersion, forgeItem.version, mcRootDir)
          await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
          taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt Forge thành công.')
        }
      } catch (err) {
        console.error('Failed to fallback install Forge:', err)
      }
    } else if (fallbackLoaders.includes('neoforge')) {
      taskManagerService.updateTaskProgress(taskId, 25, `Đang tìm và cài đặt NeoForge cho ${minecraftVersion}...`)
      try {
        const neoList = await getNeoForgeVersions()
        const neoItem = neoList[0]
        if (neoItem) {
          finalMinecraftVersion = await installNeoForge(minecraftVersion, neoItem.version, mcRootDir)
          await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
          taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt NeoForge thành công.')
        }
      } catch (err) {
        console.error('Failed to fallback install NeoForge:', err)
      }
    } else if (fallbackLoaders.includes('fabric')) {
      taskManagerService.updateTaskProgress(taskId, 25, `Đang tìm và cài đặt Fabric cho ${minecraftVersion}...`)
      try {
        const fabList = await getFabricVersions()
        const latestFabric = fabList[0]
        if (latestFabric) {
          finalMinecraftVersion = await installFabric(minecraftVersion, latestFabric.version, mcRootDir)
          await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
          taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt Fabric thành công.')
        }
      } catch (err) {
        console.error('Failed to fallback install Fabric:', err)
      }
    }
  }

  
  const normalizedProfileDir = path.resolve(profileGameDir)
    // 6. Download mods to profileGameDir (thư mục mods/ nằm trong profile riêng)
  if (indexData.files && indexData.files.length > 0) {
    taskManagerService.updateTaskProgress(taskId, 35, `Bắt đầu tải ${indexData.files.length} tệp mods/resourcepacks...`)
    
    
    const tasks = indexData.files
      .filter((file: any) => file.env?.client !== 'unsupported')
      .map((file: any, i: number) => {
        // url is typically in an array 'downloads'
        const downloadUrl = (file.downloads && file.downloads[0]) ? file.downloads[0] : null
        const destPath = path.resolve(profileGameDir, file.path)
        if (!destPath.startsWith(normalizedProfileDir + path.sep)) {
          throw new Error(`Phát hiện đường dẫn tệp không an toàn trong mrpack: ${file.path}`)
        }
        return {
          id: `file_${i}`,
          url: downloadUrl,
          destinationPath: destPath,
          sha1: file.hashes?.sha1,
          size: file.fileSize,
          label: path.basename(file.path)
        }
      }).filter((t: any) => !!t.url)
    
    await downloadTasks(tasks, {
      concurrency: 8,
      signal: taskManagerService.getAbortSignal(taskId),
      onProgress: (prog) => {
        if (prog.current % 10 === 0 || prog.current === prog.total) {
           const mappedPercent = 35 + (prog.percent * 0.45) // scale 0-100 to 35-80
           taskManagerService.updateTaskProgress(taskId, mappedPercent, `Tiến trình tải: ${prog.current}/${prog.total} (${prog.percent}%)`)
        }
      },
      onLog: (_level, _msg) => {
        // We let errors be handled by the try/catch
      }
    })
  }
  
  // 7. Extract overrides & client-overrides to profileGameDir
  const overrideFolders = [indexData.overrides || 'overrides', 'client-overrides']
  taskManagerService.updateTaskProgress(taskId, 85, `Đang giải nén tệp cấu hình (overrides)...`)

  for (const file of zipDirectory.files) {
    if (taskManagerService.isCancelled(taskId)) {
      throw new Error('Đã hủy tác vụ')
    }
    for (const folderName of overrideFolders) {
      if (file.path.startsWith(folderName + '/')) {
        const relativePath = file.path.substring(folderName.length + 1)
        if (!relativePath) break

        const destPath = path.resolve(profileGameDir, relativePath)
          if (!destPath.startsWith(normalizedProfileDir + path.sep)) {
            console.warn(`[ModrinthService] Bỏ qua tệp override không hợp lệ: ${file.path}`)
            break
          }
        if (file.type === 'Directory') {
          await fs.mkdir(destPath, { recursive: true })
        } else {
          await fs.mkdir(path.dirname(destPath), { recursive: true })
          const buf = await file.buffer()
          await fs.writeFile(destPath, buf)
        }
        break
      }
    }
  }

  // Tự động chuẩn hóa options.txt sang tiếng Việt cho modpack vừa cài
  try {
    const { applyDefaultGameOptions } = await import('../system/storageService.js')
    await applyDefaultGameOptions(profileGameDir, minecraftVersion)
  } catch (err) {
    console.warn('[ModrinthService] applyDefaultGameOptions error:', err)
  }
  
  taskManagerService.completeTask(taskId, `Cài đặt Modpack hoàn tất thành công! Đã tạo cấu hình ${profileName}.`, { profileId: createdProfile.id })
  
  // Clean up
  if (cleanupZip) {
    await fs.unlink(mrpackPath).catch(() => {})
  }
  
  return createdProfile.id
}

// --- Store Manager ---

export async function getStoreInstallations(gameDir: string): Promise<import('../../../shared/types').StoreInstallation[]> {
  const filePath = path.join(gameDir, 'store_installations.json')
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function saveStoreInstallations(gameDir: string, installations: import('../../../shared/types').StoreInstallation[]) {
  const filePath = path.join(gameDir, 'store_installations.json')
  await fs.mkdir(gameDir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(installations, null, 2))
}

export async function uninstallStoreItem(projectId: string, gameDir: string): Promise<boolean> {
  const installations = await getStoreInstallations(gameDir)
  const itemIndex = installations.findIndex(i => i.projectId === projectId)
  if (itemIndex === -1) return false

  const item = installations[itemIndex]
  if (!item) return false

  for (const file of item.files) {
    const fullPath = path.join(gameDir, file)
    await fs.unlink(fullPath).catch(() => {})
  }

  installations.splice(itemIndex, 1)
  await saveStoreInstallations(gameDir, installations)
  return true
}

export async function installModrinthMod(versionId: string, gameDir: string): Promise<string> {
  const taskId = taskManagerService.createTask(`Cài đặt Mod: ${versionId}`, 'install-mod')
  
  taskManagerService.updateTaskProgress(taskId, 10, 'Đang chuẩn bị tải...')
  Promise.resolve().then(async () => {
    try {
      await _installModrinthModRecursive(versionId, gameDir, taskId, new Set(), 0)
      taskManagerService.completeTask(taskId, 'Cài đặt Mod hoàn tất.', { gameDir })
    } catch (e) {
      try {
        taskManagerService.failTask(taskId, e instanceof Error ? e.message : 'Lỗi không xác định')
      } catch (failErr) {
        console.error('[Modrinth] Failed to update task status:', failErr)
      }
    }
  }).catch((unhandledErr) => {
    console.error('[Modrinth] Unhandled error in installModrinthMod:', unhandledErr)
  })
  
  return taskId
}

// ponytail: maxDepth = 10 bounds recursive dependency chain
async function _installModrinthModRecursive(
  versionId: string,
  gameDir: string,
  taskId: string,
  installedSet: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > 10) {
    console.warn(`[Modrinth] Dependency depth limit (10) reached for version ${versionId}. Skipping deeper dependencies.`)
    return
  }
  if (installedSet.has(versionId)) return
  installedSet.add(versionId)

  taskManagerService.updateTaskProgress(taskId, 10, `Đang lấy thông tin Mod...`)
  const client = await getModrinthClient()
  
  const versionInfo = await client.getProjectVersion(versionId) as any
  const primaryFile = versionInfo.files.find((f: any) => f.primary) || versionInfo.files[0]
  if (!primaryFile) throw new Error('Không tìm thấy tệp để tải')

  // Record installation and get project type
  const projectInfo = await client.getProject(versionInfo.project_id) as any
  const pType = projectInfo.project_type || 'mod' // 'mod', 'shader', 'resourcepack'

  let folderName = 'mods'
  if (pType === 'shader') folderName = 'shaderpacks'
  if (pType === 'resourcepack') folderName = 'resourcepacks'

  const targetDir = path.join(gameDir, folderName)
  await fs.mkdir(targetDir, { recursive: true })

  const safeFilename = path.basename(primaryFile.filename)
  const destFile = path.join(targetDir, safeFilename)
  taskManagerService.updateTaskProgress(taskId, 50, `Đang tải ${primaryFile.filename}...`)
  
  // ponytail: stream download to disk
  const signal = taskManagerService.getAbortSignal(taskId)
  const controller = new AbortController()
  const abortListener = () => controller.abort()
  signal?.addEventListener('abort', abortListener, { once: true })
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  let res: Response
  try {
    res = await fetch(primaryFile.url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortListener)
  }

  if (taskManagerService.isCancelled(taskId)) {
    throw new Error('Đã hủy tác vụ')
  }

  if (!res.ok) throw new Error(`Failed to download ${primaryFile.url}`)
  if (!res.body) throw new Error('Response body is null')
  await pipeline(
    Readable.fromWeb(res.body as any),
    createWriteStream(destFile)
  )

  // Track created file for rollback on cancel
  taskManagerService.registerCancelCallback(taskId, async () => {
    try {
      await fs.unlink(destFile).catch(() => {})
    } catch (err) {
      console.error('[Modrinth] Error unlinking downloaded mod on cancel:', err)
    }
  })

  if (taskManagerService.isCancelled(taskId)) {
    await fs.unlink(destFile).catch(() => {})
    throw new Error('Đã hủy tác vụ')
  }

  const installations = await getStoreInstallations(gameDir)
  
  // Remove existing if any
  const existingIdx = installations.findIndex(i => i.projectId === versionInfo.project_id)
  if (existingIdx !== -1) {
    const old = installations[existingIdx]
    if (old) {
      for (const f of old.files) {
        await fs.unlink(path.join(gameDir, f)).catch(() => {})
      }
    }
    installations.splice(existingIdx, 1)
  }

  installations.push({
    projectId: versionInfo.project_id,
    versionId: versionId,
    projectType: pType,
    title: projectInfo.title,
    versionName: versionInfo.name,
    installedAt: new Date().toISOString(),
    files: [path.join(folderName, safeFilename).replace(/\\/g, '/')]
  })

  await saveStoreInstallations(gameDir, installations)
  
  taskManagerService.updateTaskProgress(taskId, 80, `Đã cài đặt: ${projectInfo.title}`)

  // Install required dependencies
  if (versionInfo.dependencies && versionInfo.dependencies.length > 0) {
    for (const dep of versionInfo.dependencies) {
      if (dep.dependency_type === 'required') {
        if (dep.version_id) {
          taskManagerService.updateTaskProgress(taskId, 85, `Đang tải mod phụ thuộc...`)
          await _installModrinthModRecursive(dep.version_id, gameDir, taskId, installedSet, depth + 1)
        } else if (dep.project_id) {
          taskManagerService.updateTaskProgress(taskId, 85, `Đang tải mod phụ thuộc...`)
          try {
            // Match dependencies with the parent mod's game versions and loaders
            const parentGv = versionInfo.game_versions || []
            const parentLoaders = versionInfo.loaders || []
            const projVersions = await client.getProjectVersions(dep.project_id, {
              gameVersions: parentGv.length > 0 ? parentGv : undefined,
              loaders: parentLoaders.length > 0 ? parentLoaders : undefined,
            })
            if (projVersions && projVersions.length > 0) {
              const matchedVer = (projVersions as any[]).find((v: any) => v.version_type === 'release') || projVersions[0]
              await _installModrinthModRecursive((matchedVer as any).id, gameDir, taskId, installedSet, depth + 1)
            }
          } catch(e) {
            console.warn(`Không thể tải dependency dự án ${dep.project_id}`)
          }
        }
      }
    }
  }
}

