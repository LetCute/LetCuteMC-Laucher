import { useState, useEffect, useMemo } from 'react'
import {
  Clock,
  Flame,
  Trophy,
  Compass,
  Sword,
  Pickaxe,
  Heart,
  RotateCcw,
  FolderOpen,
  ChevronDown,
  Sparkles,
  Zap,
  Layers,
  MapPin,
  Shield,
  Skull,
  Footprints,
  Plane,
  Anchor,
  Moon,
  Box,
  Fish,
  Crown,
  History,
} from 'lucide-react'
import type { ProfileFullStats } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../components/ui/DropdownMenu'

interface StatsScreenProps {
  gameDir: string
  profileId?: string
  profileName?: string
}

type StatsCategory = 'mining' | 'combat' | 'travel' | 'survival' | 'sessions'

export default function StatsScreen({ gameDir, profileId, profileName }: StatsScreenProps) {
  const { showToast } = useToast()

  const [statsData, setStatsData] = useState<ProfileFullStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<StatsCategory>('mining')
  const [selectedWorldFolder, setSelectedWorldFolder] = useState<string>('all')

  const loadStats = async () => {
    if (!gameDir) return
    setIsLoading(true)
    try {
      const data = await launcherClient.getFullProfileStats(
        gameDir,
        profileId || 'default',
        profileName || 'Mặc định'
      )
      setStatsData(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
      showToast('error', 'Không thể tải dữ liệu thống kê.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadStats()
  }, [gameDir, profileId, profileName])

  // Helper: format seconds to hours & minutes
  const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return '0 phút'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m} phút`
    if (m === 0) return `${h} giờ`
    return `${h} giờ ${m} phút`
  }

  // Helper: format distance (meters -> km or m)
  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${meters.toLocaleString('vi-VN')} m`
    const km = meters / 1000
    return `${km.toFixed(1).replace('.', ',')} km`
  }

  // Helper: format relative time
  const formatRelativeTime = (timestamp: number): string => {
    if (!timestamp) return 'Chưa chơi'
    const diffSec = Math.floor((Date.now() - timestamp) / 1000)
    if (diffSec < 60) return 'Vừa xong'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`
    const days = Math.floor(diffSec / 86400)
    if (days === 1) return 'Hôm qua'
    if (days < 30) return `${days} ngày trước`
    return new Date(timestamp).toLocaleDateString('vi-VN')
  }

  const handleOpenStatsFolder = async () => {
    try {
      const ok = await launcherClient.openStatsFolder(
        gameDir,
        selectedWorldFolder !== 'all' ? selectedWorldFolder : undefined
      )
      if (!ok) {
        showToast('info', 'Đã mở thư mục trò chơi.')
      }
    } catch {
      showToast('error', 'Không thể mở thư mục stats.')
    }
  }

  // Active view stats (either aggregated or single world)
  const activeStats = useMemo(() => {
    if (!statsData) return null

    if (selectedWorldFolder === 'all' || !statsData.worlds.length) {
      return {
        mining: statsData.aggregatedInGameStats.topMining,
        totalBlocksMined: statsData.aggregatedInGameStats.totalBlocksMined,
        combat: statsData.aggregatedInGameStats.topKills,
        totalMobKills: statsData.aggregatedInGameStats.totalMobKills,
        travel: statsData.aggregatedInGameStats.travel,
        survival: statsData.aggregatedInGameStats.survival,
        inGamePlaytimeSeconds: statsData.aggregatedInGameStats.totalInGameSeconds,
        worldName: 'Tất cả thế giới',
      }
    }

    const world = statsData.worlds.find((w) => w.worldFolder === selectedWorldFolder)
    if (!world) {
      return {
        mining: statsData.aggregatedInGameStats.topMining,
        totalBlocksMined: statsData.aggregatedInGameStats.totalBlocksMined,
        combat: statsData.aggregatedInGameStats.topKills,
        totalMobKills: statsData.aggregatedInGameStats.totalMobKills,
        travel: statsData.aggregatedInGameStats.travel,
        survival: statsData.aggregatedInGameStats.survival,
        inGamePlaytimeSeconds: statsData.aggregatedInGameStats.totalInGameSeconds,
        worldName: 'Tất cả thế giới',
      }
    }

    const totalMined = world.mining.reduce((acc, curr) => acc + curr.count, 0)
    const totalKills = world.combat.reduce((acc, curr) => acc + curr.count, 0)

    return {
      mining: world.mining,
      totalBlocksMined: totalMined,
      combat: world.combat,
      totalMobKills: totalKills,
      travel: world.travel,
      survival: world.survival,
      inGamePlaytimeSeconds: world.inGamePlaytimeSeconds,
      worldName: world.worldName,
    }
  }, [statsData, selectedWorldFolder])

  // Calculate Diamond & Netherite count
  const rareOresCount = useMemo(() => {
    if (!activeStats) return { diamonds: 0, netherite: 0, totalRare: 0 }
    let diamonds = 0
    let netherite = 0

    for (const m of activeStats.mining) {
      if (m.id.includes('diamond')) diamonds += m.count
      if (m.id.includes('ancient_debris')) netherite += m.count
    }

    return { diamonds, netherite, totalRare: diamonds + netherite }
  }, [activeStats])

  // KD Ratio
  const kdRatio = useMemo(() => {
    if (!activeStats) return '0.0'
    const kills = activeStats.survival.mobKills + activeStats.survival.playerKills
    const deaths = activeStats.survival.deaths
    if (deaths === 0) return kills > 0 ? `${kills}.0` : '0.0'
    return (kills / deaths).toFixed(1)
  }, [activeStats])

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col h-full gap-3 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-foreground tracking-tight whitespace-nowrap">
              Thống kê & Thành tựu
            </h2>
            {profileName && (
              <span className="text-xs font-medium text-zinc-300 px-2 py-0.5 bg-zinc-900/90 border border-zinc-800 rounded-lg truncate max-w-xs">
                Cấu hình: <strong className="text-primary font-semibold">{profileName}</strong>
              </span>
            )}

            {/* World Selector Dropdown */}
            {statsData && statsData.worlds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] gap-1 rounded-md"
                  >
                    <MapPin size={11} className="text-primary" />
                    <span className="truncate max-w-[130px]">
                      {selectedWorldFolder === 'all'
                        ? `Tất cả (${statsData.worlds.length})`
                        : statsData.worlds.find((w) => w.worldFolder === selectedWorldFolder)?.worldName ||
                          'Thế giới'}
                    </span>
                    <ChevronDown size={10} className="text-zinc-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 dropdown-panel rounded-2xl p-1.5 z-50"
                >
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1">
                    Chọn phạm vi thế giới
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setSelectedWorldFolder('all')}
                    className={cn(
                      'cursor-pointer text-xs py-2 px-2.5 gap-2 rounded-xl',
                      selectedWorldFolder === 'all'
                        ? 'bg-primary/20 text-primary font-bold'
                        : 'text-zinc-200 hover:bg-zinc-800/90 hover:text-white'
                    )}
                  >
                    <Layers size={13} />
                    <span>Tất cả thế giới ({statsData.worlds.length})</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                  {statsData.worlds.map((w) => (
                    <DropdownMenuItem
                      key={w.worldFolder}
                      onClick={() => setSelectedWorldFolder(w.worldFolder)}
                      className={cn(
                        'cursor-pointer text-xs py-2 px-2.5 gap-2 rounded-xl truncate',
                        selectedWorldFolder === w.worldFolder
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-zinc-200 hover:bg-zinc-800/90 hover:text-white'
                      )}
                    >
                      <MapPin size={13} />
                      <span className="truncate flex-1">{w.worldName}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Subtitle Stats Line */}
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 whitespace-nowrap">
            <span className="whitespace-nowrap">
              Tổng chơi:{' '}
              <strong className="text-zinc-200 font-semibold">
                {formatDuration(
                  Math.max(
                    statsData?.launcherStats.totalPlaytimeSeconds || 0,
                    activeStats?.inGamePlaytimeSeconds || 0
                  )
                )}
              </strong>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="whitespace-nowrap">
              Đã đào:{' '}
              <strong className="text-primary font-semibold">
                {(activeStats?.totalBlocksMined || 0).toLocaleString('vi-VN')}
              </strong>{' '}
              quặng
            </span>
            <span className="text-zinc-700">·</span>
            <span className="whitespace-nowrap">
              Diệt:{' '}
              <strong className="text-red-400 font-semibold">
                {(activeStats?.totalMobKills || 0).toLocaleString('vi-VN')}
              </strong>{' '}
              quái
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={handleOpenStatsFolder}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs"
            title="Mở thư mục stats trong Explorer"
          >
            <FolderOpen size={13} className="mr-1.5" />
            Thư mục Stats
          </Button>

          <Button
            onClick={loadStats}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs"
            title="Làm mới thống kê"
          >
            <RotateCcw size={12} className={cn(isLoading && 'animate-spin', 'mr-1.5')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Hero 4 Sleek & Compact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {/* Card 1: Playtime */}
        <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-primary/50 hover:bg-zinc-900 transition-all duration-150 shadow-sm flex items-center gap-3 min-w-0 cv-auto">
          <div className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-primary flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
              Tổng giờ chơi
            </p>
            <p className="text-xs font-bold text-foreground truncate mt-0.5">
              {formatDuration(
                Math.max(
                  statsData?.launcherStats.totalPlaytimeSeconds || 0,
                  activeStats?.inGamePlaytimeSeconds || 0
                )
              )}
            </p>
          </div>
        </div>

        {/* Card 2: Launches & Last Played */}
        <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-primary/50 hover:bg-zinc-900 transition-all duration-150 shadow-sm flex items-center gap-3 min-w-0 cv-auto">
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Zap size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
              Số lần mở game
            </p>
            <p className="text-xs font-bold text-foreground truncate mt-0.5">
              {(statsData?.launcherStats.launchCount || 0).toLocaleString('vi-VN')} lần {statsData?.launcherStats.lastPlayedTimestamp ? `· ${formatRelativeTime(statsData.launcherStats.lastPlayedTimestamp)}` : ''}
            </p>
          </div>
        </div>

        {/* Card 3: Rare Ores */}
        <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-primary/50 hover:bg-zinc-900 transition-all duration-150 shadow-sm flex items-center gap-3 min-w-0 cv-auto">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Pickaxe size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
              Khoáng sản quý
            </p>
            <p className="text-xs font-bold text-emerald-400 truncate mt-0.5">
              {rareOresCount.diamonds} Kim Cương {rareOresCount.netherite > 0 ? `· ${rareOresCount.netherite} Netherite` : ''}
            </p>
          </div>
        </div>

        {/* Card 4: Combat & K/D */}
        <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-primary/50 hover:bg-zinc-900 transition-all duration-150 shadow-sm flex items-center gap-3 min-w-0 cv-auto">
          <div className="h-9 w-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
            <Sword size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
                Chiến tích diệt quái
              </p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                K/D: {kdRatio}
              </span>
            </div>
            <p className="text-xs font-bold text-red-400 truncate mt-0.5">
              {(activeStats?.totalMobKills || 0).toLocaleString('vi-VN')} quái
              <span className="text-zinc-500 text-[10px] font-normal ml-1.5">({activeStats?.survival.deaths || 0} tử trận)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Category Tabs Pill Switcher */}
      <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-xl border border-zinc-800 w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveCategory('mining')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap',
            activeCategory === 'mining'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          )}
        >
          <Pickaxe size={13} />
          <span>Khai khoáng ({activeStats?.mining.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveCategory('combat')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap',
            activeCategory === 'combat'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          )}
        >
          <Sword size={13} />
          <span>Chiến đấu ({activeStats?.combat.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveCategory('travel')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap',
            activeCategory === 'travel'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          )}
        >
          <Compass size={13} />
          <span>Hành trình ({formatDistance(activeStats?.travel.totalDistanceMeters || 0)})</span>
        </button>

        <button
          onClick={() => setActiveCategory('survival')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap',
            activeCategory === 'survival'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          )}
        >
          <Heart size={13} />
          <span>Sinh tồn</span>
        </button>

        <button
          onClick={() => setActiveCategory('sessions')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap',
            activeCategory === 'sessions'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          )}
        >
          <History size={13} />
          <span>Phiên chơi ({statsData?.launcherStats.sessions.length || 0})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {/* ── 1. Mining Category ──────────────────────────────────────────────── */}
        {activeCategory === 'mining' && (
          <div className="space-y-4">
            {activeStats?.mining.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/40 border border-zinc-700/40 text-zinc-400">
                  <Pickaxe size={32} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Chưa có dữ liệu khai khoáng</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Hãy vào chơi trong một thế giới sinh tồn và bắt đầu đào các quặng khoáng sản để ghi nhận thành tích!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {activeStats?.mining.map((item) => {
                  const isLegendary = item.rarity === 'legendary'
                  const isEpic = item.rarity === 'epic'
                  const isRare = item.rarity === 'rare'
                  const isUncommon = item.rarity === 'uncommon'

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-4 rounded-2xl border transition-all duration-200 shadow-md flex items-center justify-between gap-3 group',
                        isLegendary && 'bg-purple-950/20 border-purple-800/60 hover:border-purple-500/80 hover:bg-purple-950/30',
                        isEpic && 'bg-cyan-950/20 border-cyan-800/60 hover:border-cyan-500/80 hover:bg-cyan-950/30',
                        isRare && 'bg-emerald-950/20 border-emerald-800/60 hover:border-emerald-500/80 hover:bg-emerald-950/30',
                        isUncommon && 'bg-amber-950/20 border-amber-800/60 hover:border-amber-500/80 hover:bg-amber-950/30',
                        item.rarity === 'common' && 'bg-zinc-900/85 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border font-bold text-sm shadow-sm',
                            isLegendary && 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                            isEpic && 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
                            isRare && 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                            isUncommon && 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                            item.rarity === 'common' && 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
                          )}
                        >
                          <Pickaxe size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.name}
                          </p>
                          <span
                            className={cn(
                              'text-[10px] font-semibold uppercase tracking-wider',
                              isLegendary && 'text-purple-400',
                              isEpic && 'text-cyan-400',
                              isRare && 'text-emerald-400',
                              isUncommon && 'text-amber-400',
                              item.rarity === 'common' && 'text-zinc-500'
                            )}
                          >
                            {item.rarity === 'legendary'
                              ? 'Netherite'
                              : item.rarity === 'epic'
                              ? 'Cực hiếm'
                              : item.rarity === 'rare'
                              ? 'Hiếm'
                              : item.rarity === 'uncommon'
                              ? 'Giá trị'
                              : 'Phổ thông'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base font-extrabold text-foreground font-mono">
                          {item.count.toLocaleString('vi-VN')}
                        </p>
                        <span className="text-[10px] text-muted-foreground">khối</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 2. Combat Category ──────────────────────────────────────────────── */}
        {activeCategory === 'combat' && (
          <div className="space-y-4">
            {/* Boss Trophies Spotlight */}
            {activeStats?.combat.some((c) => c.isBoss) && (
              <div className="p-4 rounded-2xl border border-amber-800/60 bg-amber-950/20 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="text-amber-400" size={18} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Chiến Tích Hạ Gục Trùm Cuối (Bosses Defeated)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {activeStats?.combat
                    .filter((c) => c.isBoss)
                    .map((boss) => (
                      <div
                        key={boss.id}
                        className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Trophy className="text-amber-400 shrink-0" size={18} />
                          <span className="text-xs font-bold text-amber-200 truncate">{boss.name}</span>
                        </div>
                        <span className="text-sm font-extrabold text-amber-300 font-mono">
                          {boss.count} lần
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Combat Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <Flame size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Sát Thương Gây Ra
                  </p>
                  <p className="text-sm font-bold text-foreground font-mono mt-0.5">
                    {(activeStats?.survival.damageDealt || 0).toLocaleString('vi-VN')} Tim (HP)
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Sát Thương Nhận Vào
                  </p>
                  <p className="text-sm font-bold text-foreground font-mono mt-0.5">
                    {(activeStats?.survival.damageTaken || 0).toLocaleString('vi-VN')} Tim (HP)
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Skull size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Số Lần Hi Sinh
                  </p>
                  <p className="text-sm font-bold text-purple-300 font-mono mt-0.5">
                    {(activeStats?.survival.deaths || 0).toLocaleString('vi-VN')} lần
                  </p>
                </div>
              </div>
            </div>

            {/* Mob Kills Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {activeStats?.combat.map((mob) => (
                <div
                  key={mob.id}
                  className="p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-red-500/40 hover:bg-zinc-900 transition-all duration-200 shadow-md flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Sword size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-red-400 transition-colors">
                        {mob.name}
                      </p>
                      <span className="text-[10px] text-zinc-500">
                        {mob.isBoss ? 'Trùm Cuối (Boss)' : 'Quái vật'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-foreground font-mono">
                      {mob.count.toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. Travel Category ──────────────────────────────────────────────── */}
        {activeCategory === 'travel' && (
          <div className="space-y-4">
            {/* Total Distance Banner */}
            <div className="p-4 rounded-2xl border border-primary/30 bg-primary/10 shadow-md flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-primary/20 text-primary border border-primary/40 flex items-center justify-center shrink-0">
                  <Compass size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Tổng Quãng Đường Đã Chinh Phục</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tính toán trên toàn bộ phương thức di chuyển trong game
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-2xl font-black text-primary font-mono tracking-tight">
                  {formatDistance(activeStats?.travel.totalDistanceMeters || 0)}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {(activeStats?.travel.jumps || 0).toLocaleString('vi-VN')} cú nhảy (Jumps)
                </p>
              </div>
            </div>

            {/* Travel breakdown cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Walking */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
                    <Footprints size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Đi Bộ (Walking)</p>
                    <p className="text-[10px] text-muted-foreground">Tốc độ bình thường</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-foreground font-mono">
                  {formatDistance(activeStats?.travel.walkMeters || 0)}
                </span>
              </div>

              {/* Sprinting */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Chạy Nhanh (Sprinting)</p>
                    <p className="text-[10px] text-muted-foreground">Tăng tốc tiêu hao đói</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-amber-300 font-mono">
                  {formatDistance(activeStats?.travel.sprintMeters || 0)}
                </span>
              </div>

              {/* Elytra Flying */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                    <Plane size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Bay Lượn Elytra</p>
                    <p className="text-[10px] text-muted-foreground">Lướt gió với pháo hoa</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-cyan-300 font-mono">
                  {formatDistance(activeStats?.travel.flyElytraMeters || 0)}
                </span>
              </div>

              {/* Swimming */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                    <Fish size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Bơi Lội (Swimming)</p>
                    <p className="text-[10px] text-muted-foreground">Khám phá sông & đại dương</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-blue-300 font-mono">
                  {formatDistance(activeStats?.travel.swimMeters || 0)}
                </span>
              </div>

              {/* Boating */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <Anchor size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Đi Thuyền (Boating)</p>
                    <p className="text-[10px] text-muted-foreground">Chèo thuyền trên nước & băng</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-emerald-300 font-mono">
                  {formatDistance(activeStats?.travel.boatMeters || 0)}
                </span>
              </div>

              {/* Horse & Minecart */}
              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Cưỡi Ngựa & Xe Mỏ</p>
                    <p className="text-[10px] text-muted-foreground">Đường ray & thú cưỡi</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-purple-300 font-mono">
                  {formatDistance(
                    (activeStats?.travel.horseMeters || 0) + (activeStats?.travel.minecartMeters || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. Survival & Life Category ─────────────────────────────────────── */}
        {activeCategory === 'survival' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Sleep */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <Moon size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Đêm Ngủ Trong Giường</p>
                  <p className="text-[10px] text-muted-foreground">Bỏ qua đêm tối & Phantom</p>
                </div>
              </div>
              <span className="text-base font-extrabold text-foreground font-mono">
                {activeStats?.survival.timesSlept.toLocaleString('vi-VN')} <span className="text-xs font-normal">lần</span>
              </span>
            </div>

            {/* Chests */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Box size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Số Lần Mở Rương</p>
                  <p className="text-[10px] text-muted-foreground">Cất giữ & lấy tài nguyên</p>
                </div>
              </div>
              <span className="text-base font-extrabold text-foreground font-mono">
                {activeStats?.survival.chestsOpened.toLocaleString('vi-VN')} <span className="text-xs font-normal">lần</span>
              </span>
            </div>

            {/* Fishing */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                  <Fish size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Cá & Báu Vật Đã Câu</p>
                  <p className="text-[10px] text-muted-foreground">Thực phẩm & sách phép</p>
                </div>
              </div>
              <span className="text-base font-extrabold text-foreground font-mono">
                {activeStats?.survival.fishCaught.toLocaleString('vi-VN')} <span className="text-xs font-normal">con</span>
              </span>
            </div>

            {/* Animal breeding */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center shrink-0">
                  <Heart size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Nhân Giống Vật Nuôi</p>
                  <p className="text-[10px] text-muted-foreground">Bò, cừu, heo, sói, mèo...</p>
                </div>
              </div>
              <span className="text-base font-extrabold text-foreground font-mono">
                {activeStats?.survival.animalsBred.toLocaleString('vi-VN')} <span className="text-xs font-normal">lần</span>
              </span>
            </div>

            {/* Enchants */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Trang Bị Đã Phù Phép</p>
                  <p className="text-[10px] text-muted-foreground">Cường hóa vũ khí & giáp</p>
                </div>
              </div>
              <span className="text-base font-extrabold text-foreground font-mono">
                {activeStats?.survival.enchantedItems.toLocaleString('vi-VN')} <span className="text-xs font-normal">món</span>
              </span>
            </div>

            {/* Raid wins */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Trophy size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Thắng Đột Kích (Raids Won)</p>
                  <p className="text-[10px] text-muted-foreground">Bảo vệ thành công dân làng</p>
                </div>
              </div>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {activeStats?.survival.raidsWon.toLocaleString('vi-VN')} <span className="text-xs font-normal">lần</span>
              </span>
            </div>
          </div>
        )}

        {/* ── 5. Sessions History Category ────────────────────────────────────── */}
        {activeCategory === 'sessions' && (
          <div className="space-y-3">
            {statsData?.launcherStats.sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/40 border border-zinc-700/40 text-zinc-400">
                  <History size={32} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Chưa có lịch sử phiên chơi</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Mỗi khi bạn khởi chạy và thoát khỏi game Minecraft, Launcher sẽ tự động ghi nhận nhật ký thời gian chơi tại đây!
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {statsData?.launcherStats.sessions.map((session, index) => {
                  const startDate = new Date(session.startTime)
                  const isRecent = index === 0

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'p-3.5 px-4 rounded-2xl border transition-all duration-200 shadow-md flex items-center justify-between gap-4',
                        isRecent
                          ? 'border-primary/50 bg-zinc-900/95 ring-1 ring-primary/20'
                          : 'border-zinc-800/80 bg-zinc-900/85 hover:bg-zinc-900 hover:border-zinc-700'
                      )}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={cn(
                            'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold',
                            isRecent
                              ? 'bg-primary/20 text-primary border border-primary/40'
                              : 'bg-zinc-800 text-zinc-400'
                          )}
                        >
                          #{statsData.launcherStats.sessions.length - index}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {startDate.toLocaleDateString('vi-VN', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">
                              {startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isRecent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/20 text-primary border border-primary/30">
                                Mới nhất
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            Kết thúc lúc:{' '}
                            {new Date(session.endTime).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-foreground font-mono">
                          {formatDuration(session.durationSeconds)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
