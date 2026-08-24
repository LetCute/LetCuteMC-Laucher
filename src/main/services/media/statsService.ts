import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import { eventBus } from '../eventBus'
import type {
  ProfileLauncherStats,
  ProfileFullStats,
  WorldStatsSummary,
  MiningStatItem,
  MobKillStatItem,
  TravelStats,
  SurvivalLifeStats,
  PlaySessionRecord,
} from '../../../shared/types'

// Friendly Mining Mappings
const MINING_DICTIONARY: Record<
  string,
  { name: string; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'; iconKey: string }
> = {
  'minecraft:ancient_debris': { name: 'Mảnh Vỡ Cổ Đại (Netherite)', rarity: 'legendary', iconKey: 'ancient_debris' },
  'minecraft:diamond_ore': { name: 'Quặng Kim Cương', rarity: 'epic', iconKey: 'diamond_ore' },
  'minecraft:deepslate_diamond_ore': { name: 'Quặng Kim Cương (Đá Sâu)', rarity: 'epic', iconKey: 'diamond_ore' },
  'minecraft:emerald_ore': { name: 'Quặng Ngọc Lục Bảo', rarity: 'rare', iconKey: 'emerald_ore' },
  'minecraft:deepslate_emerald_ore': { name: 'Quặng Ngọc Lục Bảo (Đá Sâu)', rarity: 'rare', iconKey: 'emerald_ore' },
  'minecraft:gold_ore': { name: 'Quặng Vàng', rarity: 'uncommon', iconKey: 'gold_ore' },
  'minecraft:deepslate_gold_ore': { name: 'Quặng Vàng (Đá Sâu)', rarity: 'uncommon', iconKey: 'gold_ore' },
  'minecraft:nether_gold_ore': { name: 'Quặng Vàng Nether', rarity: 'uncommon', iconKey: 'gold_ore' },
  'minecraft:iron_ore': { name: 'Quặng Sắt', rarity: 'common', iconKey: 'iron_ore' },
  'minecraft:deepslate_iron_ore': { name: 'Quặng Sắt (Đá Sâu)', rarity: 'common', iconKey: 'iron_ore' },
  'minecraft:coal_ore': { name: 'Quặng Than Đá', rarity: 'common', iconKey: 'coal_ore' },
  'minecraft:deepslate_coal_ore': { name: 'Quặng Than Đá (Đá Sâu)', rarity: 'common', iconKey: 'coal_ore' },
  'minecraft:lapis_ore': { name: 'Quặng Lapis Lazuli', rarity: 'common', iconKey: 'lapis_ore' },
  'minecraft:deepslate_lapis_ore': { name: 'Quặng Lapis Lazuli (Đá Sâu)', rarity: 'common', iconKey: 'lapis_ore' },
  'minecraft:redstone_ore': { name: 'Quặng Đá Đỏ', rarity: 'common', iconKey: 'redstone_ore' },
  'minecraft:deepslate_redstone_ore': { name: 'Quặng Đá Đỏ (Đá Sâu)', rarity: 'common', iconKey: 'redstone_ore' },
  'minecraft:copper_ore': { name: 'Quặng Đồng', rarity: 'common', iconKey: 'copper_ore' },
  'minecraft:deepslate_copper_ore': { name: 'Quặng Đồng (Đá Sâu)', rarity: 'common', iconKey: 'copper_ore' },
  'minecraft:nether_quartz_ore': { name: 'Quặng Thạch Anh Nether', rarity: 'common', iconKey: 'quartz_ore' },
  'minecraft:obsidian': { name: 'Hắc Diện Thạch (Obsidian)', rarity: 'rare', iconKey: 'obsidian' },
  'minecraft:crying_obsidian': { name: 'Hắc Diện Thạch Khóc', rarity: 'rare', iconKey: 'obsidian' },
  'minecraft:amethyst_cluster': { name: 'Cụm Tinh Thể Thạch Anh Tím', rarity: 'uncommon', iconKey: 'amethyst' },
}

// Friendly Mob Kills Mappings
const MOB_DICTIONARY: Record<
  string,
  { name: string; isBoss: boolean; iconKey: string }
> = {
  'minecraft:ender_dragon': { name: 'Rồng Ender (Ender Dragon)', isBoss: true, iconKey: 'dragon' },
  'minecraft:wither': { name: 'Wither', isBoss: true, iconKey: 'wither' },
  'minecraft:warden': { name: 'Warden (Quái Nhân Âm Vang)', isBoss: true, iconKey: 'warden' },
  'minecraft:elder_guardian': { name: 'Đại Hộ Vệ (Elder Guardian)', isBoss: true, iconKey: 'guardian' },
  'minecraft:wither_skeleton': { name: 'Wither Skeleton', isBoss: false, iconKey: 'wither_skeleton' },
  'minecraft:enderman': { name: 'Enderman', isBoss: false, iconKey: 'enderman' },
  'minecraft:creeper': { name: 'Creeper', isBoss: false, iconKey: 'creeper' },
  'minecraft:skeleton': { name: 'Bộ Xương (Skeleton)', isBoss: false, iconKey: 'skeleton' },
  'minecraft:zombie': { name: 'Xác Sống (Zombie)', isBoss: false, iconKey: 'zombie' },
  'minecraft:spider': { name: 'Nhện (Spider)', isBoss: false, iconKey: 'spider' },
  'minecraft:cave_spider': { name: 'Nhện Hang (Cave Spider)', isBoss: false, iconKey: 'spider' },
  'minecraft:witch': { name: 'Phù Thủy (Witch)', isBoss: false, iconKey: 'witch' },
  'minecraft:blaze': { name: 'Quỷ Lửa (Blaze)', isBoss: false, iconKey: 'blaze' },
  'minecraft:ghast': { name: 'Bóng Ma (Ghast)', isBoss: false, iconKey: 'ghast' },
  'minecraft:phantom': { name: 'Ảo Ảnh (Phantom)', isBoss: false, iconKey: 'phantom' },
  'minecraft:drowned': { name: 'Xác Ướp Đuối Nước (Drowned)', isBoss: false, iconKey: 'zombie' },
  'minecraft:husk': { name: 'Xác Ướp Sa Mạc (Husk)', isBoss: false, iconKey: 'zombie' },
  'minecraft:stray': { name: 'Bộ Xương Băng Giá (Stray)', isBoss: false, iconKey: 'skeleton' },
  'minecraft:pillager': { name: 'Kẻ Cướp (Pillager)', isBoss: false, iconKey: 'pillager' },
  'minecraft:vindicator': { name: 'Kẻ Trừng Phạt (Vindicator)', isBoss: false, iconKey: 'pillager' },
  'minecraft:evoker': { name: 'Pháp Sư (Evoker)', isBoss: false, iconKey: 'evoker' },
  'minecraft:ravager': { name: 'Tàn Phá Thú (Ravager)', isBoss: false, iconKey: 'ravager' },
  'minecraft:piglin': { name: 'Piglin', isBoss: false, iconKey: 'piglin' },
  'minecraft:piglin_brute': { name: 'Piglin Chiến Binh', isBoss: false, iconKey: 'piglin' },
  'minecraft:hoglin': { name: 'Hoglin', isBoss: false, iconKey: 'hoglin' },
  'minecraft:zombified_piglin': { name: 'Piglin Thây Ma', isBoss: false, iconKey: 'piglin' },
  'minecraft:slime': { name: 'Slime', isBoss: false, iconKey: 'slime' },
  'minecraft:magma_cube': { name: 'Khối Dung Nham (Magma Cube)', isBoss: false, iconKey: 'magma_cube' },
  'minecraft:guardian': { name: 'Hộ Vệ Biển (Guardian)', isBoss: false, iconKey: 'guardian' },
  'minecraft:shulker': { name: 'Shulker', isBoss: false, iconKey: 'shulker' },
  'minecraft:breeze': { name: 'Breeze (Gió Lốc)', isBoss: false, iconKey: 'breeze' },
  'minecraft:bogged': { name: 'Bogged (Xương Đầm Lầy)', isBoss: false, iconKey: 'skeleton' },
}

export class StatsService {
  constructor() {
    this.initEventListeners()
  }

  private initEventListeners(): void {
    eventBus.on('game:exited', (payload) => {
      if (payload.gameDir && payload.durationMs) {
        const durationSeconds = payload.durationMs / 1000
        this.recordPlaySession(payload.gameDir, payload.profileId, durationSeconds, payload.code ?? undefined)
      }
    })
  }

  private getLauncherStatsFilePath(gameDir: string): string {
    return path.join(gameDir, 'launcher-stats.json')
  }

  // ─── Launcher-Level Playtime Tracker ───────────────────────────────────────

  public getLauncherStats(gameDir: string, profileId: string): ProfileLauncherStats {
    const statsFile = this.getLauncherStatsFilePath(gameDir)
    const fallback: ProfileLauncherStats = {
      profileId,
      totalPlaytimeSeconds: 0,
      lastPlayedTimestamp: 0,
      launchCount: 0,
      sessions: [],
    }

    if (!fs.existsSync(statsFile)) {
      return fallback
    }

    try {
      const raw = fs.readFileSync(statsFile, 'utf-8')
      const data: Record<string, ProfileLauncherStats> = JSON.parse(raw)
      return data[profileId] || fallback
    } catch {
      return fallback
    }
  }

  public recordPlaySession(
    gameDir: string,
    profileId: string,
    durationSeconds: number,
    exitCode?: number
  ): ProfileLauncherStats {
    const statsFile = this.getLauncherStatsFilePath(gameDir)
    let allData: Record<string, ProfileLauncherStats> = {}

    if (fs.existsSync(statsFile)) {
      try {
        allData = JSON.parse(fs.readFileSync(statsFile, 'utf-8'))
      } catch {
        allData = {}
      }
    }

    const current = allData[profileId] || {
      profileId,
      totalPlaytimeSeconds: 0,
      lastPlayedTimestamp: 0,
      launchCount: 0,
      sessions: [],
    }

    const now = Date.now()
    const startTime = now - Math.round(durationSeconds * 1000)

    const session: PlaySessionRecord = {
      id: `${now}_${Math.random().toString(36).slice(2, 7)}`,
      startTime,
      endTime: now,
      durationSeconds: Math.round(durationSeconds),
      exitCode,
    }

    current.totalPlaytimeSeconds += Math.round(durationSeconds)
    current.lastPlayedTimestamp = now
    current.launchCount += 1
    current.sessions = [session, ...current.sessions].slice(0, 60) // keep last 60 sessions

    allData[profileId] = current

    try {
      fs.writeFileSync(statsFile, JSON.stringify(allData, null, 2), 'utf-8')
    } catch (err) {
      console.error('[StatsService] Failed to write launcher stats:', err)
    }

    return current
  }

  // ─── In-Game World Stats Reader ───────────────────────────────────────────

  public getFullProfileStats(
    gameDir: string,
    profileId: string,
    profileName: string = 'Mặc định'
  ): ProfileFullStats {
    const launcherStats = this.getLauncherStats(gameDir, profileId)
    const worlds = this.scanAllWorldStats(gameDir)

    // Aggregate data across all worlds
    let totalInGameSeconds = 0
    let totalBlocksMined = 0
    let totalMobKills = 0

    const miningMap = new Map<string, MiningStatItem>()
    const killsMap = new Map<string, MobKillStatItem>()

    const aggregatedTravel: TravelStats = {
      walkMeters: 0,
      sprintMeters: 0,
      swimMeters: 0,
      flyElytraMeters: 0,
      boatMeters: 0,
      horseMeters: 0,
      minecartMeters: 0,
      totalDistanceMeters: 0,
      jumps: 0,
    }

    const aggregatedSurvival: SurvivalLifeStats = {
      deaths: 0,
      mobKills: 0,
      playerKills: 0,
      damageDealt: 0,
      damageTaken: 0,
      timesSlept: 0,
      chestsOpened: 0,
      fishCaught: 0,
      animalsBred: 0,
      enchantedItems: 0,
      raidsWon: 0,
    }

    for (const w of worlds) {
      totalInGameSeconds += w.inGamePlaytimeSeconds

      // Travel
      aggregatedTravel.walkMeters += w.travel.walkMeters
      aggregatedTravel.sprintMeters += w.travel.sprintMeters
      aggregatedTravel.swimMeters += w.travel.swimMeters
      aggregatedTravel.flyElytraMeters += w.travel.flyElytraMeters
      aggregatedTravel.boatMeters += w.travel.boatMeters
      aggregatedTravel.horseMeters += w.travel.horseMeters
      aggregatedTravel.minecartMeters += w.travel.minecartMeters
      aggregatedTravel.totalDistanceMeters += w.travel.totalDistanceMeters
      aggregatedTravel.jumps += w.travel.jumps

      // Survival
      aggregatedSurvival.deaths += w.survival.deaths
      aggregatedSurvival.mobKills += w.survival.mobKills
      aggregatedSurvival.playerKills += w.survival.playerKills
      aggregatedSurvival.damageDealt += w.survival.damageDealt
      aggregatedSurvival.damageTaken += w.survival.damageTaken
      aggregatedSurvival.timesSlept += w.survival.timesSlept
      aggregatedSurvival.chestsOpened += w.survival.chestsOpened
      aggregatedSurvival.fishCaught += w.survival.fishCaught
      aggregatedSurvival.animalsBred += w.survival.animalsBred
      aggregatedSurvival.enchantedItems += w.survival.enchantedItems
      aggregatedSurvival.raidsWon += w.survival.raidsWon

      // Mining
      for (const m of w.mining) {
        totalBlocksMined += m.count
        const existing = miningMap.get(m.id)
        if (existing) {
          existing.count += m.count
        } else {
          miningMap.set(m.id, { ...m })
        }
      }

      // Kills
      for (const k of w.combat) {
        totalMobKills += k.count
        const existing = killsMap.get(k.id)
        if (existing) {
          existing.count += k.count
        } else {
          killsMap.set(k.id, { ...k })
        }
      }
    }

    // Sort top mining (prioritizing rare ores, then count)
    const rarityWeights: Record<string, number> = {
      legendary: 5,
      epic: 4,
      rare: 3,
      uncommon: 2,
      common: 1,
    }

    const topMining = Array.from(miningMap.values()).sort((a, b) => {
      const wA = rarityWeights[a.rarity] || 1
      const wB = rarityWeights[b.rarity] || 1
      if (wA !== wB) return wB - wA
      return b.count - a.count
    })

    // Sort top kills (bosses first, then count)
    const topKills = Array.from(killsMap.values()).sort((a, b) => {
      if (a.isBoss && !b.isBoss) return -1
      if (!a.isBoss && b.isBoss) return 1
      return b.count - a.count
    })

    return {
      profileId,
      profileName,
      launcherStats,
      aggregatedInGameStats: {
        totalInGameSeconds,
        worldsCount: worlds.length,
        topMining,
        totalBlocksMined,
        topKills,
        totalMobKills,
        travel: aggregatedTravel,
        survival: aggregatedSurvival,
      },
      worlds,
    }
  }

  private scanAllWorldStats(gameDir: string): WorldStatsSummary[] {
    const savesDir = path.join(gameDir, 'saves')
    if (!fs.existsSync(savesDir)) return []

    const summaries: WorldStatsSummary[] = []

    try {
      const worldFolders = fs.readdirSync(savesDir)
      for (const folder of worldFolders) {
        const fullWorldPath = path.join(savesDir, folder)
        try {
          if (!fs.statSync(fullWorldPath).isDirectory()) continue
        } catch {
          continue
        }

        const statsDir = path.join(fullWorldPath, 'stats')
        if (!fs.existsSync(statsDir)) continue
        try {
          if (!fs.statSync(statsDir).isDirectory()) continue
        } catch {
          continue
        }

        let statFiles: string[] = []
        try {
          statFiles = fs.readdirSync(statsDir).filter((f) => f.endsWith('.json'))
        } catch {
          continue
        }
        if (statFiles.length === 0) continue

        // Gom tất cả các tệp thống kê người chơi (.json) trong cùng thế giới thành 1 mục đại diện duy nhất
        let worldSummary: WorldStatsSummary | null = null

        for (const file of statFiles) {
          const uuid = path.basename(file, '.json')
          const statFilePath = path.join(statsDir, file)

          try {
            const raw = fs.readFileSync(statFilePath, 'utf-8')
            const json = JSON.parse(raw)
            const parsed = this.parseMinecraftStatsJson(folder, uuid, json)
            if (parsed) {
              if (!worldSummary) {
                worldSummary = parsed
              } else {
                worldSummary.inGamePlaytimeTicks += parsed.inGamePlaytimeTicks
                worldSummary.inGamePlaytimeSeconds += parsed.inGamePlaytimeSeconds

                // Travel
                worldSummary.travel.walkMeters += parsed.travel.walkMeters
                worldSummary.travel.sprintMeters += parsed.travel.sprintMeters
                worldSummary.travel.swimMeters += parsed.travel.swimMeters
                worldSummary.travel.flyElytraMeters += parsed.travel.flyElytraMeters
                worldSummary.travel.boatMeters += parsed.travel.boatMeters
                worldSummary.travel.horseMeters += parsed.travel.horseMeters
                worldSummary.travel.minecartMeters += parsed.travel.minecartMeters
                worldSummary.travel.totalDistanceMeters += parsed.travel.totalDistanceMeters
                worldSummary.travel.jumps += parsed.travel.jumps

                // Survival
                worldSummary.survival.deaths += parsed.survival.deaths
                worldSummary.survival.mobKills += parsed.survival.mobKills
                worldSummary.survival.playerKills += parsed.survival.playerKills
                worldSummary.survival.damageDealt += parsed.survival.damageDealt
                worldSummary.survival.damageTaken += parsed.survival.damageTaken
                worldSummary.survival.timesSlept += parsed.survival.timesSlept
                worldSummary.survival.chestsOpened += parsed.survival.chestsOpened
                worldSummary.survival.fishCaught += parsed.survival.fishCaught
                worldSummary.survival.animalsBred += parsed.survival.animalsBred
                worldSummary.survival.enchantedItems += parsed.survival.enchantedItems
                worldSummary.survival.raidsWon += parsed.survival.raidsWon

                // Mining merge
                for (const m of parsed.mining) {
                  const exist = worldSummary.mining.find((item) => item.id === m.id)
                  if (exist) {
                    exist.count += m.count
                  } else {
                    worldSummary.mining.push({ ...m })
                  }
                }

                // Combat merge
                for (const c of parsed.combat) {
                  const exist = worldSummary.combat.find((item) => item.id === c.id)
                  if (exist) {
                    exist.count += c.count
                  } else {
                    worldSummary.combat.push({ ...c })
                  }
                }
              }
            }
          } catch (e) {
            console.error(`[StatsService] Failed to parse stat file: ${statFilePath}`, e)
          }
        }

        if (worldSummary) {
          summaries.push(worldSummary)
        }
      }
    } catch (err) {
      console.error('[StatsService] Error scanning saves dir:', err)
    }

    return summaries
  }

  private parseMinecraftStatsJson(
    worldFolder: string,
    playerUuid: string,
    rawJson: any
  ): WorldStatsSummary | null {
    if (!rawJson) return null

    // Modern Minecraft format (1.13+) has { stats: { "minecraft:custom": ..., "minecraft:mined": ... } }
    // Legacy format has flat keys like "stat.playOneMinute", "stat.mineBlock.minecraft.diamond_ore"
    const stats = rawJson.stats || rawJson
    const custom = stats['minecraft:custom'] || {}
    const mined = stats['minecraft:mined'] || {}
    const killed = stats['minecraft:killed'] || {}

    // 1. Playtime
    // Modern: minecraft:play_time (ticks, 20 ticks = 1 sec) or minecraft:total_world_time
    // Legacy: stat.playOneMinute (which is ticks)
    const playTicks =
      custom['minecraft:play_time'] ||
      custom['minecraft:total_world_time'] ||
      stats['stat.playOneMinute'] ||
      0
    const playtimeSeconds = Math.round(playTicks / 20)

    // 2. Mining
    const miningList: MiningStatItem[] = []
    for (const [key, count] of Object.entries(mined)) {
      if (typeof count !== 'number' || count <= 0) continue
      const meta = MINING_DICTIONARY[key] || {
        name: this.formatItemName(key),
        rarity: 'common',
        iconKey: 'stone',
      }

      miningList.push({
        id: key,
        name: meta.name,
        count,
        rarity: meta.rarity,
        iconKey: meta.iconKey,
      })
    }

    // 3. Combat & Kills
    const combatList: MobKillStatItem[] = []
    for (const [key, count] of Object.entries(killed)) {
      if (typeof count !== 'number' || count <= 0) continue
      const meta = MOB_DICTIONARY[key] || {
        name: this.formatMobName(key),
        isBoss: false,
        iconKey: 'zombie',
      }

      combatList.push({
        id: key,
        name: meta.name,
        count,
        isBoss: meta.isBoss,
        iconKey: meta.iconKey,
      })
    }

    // 4. Travel (cm converted to meters)
    const walkCm = custom['minecraft:walk_one_cm'] || stats['stat.walkOneCm'] || 0
    const sprintCm = custom['minecraft:sprint_one_cm'] || stats['stat.sprintOneCm'] || 0
    const swimCm = custom['minecraft:swim_one_cm'] || stats['stat.swimOneCm'] || 0
    const flyElytraCm = custom['minecraft:aviate_one_cm'] || stats['stat.aviateOneCm'] || 0
    const boatCm = custom['minecraft:boat_one_cm'] || stats['stat.boatOneCm'] || 0
    const horseCm = custom['minecraft:horse_one_cm'] || stats['stat.horseOneCm'] || 0
    const minecartCm = custom['minecraft:minecart_one_cm'] || stats['stat.minecartOneCm'] || 0
    const jumps = custom['minecraft:jump'] || stats['stat.jump'] || 0

    const walkMeters = Math.round(walkCm / 100)
    const sprintMeters = Math.round(sprintCm / 100)
    const swimMeters = Math.round(swimCm / 100)
    const flyElytraMeters = Math.round(flyElytraCm / 100)
    const boatMeters = Math.round(boatCm / 100)
    const horseMeters = Math.round(horseCm / 100)
    const minecartMeters = Math.round(minecartCm / 100)
    const totalDistanceMeters =
      walkMeters + sprintMeters + swimMeters + flyElytraMeters + boatMeters + horseMeters + minecartMeters

    const travel: TravelStats = {
      walkMeters,
      sprintMeters,
      swimMeters,
      flyElytraMeters,
      boatMeters,
      horseMeters,
      minecartMeters,
      totalDistanceMeters,
      jumps,
    }

    // 5. Survival & Life
    const deaths = custom['minecraft:deaths'] || stats['stat.deaths'] || 0
    const mobKills = custom['minecraft:mob_kills'] || stats['stat.mobKills'] || 0
    const playerKills = custom['minecraft:player_kills'] || stats['stat.playerKills'] || 0
    const damageDealt = custom['minecraft:damage_dealt'] || stats['stat.damageDealt'] || 0
    const damageTaken = custom['minecraft:damage_taken'] || stats['stat.damageTaken'] || 0
    const timesSlept = custom['minecraft:sleep_in_bed'] || stats['stat.sleepInBed'] || 0
    const chestsOpened = custom['minecraft:open_chest'] || stats['stat.chestOpened'] || 0
    const fishCaught = custom['minecraft:fish_caught'] || stats['stat.fishCaught'] || 0
    const animalsBred = custom['minecraft:animals_bred'] || stats['stat.animalsBred'] || 0
    const enchantedItems = custom['minecraft:enchant_item'] || stats['stat.itemEnchanted'] || 0
    const raidsWon = custom['minecraft:raid_win'] || 0

    const survival: SurvivalLifeStats = {
      deaths,
      mobKills,
      playerKills,
      damageDealt: Math.round(damageDealt / 10), // Minecraft stores 1/10th hearts
      damageTaken: Math.round(damageTaken / 10),
      timesSlept,
      chestsOpened,
      fishCaught,
      animalsBred,
      enchantedItems,
      raidsWon,
    }

    return {
      worldFolder,
      worldName: worldFolder.replace(/_/g, ' '),
      playerUuid,
      inGamePlaytimeTicks: playTicks,
      inGamePlaytimeSeconds: playtimeSeconds,
      mining: miningList,
      combat: combatList,
      travel,
      survival,
    }
  }

  private formatItemName(rawKey: string): string {
    const clean = rawKey.replace(/^minecraft:/, '').replace(/_/g, ' ')
    return clean.charAt(0).toUpperCase() + clean.slice(1)
  }

  private formatMobName(rawKey: string): string {
    const clean = rawKey.replace(/^minecraft:/, '').replace(/_/g, ' ')
    return clean.charAt(0).toUpperCase() + clean.slice(1)
  }

  public async openStatsFolder(gameDir?: string, worldFolder?: string): Promise<boolean> {
    const fallbackDir = path.join(process.env.APPDATA || '', '.minecraft')
    const baseDir = (gameDir && gameDir.trim()) ? gameDir : fallbackDir
    const targetDir = worldFolder
      ? path.join(baseDir, 'saves', worldFolder, 'stats')
      : path.join(baseDir, 'saves')

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      const err = await shell.openPath(targetDir)
      if (err) {
        if (fs.existsSync(baseDir)) {
          await shell.openPath(baseDir)
        }
      }
      return true
    } catch (e) {
      console.error('[StatsService] Failed to open stats folder:', e)
      return false
    }
  }
}

export const statsService = new StatsService()

