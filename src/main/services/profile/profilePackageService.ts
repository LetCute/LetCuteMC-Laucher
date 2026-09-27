import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
// adm-zip is lazy-loaded to reduce cold-start time
import type {
  ExportProfilePackageOptions,
  ExportProfileResult,
  PackagePreviewInfo,
  ImportProfileResult,
  ProfilePackageManifest,
  LauncherProfile,
} from '../../../shared/types'
import { getProfiles, createProfile } from './profileService'
import { detectMinecraftDirectory } from '../launcher/minecraftDirectoryService'

export class ProfilePackageService {
  /**
   * Xuất trọn gói cấu hình game thành tệp .letcutepack hoặc .zip
   */
  public async exportProfilePackage(
    options: ExportProfilePackageOptions
  ): Promise<ExportProfileResult> {
    try {
      const store = await getProfiles()
      const profile = store.profiles.find((p) => p.id === options.profileId)

      if (!profile) {
        return { success: false, error: 'Không tìm thấy cấu hình được yêu cầu.' }
      }

      const detected = await detectMinecraftDirectory()
      const gameDir = profile.gameDir && fs.existsSync(profile.gameDir)
        ? profile.gameDir
        : detected.path || ''

      if (!gameDir || !fs.existsSync(gameDir)) {
        return { success: false, error: 'Thư mục game của cấu hình không tồn tại.' }
      }

      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip()
      let modsCount = 0

      // 1. Include Mods
      if (options.includeMods) {
        const modsDir = path.join(gameDir, 'mods')
        if (fs.existsSync(modsDir) && fs.statSync(modsDir).isDirectory()) {
          const files = fs.readdirSync(modsDir)
          for (const file of files) {
            const fullPath = path.join(modsDir, file)
            if (fs.statSync(fullPath).isFile() && (file.endsWith('.jar') || file.endsWith('.jar.disabled'))) {
              zip.addLocalFile(fullPath, 'mods')
              modsCount++
            }
          }
        }
      }

      // 2. Include Config
      if (options.includeConfig) {
        const configDir = path.join(gameDir, 'config')
        if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
          zip.addLocalFolder(configDir, 'config')
        }
        const defaultConfigsDir = path.join(gameDir, 'defaultconfigs')
        if (fs.existsSync(defaultConfigsDir) && fs.statSync(defaultConfigsDir).isDirectory()) {
          zip.addLocalFolder(defaultConfigsDir, 'defaultconfigs')
        }
      }

      // 3. Include Shader Packs
      if (options.includeShaderPacks) {
        const shaderDir = path.join(gameDir, 'shaderpacks')
        if (fs.existsSync(shaderDir) && fs.statSync(shaderDir).isDirectory()) {
          zip.addLocalFolder(shaderDir, 'shaderpacks')
        }
      }

      // 4. Include Resource Packs
      if (options.includeResourcePacks) {
        const resDir = path.join(gameDir, 'resourcepacks')
        if (fs.existsSync(resDir) && fs.statSync(resDir).isDirectory()) {
          zip.addLocalFolder(resDir, 'resourcepacks')
        }
      }

      // 5. Include options.txt (keybinds, video settings)
      if (options.includeOptions) {
        const optionsTxt = path.join(gameDir, 'options.txt')
        if (fs.existsSync(optionsTxt) && fs.statSync(optionsTxt).isFile()) {
          zip.addLocalFile(optionsTxt, '')
        }
        const optionsShadersTxt = path.join(gameDir, 'optionsshaders.txt')
        if (fs.existsSync(optionsShadersTxt) && fs.statSync(optionsShadersTxt).isFile()) {
          zip.addLocalFile(optionsShadersTxt, '')
        }
        const optionsOfTxt = path.join(gameDir, 'optionsof.txt')
        if (fs.existsSync(optionsOfTxt) && fs.statSync(optionsOfTxt).isFile()) {
          zip.addLocalFile(optionsOfTxt, '')
        }
      }

      // 6. Include servers.dat
      if (options.includeServers) {
        const serversDat = path.join(gameDir, 'servers.dat')
        if (fs.existsSync(serversDat) && fs.statSync(serversDat).isFile()) {
          zip.addLocalFile(serversDat, '')
        }
      }

      // 7. Create Manifest
      const manifest: ProfilePackageManifest = {
        formatVersion: 1,
        appName: 'LetCuteMC',
        exportedAt: new Date().toISOString(),
        name: profile.name,
        minecraftVersion: profile.minecraftVersion,
        loader: profile.loader,
        loaderVersion: profile.loaderVersion,
        minMemoryMb: profile.minMemoryMb,
        maxMemoryMb: profile.maxMemoryMb,
        javaPath: profile.javaPath || null,
        jvmArgs: profile.jvmArgs || null,
        description: options.description || profile.description || '',
        author: options.author || 'LetCuteMC Player',
        includedFeatures: {
          mods: options.includeMods,
          config: options.includeConfig,
          shaderpacks: options.includeShaderPacks,
          resourcepacks: options.includeResourcePacks,
          options: options.includeOptions,
          servers: options.includeServers,
        },
        modsCount,
      }

      zip.addFile(
        'letcute-profile.json',
        Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8')
      )

      // Ensure destination directory exists
      const destDir = path.dirname(options.destinationPath)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      zip.writeZip(options.destinationPath)
      const stat = fs.statSync(options.destinationPath)

      return {
        success: true,
        outputPath: options.destinationPath,
        fileSizeBytes: stat.size,
      }
    } catch (err: any) {
      console.error('[ProfilePackageService] Export error:', err)
      return {
        success: false,
        error: err?.message || 'Có lỗi xảy ra khi đóng gói cấu hình.',
      }
    }
  }

  /**
   * Đọc và xem trước thông tin gói cấu hình (.letcutepack / .zip)
   */
  public async readPackageInfo(packageFilePath: string): Promise<PackagePreviewInfo> {
    try {
      if (!fs.existsSync(packageFilePath)) {
        return {
          valid: false,
          fileName: path.basename(packageFilePath),
          filePath: packageFilePath,
          fileSizeBytes: 0,
          error: 'Tệp không tồn tại.',
        }
      }

      const stat = fs.statSync(packageFilePath)
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(packageFilePath)
      const manifestEntry = zip.getEntry('letcute-profile.json')

      if (!manifestEntry) {
        return {
          valid: false,
          fileName: path.basename(packageFilePath),
          filePath: packageFilePath,
          fileSizeBytes: stat.size,
          error: 'Tệp không chứa tệp cấu hình letcute-profile.json hợp lệ.',
        }
      }

      const raw = manifestEntry.getData().toString('utf-8')
      const manifest: ProfilePackageManifest = JSON.parse(raw)

      return {
        valid: true,
        manifest,
        fileName: path.basename(packageFilePath),
        filePath: packageFilePath,
        fileSizeBytes: stat.size,
      }
    } catch (err: any) {
      console.error('[ProfilePackageService] Read package info error:', err)
      return {
        valid: false,
        fileName: path.basename(packageFilePath),
        filePath: packageFilePath,
        fileSizeBytes: 0,
        error: err?.message || 'Không thể đọc tệp gói cấu hình.',
      }
    }
  }

  /**
   * Nhập gói cấu hình game vào Launcher
   */
  public async importProfilePackage(
    packageFilePath: string,
    customName?: string
  ): Promise<ImportProfileResult> {
    try {
      const preview = await this.readPackageInfo(packageFilePath)
      if (!preview.valid || !preview.manifest) {
        return { success: false, error: preview.error || 'Gói cấu hình không hợp lệ.' }
      }

      const manifest = preview.manifest
      const detected = await detectMinecraftDirectory()
      const baseMcDir = detected.path || path.join(process.env.APPDATA || '', '.minecraft')

      // Create isolated profile directory
      const sanitizedName = (customName || manifest.name)
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim()
      const profileFolder = `${sanitizedName}_${Date.now().toString(36)}`
      const targetGameDir = path.join(baseMcDir, 'profiles', profileFolder)
      const normalizedTarget = path.resolve(targetGameDir)

      fs.mkdirSync(targetGameDir, { recursive: true })

      // Extract zip files into targetGameDir (skip letcute-profile.json)
      const AdmZip2 = (await import('adm-zip')).default
      const zip = new AdmZip2(packageFilePath)
      const zipEntries = zip.getEntries()

      for (const entry of zipEntries) {
        if (entry.entryName === 'letcute-profile.json') continue

        // Zip Slip security protection
        const resolvedEntry = path.resolve(targetGameDir, entry.entryName)
        if (!resolvedEntry.startsWith(normalizedTarget + path.sep) && resolvedEntry !== normalizedTarget) {
          console.warn(`[ProfilePackageService] Security warning: skipping suspicious entry ${entry.entryName}`)
          continue
        }

        if (entry.isDirectory) {
          if (!fs.existsSync(resolvedEntry)) {
            fs.mkdirSync(resolvedEntry, { recursive: true })
          }
        } else {
          const parentDir = path.dirname(resolvedEntry)
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true })
          }
          fs.writeFileSync(resolvedEntry, entry.getData())
        }
      }

      // Register new profile in profileService
      const profileName = customName && customName.trim() ? customName.trim() : manifest.name
      const newProfile: LauncherProfile = await createProfile({
        name: profileName,
        minecraftVersion: manifest.minecraftVersion,
        gameDir: targetGameDir,
        javaPath: manifest.javaPath || undefined,
        minMemoryMb: manifest.minMemoryMb,
        maxMemoryMb: manifest.maxMemoryMb,
        jvmArgs: manifest.jvmArgs || undefined,
        description: manifest.description,
      })

      // Đảm bảo options.txt chuẩn tiếng Việt cho profile vừa nhập
      try {
        const { applyDefaultGameOptions } = await import('../system/storageService.js')
        await applyDefaultGameOptions(targetGameDir, manifest.minecraftVersion)
      } catch {}

      return {
        success: true,
        profile: newProfile,
      }
    } catch (err: any) {
      console.error('[ProfilePackageService] Import package error:', err)
      return {
        success: false,
        error: err?.message || 'Có lỗi xảy ra khi nhập gói cấu hình.',
      }
    }
  }
}

export const profilePackageService = new ProfilePackageService()

