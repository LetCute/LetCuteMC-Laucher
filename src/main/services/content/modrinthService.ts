import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
// adm-zip is lazy-loaded to reduce cold-start time
import crypto from 'node:crypto'
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
import { ModrinthV2Client } from '@xmcl/modrinth'

import { taskManagerService } from '../system/taskManagerService.js'

const client = new ModrinthV2Client()

export async function searchModrinth(query: string, projectType: string = 'modpack', offset: number = 0): Promise<ModrinthSearchResult> {
  const res = await client.searchProjects({
    query,
    facets: `[["project_type:${projectType}"]]`,
    offset,
    limit: 20
  })
  return res as unknown as ModrinthSearchResult
}

export async function getModrinthVersions(projectId: string): Promise<ModrinthVersion[]> {
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
  
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await fs.writeFile(dest, buffer)
  return dest
}

export async function installModrinthModpack(versionId: string, profileName: string, gameDataDir: string): Promise<string> {
  const taskId = taskManagerService.createTask(`Cài đặt Modpack: ${profileName}`, 'install-modpack')
  
  // Run async
  Promise.resolve().then(async () => {
    try {
      taskManagerService.updateTaskProgress(taskId, 5, `Đang lấy thông tin Modpack phiên bản ${versionId}...`)
      
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
    } catch (e: any) {
      taskManagerService.failTask(taskId, e.message || 'Lỗi không xác định')
    }
  })
  
  return taskId
}

export async function installLocalModrinthModpack(mrpackPath: string, profileName: string, gameDataDir: string): Promise<string> {
  const taskId = taskManagerService.createTask(`Cài đặt Modpack từ tệp: ${profileName}`, 'install-modpack')
  
  // Run async
  Promise.resolve().then(async () => {
    try {
      await _installMrpack(mrpackPath, profileName, gameDataDir, taskId, false)
    } catch (e: any) {
      taskManagerService.failTask(taskId, e.message || 'Lỗi không xác định')
    }
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
  const AdmZip = (await import('adm-zip')).default
  const zip = new AdmZip(mrpackPath)
  const zipEntries = zip.getEntries()
  
  const indexEntry = zipEntries.find(e => e.entryName === 'modrinth.index.json')
  if (!indexEntry) throw new Error('File .mrpack không hợp lệ (thiếu modrinth.index.json)')
  
  const indexContent = zip.readAsText(indexEntry)
  const indexData = JSON.parse(indexContent)
  
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
        if (fabList.length > 0) {
          finalMinecraftVersion = await installFabric(minecraftVersion, fabList[0].version, mcRootDir)
          await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
          taskManagerService.updateTaskProgress(taskId, 30, 'Cài đặt Fabric thành công.')
        }
      } catch (err) {
        console.error('Failed to fallback install Fabric:', err)
      }
    }
  }

  
  // 6. Download mods to profileGameDir (thư mục mods/ nằm trong profile riêng)
  if (indexData.files && indexData.files.length > 0) {
    taskManagerService.updateTaskProgress(taskId, 35, `Bắt đầu tải ${indexData.files.length} tệp mods/resourcepacks...`)
    
    const tasks = indexData.files
      .filter((file: any) => file.env?.client !== 'unsupported')
      .map((file: any, i: number) => {
        // url is typically in an array 'downloads'
        const downloadUrl = (file.downloads && file.downloads[0]) ? file.downloads[0] : null
        return {
          id: `file_${i}`,
          url: downloadUrl,
          destinationPath: path.join(profileGameDir, file.path),
          sha1: file.hashes?.sha1,
          size: file.fileSize,
          label: path.basename(file.path)
        }
      }).filter((t: any) => !!t.url)
    
    await downloadTasks(tasks, {
      concurrency: 8,
      onProgress: (prog) => {
        if (prog.current % 10 === 0 || prog.current === prog.total) {
           const mappedPercent = 35 + (prog.percent * 0.45) // scale 0-100 to 35-80
           taskManagerService.updateTaskProgress(taskId, mappedPercent, `Tiến trình tải: ${prog.current}/${prog.total} (${prog.percent}%)`)
        }
      },
      onLog: (level, msg) => {
        if (level === 'error') {
           // We could log error but we let the throw handle it
        }
      }
    })
  }
  
  // 7. Extract overrides & client-overrides to profileGameDir
  const overrideFolders = [indexData.overrides || 'overrides', 'client-overrides']
  taskManagerService.updateTaskProgress(taskId, 85, `Đang giải nén tệp cấu hình (overrides)...`)
  
  for (const entry of zipEntries) {
    for (const folderName of overrideFolders) {
      if (entry.entryName.startsWith(folderName + '/')) {
        const relativePath = entry.entryName.substring(folderName.length + 1)
        if (!relativePath) continue // is root dir
        
        const destPath = path.join(profileGameDir, relativePath)
        if (entry.isDirectory) {
          await fs.mkdir(destPath, { recursive: true })
        } else {
          await fs.mkdir(path.dirname(destPath), { recursive: true })
          const buffer = entry.getData()
          await fs.writeFile(destPath, buffer)
        }
      }
    }
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
      await _installModrinthModRecursive(versionId, gameDir, taskId, new Set())
      taskManagerService.completeTask(taskId, 'Cài đặt Mod hoàn tất.', { gameDir })
    } catch (e: any) {
      taskManagerService.failTask(taskId, e.message || 'Lỗi không xác định')
    }
  })
  
  return taskId
}

async function _installModrinthModRecursive(versionId: string, gameDir: string, taskId: string, installedSet: Set<string>): Promise<void> {
  if (installedSet.has(versionId)) return
  installedSet.add(versionId)

  taskManagerService.updateTaskProgress(taskId, 10, `Đang lấy thông tin Mod...`)
  
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

  const destFile = path.join(targetDir, primaryFile.filename)
  taskManagerService.updateTaskProgress(taskId, 50, `Đang tải ${primaryFile.filename}...`)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)
  const res = await fetch(primaryFile.url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
  if (!res.ok) throw new Error(`Failed to download ${primaryFile.url}`)
  
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await fs.writeFile(destFile, buffer)

  const installations = await getStoreInstallations(gameDir)
  
  // Remove existing if any
  const existingIdx = installations.findIndex(i => i.projectId === versionInfo.project_id)
  if (existingIdx !== -1) {
    const old = installations[existingIdx]
    for (const f of old.files) {
      await fs.unlink(path.join(gameDir, f)).catch(() => {})
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
    files: [path.join(folderName, primaryFile.filename).replace(/\\/g, '/')]
  })

  await saveStoreInstallations(gameDir, installations)
  
  taskManagerService.updateTaskProgress(taskId, 80, `Đã cài đặt: ${projectInfo.title}`)

  // Install required dependencies
  if (versionInfo.dependencies && versionInfo.dependencies.length > 0) {
    for (const dep of versionInfo.dependencies) {
      if (dep.dependency_type === 'required') {
        if (dep.version_id) {
          taskManagerService.updateTaskProgress(taskId, 85, `Đang tải mod phụ thuộc...`)
          await _installModrinthModRecursive(dep.version_id, gameDir, taskId, installedSet)
        } else if (dep.project_id) {
          taskManagerService.updateTaskProgress(taskId, 85, `Đang tải mod phụ thuộc...`)
          try {
             const projVersions = await client.getProjectVersions(dep.project_id)
             if (projVersions && projVersions.length > 0) {
                 await _installModrinthModRecursive((projVersions[0] as any).id, gameDir, taskId, installedSet)
             }
          } catch(e) {
             console.warn(`Không thể tải dependency dự án ${dep.project_id}`)
          }
        }
      }
    }
  }
}

