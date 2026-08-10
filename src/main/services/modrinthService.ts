import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import AdmZip from 'adm-zip'
import crypto from 'node:crypto'
import type { ModrinthSearchResult, ModrinthVersion } from '../../shared/types'
import { downloadTasks } from './download-manager'
import { createProfile } from './profileService'

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
  
  // 4. Create new profile
  const safeProfileName = profileName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const profileGameDir = path.join(gameDataDir, 'profiles', safeProfileName)
  
  const createdProfile = await createProfile({
    name: profileName,
    minecraftVersion: minecraftVersion,
    gameDir: profileGameDir,
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
  })
  appendLog('success', `Đã tạo Cấu hình game riêng biệt: ${profileName}`)
  
  // 5. Download mods to profileGameDir
  if (indexData.files && indexData.files.length > 0) {
    appendLog('info', `Bắt đầu tải ${indexData.files.length} tệp mods/resourcepacks...`)
    
    const tasks = indexData.files.map((file: any, i: number) => {
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
  
  // 6. Extract overrides to profileGameDir
  const overridesDir = indexData.overrides || 'overrides'
  appendLog('info', `Đang giải nén tệp cấu hình...`)
  
  for (const entry of zipEntries) {
    if (entry.entryName.startsWith(overridesDir + '/')) {
      const relativePath = entry.entryName.substring(overridesDir.length + 1)
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
  
  appendLog('success', `Cài đặt Modpack hoàn tất thành công! Bạn có thể chọn cấu hình ${profileName} để chơi.`)
  
  // Clean up
  await fs.unlink(mrpackPath).catch(() => {})
  
  return createdProfile.id
}
