import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import https from 'node:https'
import { createWriteStream } from 'node:fs'
import type {
  JvmPresetType,
  JvmPresetInfo,
  CacheScanResult,
  CacheCleanResult,
  CacheItemDetail,
  OptimizeVideoSettingsOptions,
  OptimizeVideoSettingsResult,
  LowEndBoostCheckResult,
  EssentialModItem,
  InstallEssentialModResult,
  InstallAllEssentialModsResult,
} from '../../../shared/types'
import { detectMinecraftDirectory } from '../launcher/minecraftDirectoryService'
import { extractBaseMinecraftVersion, detectLoaderFromVersion } from '../content/modDependencyService'

const USER_AGENT = 'LetCuteMC-Launcher/1.0 (contact@letcute.com)'

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination)
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location
        if (redirect) {
          file.close()
          return downloadFile(redirect, destination).then(resolve).catch(reject)
        }
      }
      if (res.statusCode !== 200) {
        file.close()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      reject(err)
    })
  })
}

async function fetchModrinthJson<T>(endpoint: string): Promise<T | null> {
  return new Promise((resolve) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.modrinth.com/v2${endpoint}`)
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          resolve(null)
          return
        }
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.setTimeout(10000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

export const JVM_PRESETS: JvmPresetInfo[] = [
  {
    id: 'aikar',
    name: "Aikar's Flags (G1GC)",
    tagline: 'Khuyến nghị toàn diện cho FPS ổn định & giảm giật đứng',
    description: 'Bộ cờ chuẩn được tối ưu hóa chuyên sâu cho Minecraft. Phân bổ vùng nhớ G1GC hợp lý, ngăn chặn tình trạng drop FPS đột ngột khi load chunk.',
    minJavaVersion: 8,
    recommended: true,
    flags: [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
    ],
  },
  {
    id: 'ultra_low_end',
    name: '⚡ Siêu Nhẹ & Chống Khựng Đứng (Ultra Anti-Stutter)',
    tagline: 'Gom rác 15ms, PreTouch phân bổ RAM trước & gộp chuỗi trùng lặp cho máy yếu',
    description: 'Tối ưu triệt để cho máy yếu (2-4GB RAM, CPU 2 nhân). Rút ngắn thời gian tạm dừng của GC xuống tối đa 15ms để triệt tiêu tình trạng khựng đứng/đơ hình.',
    minJavaVersion: 8,
    recommended: false,
    flags: [
      '-XX:+UseG1GC',
      '-XX:MaxGCPauseMillis=15',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1ReservePercent=15',
      '-XX:+UseStringDeduplication',
      '-XX:+ParallelRefProcEnabled',
      '-XX:+OptimizeStringConcat',
      '-XX:+PerfDisableSharedMem',
      '-XX:G1NewSizePercent=20',
      '-XX:G1MaxNewSizePercent=30',
      '-XX:SurvivorRatio=32',
      '-Dsun.rmi.dgc.client.gcInterval=3600000',
      '-Dsun.rmi.dgc.server.gcInterval=3600000',
      '-Dcom.sun.management.jmxremote=false',
    ],
  },
  {
    id: 'shenandoah',
    name: 'Shenandoah GC',
    tagline: 'Độ trễ siêu thấp (Ultra-Low Latency) cho máy RAM > 8GB',
    description: 'Bộ thu gom rác thế hệ mới của Red Hat / OpenJDK. Thực hiện gom rác song song mà không cần dừng luồng game, giảm thời gian giật (pause time) xuống dưới 3ms.',
    minJavaVersion: 17,
    recommended: false,
    flags: [
      '-XX:+UseShenandoahGC',
      '-XX:ShenandoahGCMode=iu',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+AlwaysPreTouch',
      '-XX:+DisableExplicitGC',
      '-XX:+PerfDisableSharedMem',
    ],
  },
  {
    id: 'zgc',
    name: 'ZGC Generational (Java 21+)',
    tagline: 'Bộ thu gom rác tối tân nhất với độ trễ < 1ms',
    description: 'Z Garbage Collector dạng phân tầng thế hệ (Generational ZGC). Quản lý bộ nhớ mượt mà, tối ưu nhất cho Minecraft các phiên bản mới trên Java 21+.',
    minJavaVersion: 21,
    recommended: false,
    flags: [
      '-XX:+UseZGC',
      '-XX:+ZGenerational',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+AlwaysPreTouch',
      '-XX:+DisableExplicitGC',
      '-XX:+PerfDisableSharedMem',
    ],
  },
  {
    id: 'low_end',
    name: 'Máy Cấu hình Yếu / Low-End PC',
    tagline: 'Tiết kiệm CPU & RAM, bật nén chuỗi String Deduplication',
    description: 'Tối ưu cho laptop hoặc máy tính cấu hình văn phòng/yếu. Tối thiểu hóa mức chiếm dụng CPU của bộ thu gom rác và gộp các chuỗi bộ nhớ trùng lặp.',
    minJavaVersion: 8,
    recommended: false,
    flags: [
      '-XX:+UseG1GC',
      '-XX:MaxGCPauseMillis=50',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:G1ReservePercent=15',
      '-XX:+UseStringDeduplication',
    ],
  },
  {
    id: 'default',
    name: 'Mặc định Java (Vanilla Default)',
    tagline: 'Sử dụng cấu hình GC nguyên bản của máy ảo Java',
    description: 'Không áp dụng thêm cờ tối ưu hóa bộ nhớ nào, giữ nguyên các thông số mặc định của Java Runtime.',
    minJavaVersion: 8,
    recommended: false,
    flags: [],
  },
]

export const ESSENTIAL_LOW_END_MODS: Array<{ id: string; name: string; slug: string; category: EssentialModItem['category']; description: string; impact: EssentialModItem['impact'] }> = [
  {
    id: 'sodium',
    name: 'Sodium / Embeddium',
    slug: 'sodium',
    category: 'render',
    description: 'Thay thế engine render gốc bằng OpenGL hiện đại, tăng từ 2x đến 5x FPS trên mọi cấu hình.',
    impact: 'extreme',
  },
  {
    id: 'lithium',
    name: 'Lithium / Radium',
    slug: 'lithium',
    category: 'cpu',
    description: 'Tối ưu hóa logic vật lý, AI quái vật và chunk tick, giảm 40% mức sử dụng CPU.',
    impact: 'high',
  },
  {
    id: 'ferritecore',
    name: 'FerriteCore',
    slug: 'ferrite-core',
    category: 'memory',
    description: 'Nén và tối ưu hóa bộ nhớ RAM, giảm dung lượng RAM Minecraft chiếm dụng từ 30% đến 50%.',
    impact: 'extreme',
  },
  {
    id: 'modernfix',
    name: 'ModernFix',
    slug: 'modernfix',
    category: 'memory',
    description: 'Sửa lỗi rò rỉ bộ nhớ, tăng tốc độ load game lên 2x và giảm giật khung hình.',
    impact: 'high',
  },
  {
    id: 'immediatelyfast',
    name: 'ImmediatelyFast',
    slug: 'immediatelyfast',
    category: 'fps',
    description: 'Tối ưu hóa render HUD, chữ viết, màn hình kho đồ và bảng tên để không bị drop FPS khi mở GUI.',
    impact: 'medium',
  },
  {
    id: 'entityculling',
    name: 'Entity Culling',
    slug: 'entityculling',
    category: 'render',
    description: 'Ẩn các thực thể và mob nằm sau tường hoặc ngoài tầm nhìn để tiết kiệm sức mạnh GPU.',
    impact: 'high',
  },
]

export class OptimizerService {
  /**
   * Trả về danh sách định nghĩa các bộ cờ JVM
   */
  public getJvmPresets(): JvmPresetInfo[] {
    return JVM_PRESETS
  }

  /**
   * Xây dựng danh sách cờ JVM tối ưu hóa tương thích với phiên bản Java
   */
  public buildOptimizedJvmArgs(options: {
    preset?: JvmPresetType
    customJvmArgs?: string
    javaMajorVersion: number
    maxRamMb?: number
  }): string[] {
    const { preset = 'aikar', customJvmArgs = '', javaMajorVersion } = options
    const args: string[] = []

    // 1. Thêm Java 17+ native access and reflection bypass
    if (javaMajorVersion >= 17) {
      args.push(
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

    // 2. Tìm Preset được chọn
    let selectedPreset = JVM_PRESETS.find((p) => p.id === preset)
    if (!selectedPreset) {
      selectedPreset = JVM_PRESETS[0] // fallback to aikar
    }

    // Kiểm tra tương thích phiên bản Java:
    // Nếu chọn ZGC nhưng Java < 21 hoặc Shenandoah nhưng Java < 17, fallback về Aikar's G1GC
    if (selectedPreset.minJavaVersion > javaMajorVersion) {
      console.warn(
        `[OptimizerService] Preset ${selectedPreset.name} yêu cầu Java >= ${selectedPreset.minJavaVersion}, nhưng runtime là Java ${javaMajorVersion}. Tự động chuyển về Aikar's Flags.`
      )
      selectedPreset = JVM_PRESETS[0]
    }

    // Thêm các cờ của Preset
    if (selectedPreset.flags.length > 0) {
      for (const flag of selectedPreset.flags) {
        // Filter out ZGenerational if Java is less than 21
        if (flag.includes('ZGenerational') && javaMajorVersion < 21) continue
        args.push(flag)
      }
    }

    // 3. Thêm Custom Extra JVM Args người dùng nhập
    if (customJvmArgs && customJvmArgs.trim()) {
      const tokens = customJvmArgs.trim().split(/\s+/).filter(Boolean)
      for (const token of tokens) {
        if (!args.includes(token)) {
          args.push(token)
        }
      }
    }

    return args
  }

  /**
   * Trả về biến môi trường ép chạy Card đồ họa rời (High-Performance GPU)
   */
  public getGpuEnvironmentVariables(enableDedicatedGpu = true): Record<string, string> {
    if (!enableDedicatedGpu) return {}

    return {
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only',
      DRI_PRIME: '1',
      SHIM_MCCOMPAT: '1',
    }
  }

  /**
   * Tinh chỉnh tùy chọn đồ họa options.txt trong game cho máy yếu
   */
  public async optimizeInGameVideoSettings(
    options: OptimizeVideoSettingsOptions
  ): Promise<OptimizeVideoSettingsResult> {
    const resolvedDir = await this.resolveGameDir(options.gameDir)
    if (!resolvedDir) {
      return {
        success: false,
        optionsPath: '',
        changesApplied: [],
        sodiumConfigUpdated: false,
        message: 'Không tìm thấy thư mục game.',
      }
    }

    const optionsPath = path.join(resolvedDir, 'options.txt')
    const changesApplied: string[] = []

    try {
      let lines: string[] = []
      if (fs.existsSync(optionsPath)) {
        const content = fs.readFileSync(optionsPath, 'utf8')
        lines = content.split(/\r?\n/)
      }

      const map = new Map<string, string>()
      for (const line of lines) {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          map.set(line.slice(0, colonIdx).trim(), line.slice(colonIdx + 1).trim())
        }
      }

      if (options.level === 'ultra_potato') {
        const renderDist = String(options.customRenderDistance ?? 6)
        map.set('renderDistance', renderDist)
        map.set('simulationDistance', '4')
        map.set('mipmapLevels', '0')
        map.set('graphicsMode', '0') // Fast
        map.set('ao', '0') // Ambient occlusion off
        map.set('particles', '2') // Minimal
        map.set('renderClouds', 'false')
        map.set('entityDistanceScaling', '0.5')
        map.set('biomeBlendRadius', '0')
        map.set('entityShadows', 'false')
        map.set('enableVsync', 'false')
        map.set('distortionEffectsScale', '0.0')
        map.set('fovEffectScale', '0.0')
        map.set('maxFps', '120')

        changesApplied.push(
          `Render Distance: ${renderDist} chunks`,
          'Simulation Distance: 4 chunks',
          'Mipmap Levels: 0 (Tắt sinh mipmap, tiết kiệm VRAM tối đa)',
          'Đồ họa: Nhanh (Fast Graphics)',
          'Ánh sáng mượt (Smooth Lighting): Tắt',
          'Hiệu ứng hạt (Particles): Tối thiểu',
          'Mây trời (Clouds): Tắt',
          'Khoảng cách thực thể (Entity Distance): 50%',
          'Hòa trộn sinh cảnh (Biome Blend): 0'
        )
      } else if (options.level === 'balanced_low') {
        map.set('renderDistance', '8')
        map.set('simulationDistance', '6')
        map.set('mipmapLevels', '1')
        map.set('graphicsMode', '0')
        map.set('ao', '1')
        map.set('particles', '1')
        map.set('renderClouds', 'fast')
        map.set('entityDistanceScaling', '0.8')
        map.set('biomeBlendRadius', '1')
        map.set('entityShadows', 'true')

        changesApplied.push(
          'Render Distance: 8 chunks',
          'Simulation Distance: 6 chunks',
          'Mipmap Levels: 1',
          'Đồ họa: Nhanh',
          'Ánh sáng mượt: Tối thiểu',
          'Mây trời: Nhanh'
        )
      } else {
        // Restore Default
        map.set('renderDistance', '12')
        map.set('simulationDistance', '10')
        map.set('mipmapLevels', '4')
        map.set('graphicsMode', '1') // Fancy
        map.set('ao', '2') // Max
        map.set('particles', '0') // All
        map.set('renderClouds', 'true')
        map.set('entityDistanceScaling', '1.0')
        map.set('biomeBlendRadius', '2')
        map.set('entityShadows', 'true')

        changesApplied.push('Khôi phục cấu hình đồ họa mặc định (12 chunks, Fancy, Mipmap 4)')
      }

      // Reconstruct options.txt
      const newLines: string[] = []
      for (const [k, v] of map.entries()) {
        newLines.push(`${k}:${v}`)
      }
      fs.writeFileSync(optionsPath, newLines.join('\n') + '\n', 'utf8')

      // Tune Sodium/Embeddium if config folder exists
      let sodiumConfigUpdated = false
      const configDir = path.join(resolvedDir, 'config')
      const sodiumPath = path.join(configDir, 'sodium-options.json')
      if (fs.existsSync(sodiumPath) && options.level === 'ultra_potato') {
        try {
          const sodiumRaw = fs.readFileSync(sodiumPath, 'utf8')
          const sodiumJson = JSON.parse(sodiumRaw)
          if (sodiumJson.quality) {
            sodiumJson.quality.leaves_quality = 'fast'
            sodiumJson.quality.enable_entity_culling = true
            sodiumJson.quality.particle_quality = 'low'
            fs.writeFileSync(sodiumPath, JSON.stringify(sodiumJson, null, 2), 'utf8')
            sodiumConfigUpdated = true
            changesApplied.push('Đã tối ưu cấu hình Sodium / Embeddium (Leaf culling, Entity culling)')
          }
        } catch {}
      }

      return {
        success: true,
        optionsPath,
        changesApplied,
        sodiumConfigUpdated,
        message: `Đã áp dụng thành công ${changesApplied.length} tùy chỉnh tối ưu cho Minecraft!`,
      }
    } catch (err: any) {
      console.error('[OptimizerService] Optimize video settings error:', err)
      return {
        success: false,
        optionsPath,
        changesApplied: [],
        sodiumConfigUpdated: false,
        message: err?.message || 'Có lỗi khi lưu tùy chọn đồ họa.',
      }
    }
  }

  /**
   * Kiểm tra trạng thái tối ưu hóa máy yếu hiện tại
   */
  public async checkLowEndOptimizationStatus(gameDir?: string): Promise<LowEndBoostCheckResult> {
    const resolvedDir = await this.resolveGameDir(gameDir)
    let currentRenderDistance = 12
    let mipmapLevels = 4
    let cloudsEnabled = true
    let fastGraphics = false

    if (resolvedDir) {
      const optionsPath = path.join(resolvedDir, 'options.txt')
      if (fs.existsSync(optionsPath)) {
        try {
          const content = fs.readFileSync(optionsPath, 'utf8')
          for (const line of content.split(/\r?\n/)) {
            if (line.startsWith('renderDistance:')) {
              currentRenderDistance = parseInt(line.split(':')[1], 10) || 12
            } else if (line.startsWith('mipmapLevels:')) {
              mipmapLevels = parseInt(line.split(':')[1], 10) || 4
            } else if (line.startsWith('renderClouds:')) {
              cloudsEnabled = line.split(':')[1]?.trim() !== 'false'
            } else if (line.startsWith('graphicsMode:')) {
              fastGraphics = line.split(':')[1]?.trim() === '0'
            }
          }
        } catch {}
      }
    }

    // Inspect installed mods
    const modsDir = resolvedDir ? path.join(resolvedDir, 'mods') : ''
    let installedModFiles: string[] = []
    if (modsDir && fs.existsSync(modsDir)) {
      try {
        installedModFiles = fs.readdirSync(modsDir).map((f) => f.toLowerCase())
      } catch {}
    }

    const essentialMods: EssentialModItem[] = ESSENTIAL_LOW_END_MODS.map((m) => {
      const isInstalled = installedModFiles.some(
        (f) => f.endsWith('.jar') && (f.includes(m.id) || f.includes(m.slug.replace('-', '')))
      )
      return {
        ...m,
        installed: isInstalled,
      }
    })

    const isOptimized = mipmapLevels === 0 && currentRenderDistance <= 8 && fastGraphics

    return {
      isOptimized,
      currentPreset: 'ultra_low_end',
      currentRenderDistance,
      mipmapLevels,
      cloudsEnabled,
      fastGraphics,
      essentialMods,
    }
  }

  /**
   * Tăng ưu tiên CPU cho tiến trình Minecraft để ngăn chặn micro-stutters do ứng dụng nền
   */
  public applyGameProcessBoost(pid: number): boolean {
    if (!pid || pid <= 0) return false
    try {
      if (os.constants?.priority?.PRIORITY_ABOVE_NORMAL !== undefined) {
        os.setPriority(pid, os.constants.priority.PRIORITY_ABOVE_NORMAL)
        return true
      }
    } catch (err) {
      console.warn('[OptimizerService] Could not set process priority:', err)
    }
    return false
  }

  /**
   * Quét và tính toán dung lượng bộ nhớ đệm có thể dọn dẹp trên toàn bộ cấu hình và launcher
   */
  public async scanCache(gameDir?: string): Promise<CacheScanResult> {
    const allDirs = await this.resolveAllGameDirs(gameDir)
    const items: CacheItemDetail[] = []
    
    const oldLogsSet = new Set<string>()
    let oldLogsSize = 0

    const crashReportsSet = new Set<string>()
    let crashReportsSize = 0

    const tempCacheSet = new Set<string>()
    let tempCacheSize = 0

    // 1. Quét logs cũ (.gz, .log.gz, các log cũ không phải latest.log) và crash logs (.hprof, hs_err_pid)
    for (const d of allDirs) {
      // Logs dir
      const logsDir = path.join(d, 'logs')
      const logsRes = this.scanFilesByPattern(
        logsDir,
        (f) => f.endsWith('.gz') || f.endsWith('.log.gz') || (f.endsWith('.log') && f !== 'latest.log')
      )
      for (const file of logsRes.files) {
        if (!oldLogsSet.has(file)) {
          oldLogsSet.add(file)
          try {
            oldLogsSize += fs.statSync(file).size
          } catch {}
        }
      }

      // Root directory crash dumps (hs_err_pid*.log, *.hprof)
      const rootCrashRes = this.scanFilesByPattern(
        d,
        (f) => f.startsWith('hs_err_pid') || f.startsWith('replay_pid') || f.endsWith('.hprof'),
        1
      )
      for (const file of rootCrashRes.files) {
        if (!crashReportsSet.has(file)) {
          crashReportsSet.add(file)
          try {
            crashReportsSize += fs.statSync(file).size
          } catch {}
        }
      }

      // 2. Crash Reports dir
      const crashDir = path.join(d, 'crash-reports')
      const crashRes = this.scanFilesByPattern(crashDir, (f) => f.endsWith('.txt') || f.endsWith('.log'))
      for (const file of crashRes.files) {
        if (!crashReportsSet.has(file)) {
          crashReportsSet.add(file)
          try {
            crashReportsSize += fs.statSync(file).size
          } catch {}
        }
      }

      // 3. Temp caches (.mixin.out, webcache, .fabric, .forge, .cache)
      const tempFolders = ['.mixin.out', 'webcache', '.fabric', '.forge', '.cache']
      for (const tf of tempFolders) {
        const fullTf = path.join(d, tf)
        const tfRes = this.scanFilesByPattern(fullTf, () => true, 4)
        for (const file of tfRes.files) {
          if (!tempCacheSet.has(file)) {
            tempCacheSet.add(file)
            try {
              tempCacheSize += fs.statSync(file).size
            } catch {}
          }
        }
      }
    }

    // 4. Quét launcher data cache (~/.letcutemc/cache, temp)
    try {
      const { getLauncherDataDirectory } = await import('./storageService.js')
      const launcherDataDir = getLauncherDataDirectory()
      const launcherCacheDir = path.join(launcherDataDir, 'cache')
      const launcherTempDir = path.join(launcherDataDir, 'temp')

      for (const ld of [launcherCacheDir, launcherTempDir]) {
        if (fs.existsSync(ld)) {
          const ldRes = this.scanFilesByPattern(
            ld,
            (f) => !f.includes('profiles') && !f.includes('settings') && !f.includes('account'),
            3
          )
          for (const file of ldRes.files) {
            if (!tempCacheSet.has(file)) {
              tempCacheSet.add(file)
              try {
                tempCacheSize += fs.statSync(file).size
              } catch {}
            }
          }
        }
      }
    } catch {}

    const oldLogsPaths = Array.from(oldLogsSet)
    items.push({
      key: 'old_logs',
      label: 'Nhật ký cũ (Old Logs & Archives)',
      description: 'Các tệp log và tệp nén .log.gz từ những lần chơi trước',
      sizeBytes: oldLogsSize,
      fileCount: oldLogsPaths.length,
      paths: oldLogsPaths,
    })

    const crashReportsPaths = Array.from(crashReportsSet)
    items.push({
      key: 'crash_reports',
      label: 'Báo cáo lỗi (Crash Reports)',
      description: 'Các tệp báo cáo crash game cũ đã được ghi nhận',
      sizeBytes: crashReportsSize,
      fileCount: crashReportsPaths.length,
      paths: crashReportsPaths,
    })

    const tempCachePaths = Array.from(tempCacheSet)
    items.push({
      key: 'temp_cache',
      label: 'Bộ nhớ đệm tạm thời (Temp Cache & Mixin)',
      description: 'Tệp cache trung gian của Fabric/Forge mixin, web cache và tệp nén tải về',
      sizeBytes: tempCacheSize,
      fileCount: tempCachePaths.length,
      paths: tempCachePaths,
    })

    let totalSizeBytes = 0
    let totalFileCount = 0
    for (const item of items) {
      totalSizeBytes += item.sizeBytes
      totalFileCount += item.fileCount
    }

    return {
      totalSizeBytes,
      totalFileCount,
      items,
    }
  }

  /**
   * Dọn dẹp an toàn các tệp bộ nhớ đệm được chọn
   */
  public async cleanCache(
    gameDir?: string,
    targetKeys?: string[]
  ): Promise<CacheCleanResult> {
    try {
      const scan = await this.scanCache(gameDir)
      let freedBytes = 0
      let freedCount = 0

      for (const item of scan.items) {
        if (!targetKeys || targetKeys.includes(item.key)) {
          for (const filePath of item.paths) {
            try {
              if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath)
                fs.unlinkSync(filePath)
                freedBytes += stat.size
                freedCount++
              }
            } catch {
              // Bỏ qua các file đang bị tiến trình khác chiếm dụng/khóa
            }
          }
        }
      }

      return {
        success: true,
        freedBytes,
        freedCount,
      }
    } catch (err: any) {
      console.error('[OptimizerService] Clean cache error:', err)
      return {
        success: false,
        freedBytes: 0,
        freedCount: 0,
        error: err?.message || 'Có lỗi khi dọn dẹp bộ nhớ đệm.',
      }
    }
  }

  /**
   * Cài đặt 1 mod tăng tốc tối ưu từ Modrinth
   */
  public async installEssentialMod(
    gameDir: string | undefined,
    modSlug: string,
    rawMcVersion: string = '1.20.1',
    rawLoader: string = 'fabric'
  ): Promise<InstallEssentialModResult> {
    const targetDir = await this.resolveGameDir(gameDir)
    if (!targetDir) {
      return { success: false, modId: modSlug, message: 'Không tìm thấy thư mục game.' }
    }

    const modsDir = path.join(targetDir, 'mods')
    try {
      if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true })
      }
    } catch {}

    const baseMcVersion = extractBaseMinecraftVersion(rawMcVersion)
    let loader = detectLoaderFromVersion(rawLoader)
    if (loader === 'unknown') {
      loader = rawLoader.toLowerCase().includes('forge') ? 'forge' : 'fabric'
    }

    try {
      const gameVersionsQuery = encodeURIComponent(JSON.stringify([baseMcVersion]))
      const loadersQuery = encodeURIComponent(JSON.stringify([loader]))
      const versions = await fetchModrinthJson<any[]>(
        `/project/${modSlug}/version?game_versions=${gameVersionsQuery}&loaders=${loadersQuery}`
      )

      if (!versions || !Array.isArray(versions) || versions.length === 0) {
        return {
          success: false,
          modId: modSlug,
          message: `Không tìm thấy bản phát hành tương thích của ${modSlug} cho Minecraft ${baseMcVersion} (${loader}).`,
        }
      }

      const latestVer = versions[0]
      const primaryFile = (latestVer.files || []).find((f: any) => f.primary) || latestVer.files?.[0]
      if (!primaryFile?.url) {
        return {
          success: false,
          modId: modSlug,
          message: `Không lấy được link tải cho mod ${modSlug}.`,
        }
      }

      const fileName = primaryFile.filename || `${modSlug}.jar`
      const destPath = path.join(modsDir, fileName)
      await downloadFile(primaryFile.url, destPath)

      return {
        success: true,
        modId: modSlug,
        fileName,
        message: `Đã cài đặt thành công mod ${fileName}!`,
      }
    } catch (err: any) {
      console.error('[OptimizerService] Install essential mod error:', err)
      return {
        success: false,
        modId: modSlug,
        message: err?.message || `Có lỗi khi cài đặt mod ${modSlug}.`,
      }
    }
  }

  /**
   * Cài đặt toàn bộ các mod tăng tốc tối ưu còn thiếu
   */
  public async installAllMissingEssentialMods(
    gameDir: string | undefined,
    rawMcVersion: string = '1.20.1',
    rawLoader: string = 'fabric'
  ): Promise<InstallAllEssentialModsResult> {
    const status = await this.checkLowEndOptimizationStatus(gameDir)
    const missingMods = status.essentialMods.filter((m) => !m.installed)

    if (missingMods.length === 0) {
      return {
        success: true,
        installedCount: 0,
        results: [],
        message: 'Tất cả các mod tối ưu đã được cài đặt đầy đủ!',
      }
    }

    const results: Array<{ modId: string; modName: string; success: boolean; message?: string }> = []
    let installedCount = 0

    for (const mod of missingMods) {
      const res = await this.installEssentialMod(gameDir, mod.slug, rawMcVersion, rawLoader)
      results.push({
        modId: mod.id,
        modName: mod.name,
        success: res.success,
        message: res.message,
      })
      if (res.success) {
        installedCount++
      }
    }

    return {
      success: installedCount > 0,
      installedCount,
      results,
      message: `Đã cài đặt thành công ${installedCount}/${missingMods.length} mod tối ưu!`,
    }
  }

  private scanFilesByPattern(
    dirPath: string,
    filterFn: (fileName: string) => boolean,
    maxDepth: number = 4,
    currentDepth: number = 0
  ): { size: number; files: string[] } {
    let size = 0
    const files: string[] = []

    if (!fs.existsSync(dirPath)) {
      return { size, files }
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isFile() && filterFn(entry.name)) {
          try {
            const stat = fs.statSync(fullPath)
            size += stat.size
            files.push(fullPath)
          } catch {}
        } else if (entry.isDirectory() && currentDepth < maxDepth) {
          // Tránh duyệt sâu vào các thư mục game nhạy cảm như thế giới lưu (saves), mods chính
          const skipDirs = ['saves', 'mods', 'resourcepacks', 'shaderpacks', 'screenshots', 'versions']
          if (!skipDirs.includes(entry.name.toLowerCase())) {
            const sub = this.scanFilesByPattern(fullPath, filterFn, maxDepth, currentDepth + 1)
            size += sub.size
            files.push(...sub.files)
          }
        }
      }
    } catch {}

    return { size, files }
  }

  private async resolveGameDir(gameDir?: string): Promise<string> {
    if (gameDir && fs.existsSync(gameDir)) {
      return gameDir
    }
    const detected = await detectMinecraftDirectory()
    return detected.path || ''
  }

  private async resolveAllGameDirs(primaryGameDir?: string): Promise<string[]> {
    const dirs = new Set<string>()
    if (primaryGameDir && fs.existsSync(primaryGameDir)) {
      dirs.add(primaryGameDir)
    }
    const detected = await detectMinecraftDirectory()
    if (detected.path && fs.existsSync(detected.path)) {
      dirs.add(detected.path)
    }
    try {
      const { getProfilesFilePath, readJsonFile } = await import('./storageService.js')
      const profilesFile = getProfilesFilePath()
      if (fs.existsSync(profilesFile)) {
        const store = await readJsonFile<{ profiles?: Array<{ gameDir?: string }> }>(profilesFile, { profiles: [] })
        if (store?.profiles && Array.isArray(store.profiles)) {
          for (const p of store.profiles) {
            if (p.gameDir && fs.existsSync(p.gameDir)) {
              dirs.add(p.gameDir)
            }
          }
        }
      }
    } catch {}
    return Array.from(dirs)
  }
}

export const optimizerService = new OptimizerService()

