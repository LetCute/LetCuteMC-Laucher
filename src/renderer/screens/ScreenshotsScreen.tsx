import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Camera,
  Search,
  RefreshCw,
  FolderOpen,
  Copy,
  Trash2,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  CheckSquare,
  Square,
  ZoomIn,
  Grid3X3,
  LayoutGrid,
} from 'lucide-react'
import type { MinecraftScreenshot } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/Input'
import { cn } from '@/lib/utils'

interface ScreenshotsScreenProps {
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

function formatDateTime(timestamp: number): string {
  if (!timestamp) return 'Chưa rõ'
  const date = new Date(timestamp)
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDateGroupLabel(timestamp: number): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000
  const oneWeekAgo = today - 7 * 24 * 60 * 60 * 1000
  const oneMonthAgo = today - 30 * 24 * 60 * 60 * 1000

  if (timestamp >= today) return 'Hôm nay'
  if (timestamp >= yesterday) return 'Hôm qua'
  if (timestamp >= oneWeekAgo) return 'Tuần này'
  if (timestamp >= oneMonthAgo) return 'Tháng này'
  return 'Cũ hơn'
}

export function ScreenshotsScreen({ gameDir, profileName }: ScreenshotsScreenProps) {
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [screenshots, setScreenshots] = useState<MinecraftScreenshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [gridSize, setGridSize] = useState<'normal' | 'large'>('normal')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Lightbox state
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)
  const [isCopying, setIsCopying] = useState(false)

  const loadScreenshots = async () => {
    setIsLoading(true)
    try {
      const items = await launcherClient.scanScreenshots(gameDir)
      setScreenshots(items)
      setSelectedIds(new Set())
    } catch (e: any) {
      console.error('Error loading screenshots:', e)
      showToast('error', `Không thể tải danh sách ảnh: ${e?.message || e}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadScreenshots()
  }, [gameDir])

  const filteredScreenshots = useMemo(() => {
    return screenshots.filter((item) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      const dateStr = new Date(item.createdAt).toLocaleDateString('vi-VN')
      return item.fileName.toLowerCase().includes(query) || dateStr.includes(query)
    })
  }, [screenshots, searchQuery])

  const totalSize = useMemo(() => {
    return screenshots.reduce((acc, s) => acc + s.sizeBytes, 0)
  }, [screenshots])

  // Group screenshots by date
  const groupedScreenshots = useMemo(() => {
    const groups: { label: string; items: MinecraftScreenshot[] }[] = []
    const order = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Tháng này', 'Cũ hơn']

    for (const label of order) {
      const items = filteredScreenshots.filter((s) => getDateGroupLabel(s.createdAt) === label)
      if (items.length > 0) {
        groups.push({ label, items })
      }
    }
    return groups
  }, [filteredScreenshots])

  // Copy screenshot to clipboard
  const handleCopy = async (screenshot: MinecraftScreenshot) => {
    setIsCopying(true)
    try {
      const ok = await launcherClient.copyScreenshotToClipboard(screenshot.filePath)
      if (ok) {
        showToast('success', 'Đã sao chép hình ảnh vào Clipboard! (Ctrl+V để dán)')
      } else {
        showToast('error', 'Không thể sao chép hình ảnh vào Clipboard.')
      }
    } catch (e: any) {
      showToast('error', `Lỗi sao chép: ${e?.message || e}`)
    } finally {
      setIsCopying(false)
    }
  }

  // Show in Explorer
  const handleShowInFolder = (filePath: string) => {
    void launcherClient.showScreenshotInFolder(filePath)
  }

  // Open Screenshots Folder
  const handleOpenFolder = () => {
    void launcherClient.openScreenshotsFolder(gameDir)
  }

  // Delete single screenshot
  const handleDelete = async (screenshot: MinecraftScreenshot) => {
    const isConfirmed = await confirm({
      title: 'Xóa ảnh chụp',
      message: `Bạn có chắc chắn muốn xóa ảnh "${screenshot.fileName}" không?`,
      isDestructive: true,
    })

    if (!isConfirmed) return

    try {
      const ok = await launcherClient.deleteScreenshot(screenshot.filePath)
      if (ok) {
        showToast('success', 'Đã xóa ảnh chụp màn hình')
        setScreenshots((prev) => prev.filter((s) => s.id !== screenshot.id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(screenshot.id)
          return next
        })
        if (activeLightboxIndex !== null) {
          if (filteredScreenshots.length <= 1) {
            setActiveLightboxIndex(null)
          } else if (activeLightboxIndex >= filteredScreenshots.length - 1) {
            setActiveLightboxIndex(filteredScreenshots.length - 2)
          }
        }
      }
    } catch (e: any) {
      showToast('error', `Xóa ảnh thất bại: ${e?.message || e}`)
    }
  }

  // Delete multiple selected screenshots
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    const isConfirmed = await confirm({
      title: 'Xóa nhiều ảnh chụp',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.size} ảnh đã chọn không?`,
      isDestructive: true,
    })

    if (!isConfirmed) return

    const toDeletePaths = screenshots
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.filePath)

    try {
      const ok = await launcherClient.deleteMultipleScreenshots(toDeletePaths)
      if (ok) {
        showToast('success', `Đã xóa ${toDeletePaths.length} ảnh`)
        setScreenshots((prev) => prev.filter((s) => !selectedIds.has(s.id)))
        setSelectedIds(new Set())
      }
    } catch (e: any) {
      showToast('error', `Xóa ảnh thất bại: ${e?.message || e}`)
    }
  }

  // Toggle selection
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredScreenshots.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredScreenshots.map((s) => s.id)))
    }
  }

  // Lightbox keyboard controls
  const handlePrev = useCallback(() => {
    if (activeLightboxIndex === null) return
    setActiveLightboxIndex((prev) =>
      prev !== null && prev > 0 ? prev - 1 : filteredScreenshots.length - 1
    )
  }, [activeLightboxIndex, filteredScreenshots.length])

  const handleNext = useCallback(() => {
    if (activeLightboxIndex === null) return
    setActiveLightboxIndex((prev) =>
      prev !== null && prev < filteredScreenshots.length - 1 ? prev + 1 : 0
    )
  }, [activeLightboxIndex, filteredScreenshots.length])

  useEffect(() => {
    if (activeLightboxIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'Escape') {
        setActiveLightboxIndex(null)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const current = filteredScreenshots[activeLightboxIndex]
        if (current) void handleCopy(current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeLightboxIndex, filteredScreenshots, handlePrev, handleNext])

  const activeScreenshot =
    activeLightboxIndex !== null ? filteredScreenshots[activeLightboxIndex] : null

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col h-full gap-4 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-foreground tracking-tight whitespace-nowrap">
              Thư viện Ảnh chụp
            </h2>
            {profileName && (
              <span className="text-xs font-medium text-zinc-300 px-2.5 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg truncate max-w-xs">
                Cấu hình: <strong className="text-primary font-semibold">{profileName}</strong>
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 whitespace-nowrap">
            <span className="whitespace-nowrap">Tổng: <strong className="text-zinc-200">{screenshots.length}</strong> ảnh</span>
            <span className="text-zinc-700">·</span>
            <span className="whitespace-nowrap">Dung lượng: <strong className="text-primary font-semibold">{formatBytes(totalSize)}</strong></span>
            {selectedIds.size > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-amber-400 font-semibold whitespace-nowrap">Đã chọn {selectedIds.size} ảnh</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.size > 0 && (
            <Button
              onClick={handleDeleteSelected}
              variant="destructive"
              size="sm"
              className="h-9 px-3.5 font-semibold text-xs animate-in fade-in"
              title="Xóa các ảnh đã chọn"
            >
              <Trash2 size={14} className="mr-1.5" />
              Xóa ({selectedIds.size}) ảnh
            </Button>
          )}

          <Button
            onClick={() => handleOpenFolder()}
            variant="outline"
            size="sm"
            className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs"
            title="Mở thư mục screenshots trong Explorer"
          >
            <FolderOpen size={14} className="mr-1.5" />
            Thư mục Ảnh
          </Button>

          <Button
            onClick={loadScreenshots}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs"
            title="Làm mới danh sách ảnh"
          >
            <RefreshCw size={13} className={cn(isLoading && 'animate-spin', 'mr-1.5')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Search & Grid Display Options Bar */}
      <div className="flex gap-2.5 items-center">
        {/* Search Field */}
        <div className="flex-1 min-w-[220px]">
          <Input
            className="bg-zinc-900/90 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-primary/60 h-9 rounded-xl text-xs"
            type="text"
            placeholder="Tìm kiếm theo tên ảnh, ngày chụp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4 text-zinc-400" />}
          />
        </div>

        {/* Select All Button */}
        {filteredScreenshots.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="h-9 px-3 bg-zinc-900/80 border-zinc-700/70 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-primary/50 text-xs gap-1.5 rounded-xl shrink-0 transition-all shadow-sm"
          >
            {selectedIds.size === filteredScreenshots.length ? (
              <CheckSquare size={14} className="text-primary" />
            ) : (
              <Square size={14} className="text-zinc-400" />
            )}
            <span>{selectedIds.size === filteredScreenshots.length ? 'Bỏ chọn' : 'Chọn tất cả'}</span>
          </Button>
        )}

        {/* Grid Size Switcher */}
        <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-xl p-0.5 h-9 shrink-0">
          <button
            onClick={() => setGridSize('normal')}
            className={cn(
              'px-2.5 h-full rounded-lg text-xs font-medium flex items-center gap-1 transition-all',
              gridSize === 'normal'
                ? 'bg-primary/20 text-primary font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
            title="Lưới vừa (4 cột)"
          >
            <Grid3X3 size={13} />
            <span className="text-[11px]">Vừa</span>
          </button>
          <button
            onClick={() => setGridSize('large')}
            className={cn(
              'px-2.5 h-full rounded-lg text-xs font-medium flex items-center gap-1 transition-all',
              gridSize === 'large'
                ? 'bg-primary/20 text-primary font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
            title="Lưới lớn (3 cột)"
          >
            <LayoutGrid size={13} />
            <span className="text-[11px]">Lớn</span>
          </button>
        </div>
      </div>

      {/* Screenshots Gallery Content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Đang tải ảnh chụp màn hình...</p>
          </div>
        ) : filteredScreenshots.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/40 border border-zinc-700/40 text-zinc-400">
              <Camera size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {searchQuery ? 'Không tìm thấy ảnh chụp phù hợp' : 'Chưa có ảnh chụp màn hình nào'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                {searchQuery
                  ? 'Hãy thử tìm kiếm với từ khóa khác.'
                  : 'Hãy nhấn phím F2 khi đang chơi Minecraft để lưu lại những khoảnh khắc đẹp!'}
              </p>
            </div>
            {!searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenFolder()}
                className="mt-1 text-xs bg-zinc-800/80 border-zinc-700 hover:border-primary/50 text-zinc-200"
              >
                <FolderOpen size={14} className="mr-1.5" />
                Mở thư mục Screenshots
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 pb-6">
            {groupedScreenshots.map((group) => (
              <div key={group.label} className="flex flex-col gap-3">
                {/* Group Heading */}
                <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-1.5">
                  <Clock size={13} className="text-primary" />
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    ({group.items.length} ảnh)
                  </span>
                </div>

                {/* Items Grid */}
                <div
                  className={cn(
                    'grid gap-3.5',
                    gridSize === 'normal'
                      ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  )}
                >
                  {group.items.map((screenshot) => {
                    const isSelected = selectedIds.has(screenshot.id)
                    const fullIndex = filteredScreenshots.findIndex((s) => s.id === screenshot.id)

                    return (
                      <div
                        key={screenshot.id}
                        onClick={() => setActiveLightboxIndex(fullIndex)}
                        className={cn(
                          'group relative flex flex-col rounded-2xl border bg-zinc-900/85 overflow-hidden transition-all duration-200 cursor-pointer shadow-md hover:shadow-2xl hover:-translate-y-1',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 bg-zinc-900'
                            : 'border-zinc-800 hover:border-primary/50'
                        )}
                      >
                        {/* Image Preview Container */}
                        <div className="relative w-full aspect-video bg-zinc-950 overflow-hidden">
                          <img
                            src={screenshot.dataUrl}
                            alt={screenshot.fileName}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          {/* Hover Dark Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5">
                            {/* Top row: Checkbox & Zoom icon */}
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={(e) => toggleSelect(screenshot.id, e)}
                                className={cn(
                                  'h-6 w-6 rounded-lg flex items-center justify-center transition-all',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-black/60 text-white/80 hover:bg-black/80 hover:text-white'
                                )}
                                title={isSelected ? 'Bỏ chọn' : 'Chọn ảnh'}
                              >
                                {isSelected ? <Check size={12} strokeWidth={3} /> : <Square size={12} />}
                              </button>

                              <div className="h-6 w-6 rounded-lg bg-black/60 text-white/80 flex items-center justify-center">
                                <ZoomIn size={13} />
                              </div>
                            </div>

                            {/* Bottom row: Quick action buttons */}
                            <div
                              className="flex items-center justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => handleCopy(screenshot)}
                                className="h-7 w-7 bg-zinc-900/90 border-zinc-700 text-zinc-200 hover:text-primary hover:border-primary/50"
                                title="Sao chép ảnh vào Clipboard (Ctrl+C)"
                              >
                                <Copy size={12} />
                              </Button>

                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => handleShowInFolder(screenshot.filePath)}
                                className="h-7 w-7 bg-zinc-900/90 border-zinc-700 text-zinc-200 hover:text-primary hover:border-primary/50"
                                title="Mở trong File Explorer"
                              >
                                <FolderOpen size={12} />
                              </Button>

                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => handleDelete(screenshot)}
                                className="h-7 w-7 bg-zinc-900/90 border-zinc-700 text-destructive hover:bg-destructive/20 hover:border-destructive/40"
                                title="Xóa ảnh này"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>

                          {/* Always-visible select indicator if selected */}
                          {isSelected && (
                            <div className="absolute top-2.5 left-2.5 h-6 w-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        {/* Card Info Footer */}
                        <div className="p-3 flex flex-col gap-1 border-t border-zinc-800/60">
                          <p
                            className="text-xs font-semibold text-zinc-100 truncate group-hover:text-primary transition-colors font-mono"
                            title={screenshot.fileName}
                          >
                            {screenshot.fileName}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{formatDateTime(screenshot.createdAt)}</span>
                            <span className="font-semibold text-zinc-300">
                              {formatBytes(screenshot.sizeBytes)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Lightbox Modal */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none"
          onClick={() => setActiveLightboxIndex(null)}
        >
          {/* Top Controls Bar */}
          <div
            className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-950/80 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary shrink-0">
                <Camera size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate font-mono" title={activeScreenshot.fileName}>
                  {activeScreenshot.fileName}
                </h3>
                <p className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                  <span>{formatDateTime(activeScreenshot.createdAt)}</span>
                  <span>·</span>
                  <span className="font-semibold text-zinc-200">{formatBytes(activeScreenshot.sizeBytes)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                {(activeLightboxIndex ?? 0) + 1} / {filteredScreenshots.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(activeScreenshot)}
                disabled={isCopying}
                className="h-8 px-3 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5"
                title="Sao chép ảnh vào Clipboard (Ctrl+C)"
              >
                {isCopying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} className="text-primary" />}
                <span>Sao chép (Ctrl+C)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShowInFolder(activeScreenshot.filePath)}
                className="h-8 px-3 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5"
                title="Mở trong File Explorer"
              >
                <FolderOpen size={13} />
                <span>Mở trong Explorer</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(activeScreenshot)}
                className="h-8 px-3 text-xs bg-zinc-900 border-zinc-700 text-destructive hover:bg-destructive/20 hover:border-destructive/40 gap-1.5"
                title="Xóa ảnh này"
              >
                <Trash2 size={13} />
                <span>Xóa</span>
              </Button>

              <button
                type="button"
                onClick={() => setActiveLightboxIndex(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-2"
                title="Đóng (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Main Image View with Navigation */}
          <div className="relative flex-1 flex items-center justify-center p-6 overflow-hidden">
            {/* Previous Button */}
            {filteredScreenshots.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrev()
                }}
                className="absolute left-6 z-10 p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-white transition-all hover:scale-110 shadow-2xl"
                title="Ảnh trước (Mũi tên trái)"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Preview Image */}
            <div
              className="max-h-full max-w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeScreenshot.dataUrl}
                alt={activeScreenshot.fileName}
                className="max-h-[82vh] max-w-[88vw] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-zinc-800"
              />
            </div>

            {/* Next Button */}
            {filteredScreenshots.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                className="absolute right-6 z-10 p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-white transition-all hover:scale-110 shadow-2xl"
                title="Ảnh tiếp theo (Mũi tên phải)"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
