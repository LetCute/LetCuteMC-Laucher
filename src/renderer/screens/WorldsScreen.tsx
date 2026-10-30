import { useState, useEffect, useMemo } from 'react'
import {
  Globe,
  Search,
  RefreshCw,
  FolderOpen,
  Download,
  Archive,
  Copy,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Compass,
  Layers,
  HardDrive,
  Clock,
  Key,
  Eye,
  EyeOff,
  Check,
  Loader2,
  FileArchive,
  ArrowUpDown,
  MoreHorizontal,
  ChevronDown,
  Filter,
} from 'lucide-react'
import type { MinecraftWorld, WorldBackupItem, WorldGameType } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

interface WorldsScreenProps {
  gameDir?: string
  profileName?: string
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Chưa rõ'
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 0) return 'Vừa xong'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Vừa xong'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`

  const date = new Date(timestamp)
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const GAME_TYPE_FILTERS = [
  { id: 'all', label: 'Tất cả chế độ', icon: Globe, color: 'text-zinc-400' },
  { id: 'survival', label: 'Sinh tồn', icon: Compass, color: 'text-emerald-400' },
  { id: 'creative', label: 'Sáng tạo', icon: Sparkles, color: 'text-cyan-400' },
  { id: 'hardcore', label: 'Siêu khó', icon: ShieldAlert, color: 'text-red-400' },
  { id: 'adventure', label: 'Phiêu lưu', icon: Layers, color: 'text-amber-400' },
] as const

const SORT_OPTIONS = [
  { id: 'lastPlayed', label: 'Chơi gần nhất' },
  { id: 'name', label: 'Tên (A-Z)' },
  { id: 'size', label: 'Dung lượng lớn nhất' },
] as const

function getGameTypeDetails(gameType: WorldGameType, isHardcore: boolean) {
  if (isHardcore) {
    return {
      label: 'Siêu khó',
      badgeVariant: 'danger' as const,
      icon: ShieldAlert,
    }
  }
  switch (gameType) {
    case 'survival':
      return {
        label: 'Sinh tồn',
        badgeVariant: 'success' as const,
        icon: Compass,
      }
    case 'creative':
      return {
        label: 'Sáng tạo',
        badgeVariant: 'info' as const,
        icon: Sparkles,
      }
    case 'adventure':
      return {
        label: 'Phiêu lưu',
        badgeVariant: 'warning' as const,
        icon: Layers,
      }
    case 'spectator':
      return {
        label: 'Khán giả',
        badgeVariant: 'ghost' as const,
        icon: Globe,
      }
    default:
      return {
        label: 'Sinh tồn',
        badgeVariant: 'success' as const,
        icon: Compass,
      }
  }
}

export function WorldsScreen({ gameDir, profileName }: WorldsScreenProps) {
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [worlds, setWorlds] = useState<MinecraftWorld[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'lastPlayed' | 'name' | 'size'>('lastPlayed')

  // Backups modal state
  const [activeBackupsWorld, setActiveBackupsWorld] = useState<MinecraftWorld | null>(null)
  const [backupsList, setBackupsList] = useState<WorldBackupItem[]>([])
  const [isLoadingBackups, setIsLoadingBackups] = useState(false)

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<MinecraftWorld | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Streamer safe seed reveal state
  const [revealedSeeds, setRevealedSeeds] = useState<Record<string, boolean>>({})
  const toggleSeedReveal = (folderName: string) => {
    setRevealedSeeds((prev) => ({ ...prev, [folderName]: !prev[folderName] }))
  }

  // Loading states for actions
  const [backingUpMap, setBackingUpMap] = useState<Record<string, boolean>>({})
  const [isImporting, setIsImporting] = useState(false)

  const loadWorlds = async () => {
    setIsLoading(true)
    try {
      const items = await launcherClient.scanWorlds(gameDir)
      setWorlds(items)
    } catch (e) {
      console.error('Error loading worlds:', e)
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Không thể tải danh sách thế giới: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadWorlds()
  }, [gameDir])

  const filteredWorlds = useMemo(() => {
    return worlds
      .filter((w) => {
        const matchesQuery =
          !searchQuery.trim() ||
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.folderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (w.seed && w.seed.includes(searchQuery.trim()))

        if (!matchesQuery) return false

        if (selectedType === 'survival') return w.gameType === 'survival' && !w.isHardcore
        if (selectedType === 'creative') return w.gameType === 'creative'
        if (selectedType === 'hardcore') return w.isHardcore
        if (selectedType === 'adventure') return w.gameType === 'adventure'

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'size') return b.sizeBytes - a.sizeBytes
        return b.lastPlayed - a.lastPlayed
      })
  }, [worlds, searchQuery, selectedType, sortBy])

  const totalSize = useMemo(() => {
    return worlds.reduce((acc, w) => acc + w.sizeBytes, 0)
  }, [worlds])

  const selectedTypeObj = GAME_TYPE_FILTERS.find((f) => f.id === selectedType) || GAME_TYPE_FILTERS[0]
  const selectedSortObj = SORT_OPTIONS.find((s) => s.id === sortBy) || SORT_OPTIONS[0]

  // Handle Quick Backup
  const handleBackup = async (world: MinecraftWorld) => {
    setBackingUpMap((prev) => ({ ...prev, [world.folderName]: true }))
    try {
      const res = await launcherClient.backupWorld(gameDir, world.folderName)
      if (res.success) {
        showToast('success', `Đã tạo bản sao lưu (${formatBytes(res.sizeBytes)})`)
        setWorlds((prev) =>
          prev.map((w) =>
            w.folderName === world.folderName
              ? { ...w, backupCount: (w.backupCount || 0) + 1 }
              : w
          )
        )
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Sao lưu thất bại: ${message}`)
    } finally {
      setBackingUpMap((prev) => ({ ...prev, [world.folderName]: false }))
    }
  }

  // Handle Export Zip
  const handleExportZip = async (world: MinecraftWorld) => {
    try {
      const defaultName = `${world.name.replace(/[<>:"/\\|?*]/g, '_')}_world.zip`
      const destination = await launcherClient.saveFileDialog({
        defaultPath: defaultName,
        filters: [{ name: 'Minecraft World ZIP Archive', extensions: ['zip'] }],
      })

      if (!destination) return

      const ok = await launcherClient.exportWorldZip(gameDir, world.folderName, destination)
      if (ok) {
        showToast('success', `Đã xuất thế giới ra tệp ZIP thành công!`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Xuất thế giới thất bại: ${message}`)
    }
  }

  // Handle Import Zip
  const handleImportZip = async () => {
    try {
      const sourceZip = await launcherClient.openFileDialog([
        { name: 'Minecraft World ZIP Archive (*.zip)', extensions: ['zip'] },
      ])

      if (!sourceZip) return

      setIsImporting(true)
      const res = await launcherClient.importWorldZip(gameDir, sourceZip)
      if (res.success) {
        showToast('success', `Đã nhập thế giới "${res.name}" thành công!`)
        await loadWorlds()
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Nhập thế giới thất bại: ${message}`)
    } finally {
      setIsImporting(false)
    }
  }

  // Handle Duplicate World
  const handleDuplicate = async (world: MinecraftWorld) => {
    try {
      const newName = `${world.name} (Bản sao)`
      const res = await launcherClient.duplicateWorld(gameDir, world.folderName, newName)
      if (res.success) {
        showToast('success', `Đã nhân bản thế giới thành công!`)
        await loadWorlds()
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Nhân bản thế giới thất bại: ${message}`)
    }
  }

  // Handle Open Rename Modal
  const openRenameModal = (world: MinecraftWorld) => {
    setRenameTarget(world)
    setRenameInput(world.name)
  }

  // Handle Save Rename
  const handleSaveRename = async () => {
    if (!renameTarget || !renameInput.trim()) return
    setIsRenaming(true)
    try {
      const ok = await launcherClient.renameWorld(gameDir, renameTarget.folderName, renameInput.trim())
      if (ok) {
        showToast('success', 'Đã đổi tên thế giới thành công!')
        setWorlds((prev) =>
          prev.map((w) =>
            w.folderName === renameTarget.folderName ? { ...w, name: renameInput.trim() } : w
          )
        )
        setRenameTarget(null)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Đổi tên thất bại: ${message}`)
    } finally {
      setIsRenaming(false)
    }
  }

  // Handle Delete World
  const handleDeleteWorld = async (world: MinecraftWorld) => {
    const isConfirmed = await confirm({
      title: 'Xóa thế giới',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn thế giới "${world.name}" (${world.folderName}) không? Hành động này không thể hoàn tác!`,
      isDestructive: true,
    })

    if (!isConfirmed) return

    try {
      const ok = await launcherClient.deleteWorld(gameDir, world.folderName)
      if (ok) {
        showToast('success', `Đã xóa thế giới "${world.name}"`)
        setWorlds((prev) => prev.filter((w) => w.folderName !== world.folderName))
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Xóa thế giới thất bại: ${message}`)
    }
  }

  // Handle Open Backups Modal
  const openBackupsModal = async (world: MinecraftWorld) => {
    setActiveBackupsWorld(world)
    setIsLoadingBackups(true)
    try {
      const items = await launcherClient.listWorldBackups(gameDir, world.folderName)
      setBackupsList(items)
    } catch (e) {
      console.error('Error loading backups:', e)
    } finally {
      setIsLoadingBackups(false)
    }
  }

  // Handle Restore Backup
  const handleRestoreBackup = async (backup: WorldBackupItem) => {
    if (!activeBackupsWorld) return

    const isConfirmed = await confirm({
      title: 'Khôi phục bản sao lưu',
      message: `Khôi phục bản sao lưu "${backup.fileName}" sẽ ghi đè lên dữ liệu hiện tại của "${activeBackupsWorld.name}". Bạn có muốn tiếp tục?`,
      isDestructive: true,
    })

    if (!isConfirmed) return

    try {
      const res = await launcherClient.restoreWorldBackup(gameDir, backup.filePath, activeBackupsWorld.folderName)
      if (res.success) {
        showToast('success', 'Đã khôi phục thế giới từ bản sao lưu thành công!')
        setActiveBackupsWorld(null)
        await loadWorlds()
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Khôi phục thất bại: ${message}`)
    }
  }

  // Handle Delete Backup
  const handleDeleteBackup = async (backup: WorldBackupItem) => {
    try {
      const ok = await launcherClient.deleteWorldBackup(backup.filePath)
      if (ok) {
        showToast('success', 'Đã xóa bản sao lưu')
        setBackupsList((prev) => prev.filter((b) => b.id !== backup.id))
        setWorlds((prev) =>
          prev.map((w) =>
            w.folderName === activeBackupsWorld?.folderName
              ? { ...w, backupCount: Math.max(0, (w.backupCount || 1) - 1) }
              : w
          )
        )
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showToast('error', `Xóa bản sao lưu thất bại: ${message}`)
    }
  }

  // Copy Seed to Clipboard
  const handleCopySeed = (seed: string) => {
    void navigator.clipboard.writeText(seed)
    showToast('success', 'Đã sao chép Seed vào bộ nhớ tạm.')
  }

  // Open Folder
  const handleOpenFolder = (folderName?: string) => {
    void launcherClient.openWorldFolder(gameDir, folderName)
  }

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col h-full gap-4 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-foreground/80 tracking-tight whitespace-nowrap">
              Quản lý Thế giới
            </h2>
            {profileName && (
              <span className="text-xs font-medium text-zinc-300 px-2.5 py-1 bg-zinc-900/90 border border-zinc-800 rounded-md truncate max-w-xs">
                Cấu hình: <strong className="text-primary font-semibold">{profileName}</strong>
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 whitespace-nowrap">
            <span className="whitespace-nowrap">Tổng: <strong className="text-zinc-200">{worlds.length}</strong> thế giới</span>
            <span className="text-zinc-700">·</span>
            <span className="whitespace-nowrap">Dung lượng: <strong className="text-primary font-semibold">{formatBytes(totalSize)}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleImportZip}
            disabled={isImporting}
            variant="primary"
            size="sm"
            className="h-9 px-3.5 shadow-sm font-semibold text-xs"
            title="Nhập bản đồ từ file ZIP"
          >
            {isImporting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Download size={14} className="mr-1.5" />}
            Nhập ZIP
          </Button>

          <Button
            onClick={() => handleOpenFolder()}
            variant="elevated"
            size="sm"
            className="h-9 px-3 text-xs"
            title="Mở thư mục saves trong Explorer"
          >
            <FolderOpen size={14} className="mr-1.5" />
            Thư mục Saves
          </Button>

          <Button
            onClick={loadWorlds}
            disabled={isLoading}
            variant="elevated"
            size="sm"
            className="h-9 px-3 text-xs"
            title="Làm mới danh sách"
          >
            <RefreshCw size={13} className={cn(isLoading && 'animate-spin', 'mr-1.5')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Search & Compact Dropdown Filters Bar */}
      <div className="flex gap-2.5 items-center">
        {/* Search Field */}
        <div className="flex-1 min-w-[220px]">
          <Input
            className="bg-zinc-900/90 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-primary/60 h-9 rounded-md text-xs"
            type="text"
            placeholder="Tìm kiếm theo tên thế giới, thư mục, seed..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4 text-zinc-400" />}
          />
        </div>

        {/* Game Mode Custom Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-zinc-900/80 border-zinc-700/70 text-zinc-200 hover:text-zinc-200 hover:bg-zinc-800 hover:border-primary/50 text-xs gap-2 rounded-md shrink-0 transition-all shadow-sm"
            >
              <Filter size={13} className="text-primary" />
              <span className="text-zinc-400 text-[11px]">Chế độ:</span>
              <span className="font-semibold text-zinc-200">{selectedTypeObj.label}</span>
              <ChevronDown size={13} className="text-zinc-400 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-zinc-900/95 border-zinc-700/60 rounded-md backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50 animate-in fade-in zoom-in-95 duration-150">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 px-3 py-1.5">
              Chế độ chơi
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />
            {GAME_TYPE_FILTERS.map((opt) => {
              const Icon = opt.icon
              const isSelected = selectedType === opt.id
              return (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => setSelectedType(opt.id)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-xs rounded-md cursor-pointer transition-all duration-150',
                    isSelected
                      ? 'bg-primary/20 text-zinc-200 font-semibold border border-primary/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'text-zinc-200 hover:bg-zinc-800/90 hover:text-zinc-200'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={isSelected ? 'text-primary' : opt.color} />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-primary" />}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort Custom Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-zinc-900/80 border-zinc-700/70 text-zinc-200 hover:text-zinc-200 hover:bg-zinc-800 hover:border-primary/50 text-xs gap-2 rounded-md shrink-0 transition-all shadow-sm"
            >
              <ArrowUpDown size={13} className="text-primary" />
              <span className="text-zinc-400 text-[11px]">Sắp xếp:</span>
              <span className="font-semibold text-zinc-200">{selectedSortObj.label}</span>
              <ChevronDown size={13} className="text-zinc-400 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-zinc-900/95 border-zinc-700/60 rounded-md backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50 animate-in fade-in zoom-in-95 duration-150">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 px-3 py-1.5">
              Sắp xếp thế giới
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />
            {SORT_OPTIONS.map((opt) => {
              const isSelected = sortBy === opt.id
              return (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-xs rounded-md cursor-pointer transition-all duration-150',
                    isSelected
                      ? 'bg-primary/20 text-zinc-200 font-semibold border border-primary/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'text-zinc-200 hover:bg-zinc-800/90 hover:text-zinc-200'
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check size={14} className="text-primary" />}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* World List Content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Đang quét danh sách thế giới...</p>
          </div>
        ) : filteredWorlds.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-zinc-800/40 border border-zinc-700/40 text-zinc-400">
              <Globe size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                {searchQuery || selectedType !== 'all'
                  ? 'Không tìm thấy thế giới phù hợp'
                  : 'Chưa có thế giới Minecraft nào'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                {searchQuery || selectedType !== 'all'
                  ? 'Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang "Tất cả chế độ".'
                  : 'Hãy vào game tạo thế giới mới, hoặc bấm nút "Nhập ZIP" ở trên để cài đặt bản đồ.'}
              </p>
            </div>
            {selectedType !== 'all' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedType('all')}
                className="mt-1 text-xs bg-zinc-800/80 border-zinc-700 hover:border-primary/50 text-zinc-200"
              >
                Xem tất cả chế độ
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleImportZip}
                className="mt-1 font-semibold text-xs"
              >
                <Download size={14} className="mr-1.5" />
                Nhập thế giới từ ZIP
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-4">
            {filteredWorlds.map((world) => {
              const gameTypeInfo = getGameTypeDetails(world.gameType, world.isHardcore)
              const isBackingUpThis = backingUpMap[world.folderName]

              return (
                <div
                  key={world.folderName}
                  className="group relative flex flex-col justify-between p-4 rounded-md border border-zinc-800/60 bg-zinc-950/45 hover:border-zinc-700/60 hover:bg-zinc-950/70 transition-all duration-200 shadow-xs cv-auto"
                >
                  {/* Top Section: Thumbnail + Info */}
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-700/60 bg-zinc-950 shadow-inner group-hover:border-primary/40 transition-colors">
                      {world.iconBase64 ? (
                        <img
                          src={world.iconBase64}
                          alt={world.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-800/80 text-zinc-400">
                          <Globe size={26} className="opacity-80" />
                        </div>
                      )}

                      {/* Hardcore Indicator */}
                      {world.isHardcore && (
                        <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 shadow-md">
                          <ShieldAlert size={10} className="text-white" />
                        </div>
                      )}
                    </div>

                    {/* Details Column */}
                    <div className="flex-1 min-w-0">
                      {/* Badges & Game Version */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={gameTypeInfo.badgeVariant} className="text-[11px] h-5 font-semibold">
                          {gameTypeInfo.label}
                        </Badge>

                        <Badge variant="secondary" className="text-[11px] h-5 bg-zinc-800 text-zinc-300 border-zinc-700">
                          {world.versionName}
                        </Badge>

                        {world.allowCommands && (
                          <Badge variant="info" className="text-[10px] h-5" title="Bật lệnh gian lận">
                            Cheats
                          </Badge>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className="text-base font-bold text-foreground/85 truncate mt-1.5 group-hover:text-primary transition-colors"
                        title={world.name}
                      >
                        {world.name}
                      </h3>

                      {/* Metadata Line */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                        <span className="truncate max-w-[150px] font-mono text-[11px] text-zinc-400">📁 {world.folderName}</span>
                        <span className="text-zinc-700">·</span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-300">
                          <Clock size={11} className="text-primary" />
                          {formatRelativeTime(world.lastPlayed)}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className="flex items-center gap-1 font-semibold text-zinc-200 text-[11px]">
                          <HardDrive size={11} className="text-primary" />
                          {formatBytes(world.sizeBytes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Seed Line (Streamer Safe - Masked by default) */}
                  {world.seed && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] min-w-0">
                        <Key size={11} className="text-primary/80 shrink-0" />
                        <span className="text-muted-foreground shrink-0">Seed:</span>
                        <span className={cn(
                          'font-medium transition-all select-all truncate',
                          revealedSeeds[world.folderName]
                            ? 'text-zinc-200'
                            : 'text-zinc-500 tracking-wider font-sans text-[10px]'
                        )}>
                          {revealedSeeds[world.folderName] ? world.seed : '••••••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSeedReveal(world.folderName)}
                          className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5 rounded hover:bg-zinc-800 shrink-0"
                          title={revealedSeeds[world.folderName] ? 'Ẩn Seed (Chế độ Stream)' : 'Hiện Seed'}
                        >
                          {revealedSeeds[world.folderName] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleCopySeed(world.seed!)}
                        className="text-[11px] font-semibold text-primary hover:underline shrink-0 flex items-center gap-1"
                        title="Sao chép Seed vào bộ nhớ tạm"
                      >
                        <Copy size={11} />
                        <span>Sao chép</span>
                      </button>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Quick Backup Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBackup(world)}
                        disabled={isBackingUpThis}
                        className={cn(
                          'h-8 px-2.5 text-xs gap-1.5 border-zinc-700/80 transition-all font-semibold',
                          world.backupCount > 0
                            ? 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
                            : 'bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800 hover:border-primary/40'
                        )}
                        title="Tạo bản sao lưu ngay lập tức"
                      >
                        {isBackingUpThis ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Archive size={13} className={world.backupCount > 0 ? 'text-primary' : 'text-zinc-400'} />
                        )}
                        <span>{world.backupCount > 0 ? `Sao lưu (${world.backupCount})` : 'Sao lưu'}</span>
                      </Button>

                      {/* Backups History Modal */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBackupsModal(world)}
                        className="h-8 px-2.5 text-xs gap-1 bg-zinc-800/80 border-zinc-700/80 text-zinc-200 hover:text-zinc-200 hover:bg-zinc-800 hover:border-primary/40 transition-all"
                        title="Quản lý lịch sử bản sao lưu & Khôi phục"
                      >
                        <RotateCcw size={12} className="text-zinc-400" />
                        <span>Khôi phục</span>
                      </Button>

                      {/* Export Zip */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportZip(world)}
                        className="h-8 px-2.5 text-xs gap-1 bg-zinc-800/80 border-zinc-700/80 text-zinc-200 hover:text-zinc-200 hover:bg-zinc-800 hover:border-primary/40 transition-all"
                        title="Xuất bản đồ thành tệp ZIP"
                      >
                        <FileArchive size={12} className="text-zinc-400" />
                        <span>Xuất ZIP</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Open Folder in Explorer */}
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleOpenFolder(world.folderName)}
                        className="h-8 w-8 bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:text-zinc-200 hover:bg-zinc-800 hover:border-primary/40 transition-all"
                        title="Mở thư mục trong Explorer"
                      >
                        <FolderOpen size={13} />
                      </Button>

                      {/* More Actions Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="h-8 w-8 bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:text-zinc-200 hover:bg-zinc-800 hover:border-primary/40 transition-all"
                            title="Thao tác khác"
                          >
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-zinc-900/95 border-zinc-700/60 rounded-md backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50 animate-in fade-in zoom-in-95 duration-150">
                          <DropdownMenuItem
                            onClick={() => openRenameModal(world)}
                            className="cursor-pointer text-xs py-2 px-2.5 gap-2 text-zinc-200 hover:bg-zinc-800/90 hover:text-zinc-200 rounded-md transition-all"
                          >
                            <Pencil size={13} className="text-zinc-400" />
                            <span>Đổi tên hiển thị</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleDuplicate(world)}
                            className="cursor-pointer text-xs py-2 px-2.5 gap-2 text-zinc-200 hover:bg-zinc-800/90 hover:text-zinc-200 rounded-md transition-all"
                          >
                            <Copy size={13} className="text-zinc-400" />
                            <span>Nhân bản thế giới</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="bg-zinc-800 my-1" />

                          <DropdownMenuItem
                            onClick={() => handleDeleteWorld(world)}
                            className="cursor-pointer text-xs py-2 px-2.5 gap-2 text-destructive focus:text-destructive focus:bg-destructive/15 rounded-md transition-all"
                          >
                            <Trash2 size={13} />
                            <span>Xóa vĩnh viễn</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <Modal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Đổi tên thế giới"
        description="Thay đổi tên hiển thị (LevelName) của thế giới trong game."
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="elevated" onClick={() => setRenameTarget(null)} disabled={isRenaming}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRename}
              disabled={isRenaming || !renameInput.trim() || renameInput.trim() === renameTarget?.name}
            >
              {isRenaming ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
              {isRenaming ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên thế giới mới</label>
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Nhập tên mới..."
              maxLength={40}
              autoFocus
              className="bg-zinc-900 border-zinc-800"
            />
          </div>
          {renameTarget && (
            <p className="text-[11px] text-muted-foreground">
              Thư mục lưu trữ: <span className="font-mono text-zinc-200 font-semibold">{renameTarget.folderName}</span> (sẽ được giữ nguyên).
            </p>
          )}
        </div>
      </Modal>

      {/* Backups History & Restore Modal */}
      <Modal
        isOpen={Boolean(activeBackupsWorld)}
        onClose={() => setActiveBackupsWorld(null)}
        title={`Bản sao lưu – ${activeBackupsWorld?.name || ''}`}
        description="Danh sách các bản sao lưu đã tạo. Bạn có thể khôi phục hoặc xóa bớt để giải phóng bộ nhớ."
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="primary"
              size="sm"
              onClick={() => activeBackupsWorld && handleBackup(activeBackupsWorld)}
              className="text-xs font-semibold"
            >
              <Archive size={13} className="mr-1.5" />
              Tạo bản sao lưu mới
            </Button>
            <Button variant="elevated" onClick={() => setActiveBackupsWorld(null)}>
              Đóng
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          {isLoadingBackups ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : backupsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground gap-2">
              <Archive size={28} className="text-muted-foreground/40" />
              <p className="text-xs">Chưa có bản sao lưu nào cho thế giới này.</p>
              <p className="text-[11px] text-muted-foreground/60">
                Hãy bấm "Tạo bản sao lưu mới" ở góc dưới để bảo vệ dữ liệu map của bạn.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {backupsList.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-zinc-800 bg-zinc-900/90 hover:border-primary/40 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-200 truncate font-mono">
                      {backup.fileName}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-primary" />
                        {new Date(backup.createdAt).toLocaleString('vi-VN')}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-zinc-200">
                        <HardDrive size={10} className="text-primary" />
                        {formatBytes(backup.sizeBytes)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreBackup(backup)}
                      className="h-7 text-xs px-2.5 bg-zinc-800 border-zinc-700 hover:border-primary/40 hover:bg-primary/15 hover:text-primary transition-all"
                      title="Khôi phục lại thế giới từ bản sao lưu này"
                    >
                      <RotateCcw size={12} className="mr-1" />
                      Khôi phục
                    </Button>

                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => handleDeleteBackup(backup)}
                      className="h-7 w-7 bg-zinc-800 border-zinc-700 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                      title="Xóa bản sao lưu này"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
