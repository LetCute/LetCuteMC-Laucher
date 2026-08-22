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
  Maximize2,
  Grid3X3,
  LayoutGrid,
} from 'lucide-react'
import type { MinecraftScreenshot } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/Input'
import { ScreenHeader } from '../components/common/ScreenHeader'
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
    second: '2-digit',
  })
}

function formatTimeOnly(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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
        showToast('success', 'Đã sao chép ảnh vào Clipboard (Ctrl+V để dán)')
      } else {
        showToast('error', 'Không thể sao chép ảnh vào Clipboard.')
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
  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Card click handler
  const handleCardClick = (screenshot: MinecraftScreenshot, fullIndex: number, e: React.MouseEvent) => {
    // If currently in selection mode (at least 1 item selected), clicking anywhere on the card toggles selection
    if (selectedIds.size > 0) {
      toggleSelect(screenshot.id, e)
    } else {
      setActiveLightboxIndex(fullIndex)
    }
  }

  // Select all or deselect all
  const isAllSelected = filteredScreenshots.length > 0 && selectedIds.size === filteredScreenshots.length

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredScreenshots.map((s) => s.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
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
    <div className="px-6 pt-4 pb-6 flex flex-col h-full gap-3.5 select-none">
      {/* ── Screen Header ────────────────────────────────────────────────────────── */}
      <ScreenHeader
        title="Thư viện Ảnh chụp"
        profileName={profileName}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Tổng cộng: <strong className="text-zinc-100 font-semibold">{screenshots.length}</strong> ảnh</span>
            <span className="text-zinc-600">·</span>
            <span>Dung lượng: <strong className="text-primary font-semibold">{formatBytes(totalSize)}</strong></span>
            {selectedIds.size > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-amber-400 font-semibold">Đang chọn {selectedIds.size} / {filteredScreenshots.length} ảnh</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            {selectedIds.size > 0 && (
              <>
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white text-xs"
                  title="Hủy bỏ chọn"
                >
                  Hủy chọn
                </Button>

                <Button
                  onClick={handleDeleteSelected}
                  variant="destructive"
                  size="sm"
                  className="h-8 px-3 font-semibold text-xs animate-in fade-in gap-1.5"
                  title="Xóa các ảnh đã chọn"
                >
                  <Trash2 size={13} />
                  <span>Xóa ({selectedIds.size})</span>
                </Button>
              </>
            )}

            <Button
              onClick={handleOpenFolder}
              variant="outline"
              size="sm"
              className="h-8 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
              title="Mở thư mục screenshots trong Explorer"
            >
              <FolderOpen size={13} className="text-primary" />
              <span>Thư mục Ảnh</span>
            </Button>

            <Button
              onClick={loadScreenshots}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="h-8 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
              title="Làm mới danh sách ảnh"
            >
              <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} />
              <span>Làm mới</span>
            </Button>
          </>
        }
      />

      {/* ── Search & Filter Controls ────────────────────────────────────────────── */}
      <div className="flex gap-2.5 items-center">
        {/* Search Field */}
        <div className="flex-1 min-w-[200px]">
          <Input
            className="bg-zinc-900/90 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-primary/60 h-8.5 rounded-xl text-xs"
            type="text"
            placeholder="Tìm kiếm theo tên ảnh, ngày chụp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-3.5 w-3.5 text-zinc-400" />}
          />
        </div>

        {/* Select All Button */}
        {filteredScreenshots.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className={cn(
              'h-8.5 px-3 border text-xs gap-1.5 rounded-xl shrink-0 transition-all shadow-sm',
              isAllSelected
                ? 'bg-primary/15 border-primary/40 text-primary font-semibold hover:bg-primary/25'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700'
            )}
          >
            {isAllSelected ? (
              <CheckSquare size={13} className="text-primary" />
            ) : (
              <Square size={13} className="text-zinc-400" />
            )}
            <span>{isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
          </Button>
        )}

        {/* Grid Size Switcher */}
        <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-xl p-0.5 h-8.5 shrink-0">
          <button
            onClick={() => setGridSize('normal')}
            className={cn(
              'px-2.5 h-full rounded-lg text-xs font-medium flex items-center gap-1 transition-all',
              gridSize === 'normal'
                ? 'bg-primary/20 text-primary font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
            title="Lưới vừa (4-5 cột)"
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

      {/* ── Screenshots Gallery Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-20">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Đang tải ảnh chụp màn hình...</p>
          </div>
        ) : filteredScreenshots.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/40 border border-zinc-700/40 text-zinc-400">
              <Camera size={26} />
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
                onClick={handleOpenFolder}
                className="mt-1 text-xs bg-zinc-800/80 border-zinc-700 hover:border-primary/50 text-zinc-200"
              >
                <FolderOpen size={13} className="mr-1.5 text-primary" />
                Mở thư mục Screenshots
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5 pb-6">
            {groupedScreenshots.map((group) => (
              <div key={group.label} className="flex flex-col gap-2.5">
                {/* Group Heading Badge */}
                <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-1.5">
                  <Clock size={12} className="text-primary" />
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    ({group.items.length} ảnh)
                  </span>
                </div>

                {/* Modern Image Grid */}
                <div
                  className={cn(
                    'grid gap-3',
                    gridSize === 'normal'
                      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                  )}
                >
                  {group.items.map((screenshot) => {
                    const isSelected = selectedIds.has(screenshot.id)
                    const fullIndex = filteredScreenshots.findIndex((s) => s.id === screenshot.id)

                    return (
                      <div
                        key={screenshot.id}
                        onClick={(e) => handleCardClick(screenshot, fullIndex, e)}
                        className={cn(
                          'group relative rounded-xl overflow-hidden border bg-zinc-950 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl hover:scale-[1.02] cv-auto',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-zinc-800/90 hover:border-primary/50'
                        )}
                      >
                        {/* Image Frame */}
                        <div className="relative w-full aspect-video bg-zinc-950 overflow-hidden">
                          <img
                            src={screenshot.dataUrl}
                            alt={screenshot.fileName}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          {/* Subtle Bottom Vignette for text readability */}
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

                          {/* Bottom info pill */}
                          <div className="absolute bottom-1.5 inset-x-2 flex items-center justify-between text-[10px] text-zinc-300 font-medium pointer-events-none">
                            <span className="truncate drop-shadow-md">
                              {formatTimeOnly(screenshot.createdAt) || screenshot.fileName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-black/60 backdrop-blur-sm text-zinc-300 text-[9px] font-semibold border border-white/10 shrink-0 ml-1.5">
                              {formatBytes(screenshot.sizeBytes)}
                            </span>
                          </div>

                          {/* Checkbox badge (Top Left) - always visible when selecting */}
                          <button
                            type="button"
                            onClick={(e) => toggleSelect(screenshot.id, e)}
                            className={cn(
                              'absolute top-2 left-2 h-7 w-7 rounded-lg flex items-center justify-center transition-all z-20 shadow-md',
                              isSelected
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary/40'
                                : selectedIds.size > 0
                                  ? 'bg-black/70 backdrop-blur-md text-white/70 hover:bg-black/90 hover:text-white border border-white/20'
                                  : 'bg-black/60 backdrop-blur-md text-white/70 hover:bg-black/90 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100'
                            )}
                            title={isSelected ? 'Bỏ chọn ảnh' : 'Chọn ảnh'}
                          >
                            {isSelected ? <Check size={13} strokeWidth={3} /> : <Square size={12} />}
                          </button>

                          {/* Hover Action Buttons (Top Right) */}
                          <div
                            className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveLightboxIndex(fullIndex)
                              }}
                              className="h-6.5 w-6.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-zinc-200 hover:text-primary hover:bg-black flex items-center justify-center shadow-md transition-colors"
                              title="Xem phóng to"
                            >
                              <Maximize2 size={11} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleCopy(screenshot)
                              }}
                              className="h-6.5 w-6.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-zinc-200 hover:text-primary hover:bg-black flex items-center justify-center shadow-md transition-colors"
                              title="Sao chép ảnh (Ctrl+C)"
                            >
                              <Copy size={11} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleShowInFolder(screenshot.filePath)
                              }}
                              className="h-6.5 w-6.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-zinc-200 hover:text-primary hover:bg-black flex items-center justify-center shadow-md transition-colors"
                              title="Mở trong Folder"
                            >
                              <FolderOpen size={11} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDelete(screenshot)
                              }}
                              className="h-6.5 w-6.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center shadow-md transition-colors"
                              title="Xóa ảnh"
                            >
                              <Trash2 size={11} />
                            </button>
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

      {/* ── Floating Screenshot Modal Popup ─────────────────────────────────── */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none"
          onClick={() => setActiveLightboxIndex(null)}
        >
          {/* Floating Dialog Card */}
          <div
            className="relative w-full max-w-5xl bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30 shrink-0">
                  <Camera size={14} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-zinc-100 truncate" title={activeScreenshot.fileName}>
                    {activeScreenshot.fileName}
                  </h3>
                  <p className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                    <span>{formatDateTime(activeScreenshot.createdAt)}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="font-semibold text-primary">{formatBytes(activeScreenshot.sizeBytes)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400 px-2.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                  {(activeLightboxIndex ?? 0) + 1} / {filteredScreenshots.length}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(activeScreenshot)}
                  disabled={isCopying}
                  className="h-7.5 px-2.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5 rounded-lg"
                  title="Sao chép ảnh (Ctrl+C)"
                >
                  {isCopying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} className="text-primary" />}
                  <span>Sao chép</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShowInFolder(activeScreenshot.filePath)}
                  className="h-7.5 px-2.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5 rounded-lg"
                  title="Mở trong File Explorer"
                >
                  <FolderOpen size={12} />
                  <span>Mở thư mục</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(activeScreenshot)}
                  className="h-7.5 px-2.5 text-xs bg-zinc-900 border-zinc-700 text-destructive hover:bg-destructive/20 hover:border-destructive/40 gap-1.5 rounded-lg"
                  title="Xóa ảnh này"
                >
                  <Trash2 size={12} />
                  <span>Xóa</span>
                </Button>

                <button
                  type="button"
                  onClick={() => setActiveLightboxIndex(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1.5"
                  title="Đóng (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / Image Stage */}
            <div className="relative flex-1 flex items-center justify-center p-4 bg-zinc-950/80 overflow-hidden min-h-[380px] max-h-[76vh]">
              {/* Previous Button */}
              {filteredScreenshots.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrev()
                  }}
                  className="absolute left-4 z-10 p-2 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-zinc-700/80 text-white transition-all hover:scale-105 shadow-xl backdrop-blur-md"
                  title="Ảnh trước (Mũi tên trái)"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* Preview Image */}
              <div className="max-h-full max-w-full flex items-center justify-center">
                <img
                  src={activeScreenshot.dataUrl}
                  alt={activeScreenshot.fileName}
                  className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-xl border border-zinc-800/80"
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
                  className="absolute right-4 z-10 p-2 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-zinc-700/80 text-white transition-all hover:scale-105 shadow-xl backdrop-blur-md"
                  title="Ảnh tiếp theo (Mũi tên phải)"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
