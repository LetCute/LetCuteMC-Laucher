import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import AdmZip from 'adm-zip'
import crypto from 'node:crypto'
import type { ModrinthSearchResult, ModrinthVersion } from '../../shared/types'
import { downloadTasks } from './download-manager'
import { createProfile, updateProfile } from './profileService'
import { installFabric, installQuilt } from './modLoaderService'
import { ModrinthV2Client } from '@xmcl/modrinth'

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
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}`)
  
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await fs.writeFile(dest, buffer)
  return dest
}

export async function installModrinthModpack(versionId: string, profileName: string, gameDataDir: string, appendLog: (level: any, msg: string) => void): Promise<string> {
  appendLog('info', `Đang lấy thông tin Modpack phiên bản ${versionId}...`)
  
  // 1. Fetch version details
  let versionInfo: any;
  try {
    versionInfo = await client.getProjectVersion(versionId)
  } catch(e) {
    throw new Error('Không thể lấy thông tin phiên bản Modpack')
  }
  
  const mrpackFile = versionInfo.files.find((f: any) => f.filename.endsWith('.mrpack'))
  if (!mrpackFile) throw new Error('Không tìm thấy file .mrpack trong phiên bản này')
  
  // 2. Download .mrpack
  appendLog('info', `Đang tải file .mrpack...`)
  const mrpackPath = await downloadFileToTemp(mrpackFile.url, mrpackFile.filename)
  
  // 3. Extract and parse modrinth.index.json
  appendLog('info', `Đang phân tích cấu trúc Modpack...`)
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
  appendLog('success', `Đã tạo Cấu hình game riêng biệt: ${profileName}`)
  
  // Install Modloader if needed
  let finalMinecraftVersion = minecraftVersion;
  if (indexData.dependencies) {
    if (indexData.dependencies['fabric-loader']) {
      appendLog('info', `Đang cài đặt Fabric Loader ${indexData.dependencies['fabric-loader']}...`)
      // Cài Fabric vào mcRootDir (thư mục .minecraft chính) để versions/ và libraries/ được tạo đúng chỗ
      finalMinecraftVersion = await installFabric(minecraftVersion, indexData.dependencies['fabric-loader'], mcRootDir)
      await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
      appendLog('success', 'Cài đặt Fabric thành công.')
    } else if (indexData.dependencies['quilt-loader']) {
      appendLog('info', `Đang cài đặt Quilt Loader ${indexData.dependencies['quilt-loader']}...`)
      // Cài Quilt vào mcRootDir (thư mục .minecraft chính)
      finalMinecraftVersion = await installQuilt(minecraftVersion, indexData.dependencies['quilt-loader'], mcRootDir)
      await updateProfile(createdProfile.id, { minecraftVersion: finalMinecraftVersion })
      appendLog('success', 'Cài đặt Quilt thành công.')
    }
    // Note: Forge/NeoForge is not currently fully implemented in the launcher API for one-click install
  }
  
  // 6. Download mods to profileGameDir (thư mục mods/ nằm trong profile riêng)
  if (indexData.files && indexData.files.length > 0) {
    appendLog('info', `Bắt đầu tải ${indexData.files.length} tệp mods/resourcepacks...`)
    
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
           appendLog('info', `Tiến trình tải: ${prog.current}/${prog.total} (${prog.percent}%)`)
        }
      },
      onLog: (level, msg) => {
        if (level === 'error') appendLog('error', msg)
      }
    })
  }
  
  // 7. Extract overrides & client-overrides to profileGameDir
  const overrideFolders = [indexData.overrides || 'overrides', 'client-overrides']
  appendLog('info', `Đang giải nén tệp cấu hình (overrides)...`)
  
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
  
  appendLog('success', `Cài đặt Modpack hoàn tất thành công! Bạn có thể chọn cấu hình ${profileName} để chơi.`)
  
  // Clean up
  await fs.unlink(mrpackPath).catch(() => {})
  
  return createdProfile.id
}

// --- Store Manager ---

export async function getStoreInstallations(gameDir: string): Promise<import('../../shared/types').StoreInstallation[]> {
  const filePath = path.join(gameDir, 'store_installations.json')
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function saveStoreInstallations(gameDir: string, installations: import('../../shared/types').StoreInstallation[]) {
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

export async function installModrinthMod(versionId: string, gameDir: string, appendLog?: (level: any, msg: string) => void): Promise<void> {
  if (appendLog) appendLog('info', `Đang lấy thông tin Mod...`)
  
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
  if (appendLog) appendLog('info', `Đang tải ${primaryFile.filename}...`)
  
  const res = await fetch(primaryFile.url)
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
  
  if (appendLog) appendLog('success', `Đã cài đặt Mod thành công!`)
}
