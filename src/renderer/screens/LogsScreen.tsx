import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText,
  Search,
  RefreshCw,
  FolderOpen,
  Copy,
  Trash2,
  Check,
  Loader2,
  Share2,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  ChevronDown,
  ArrowDown,
  Sparkles,
  FileArchive,
} from 'lucide-react'
import type { LogFileInfo, LogDiagnosisItem, ParsedLogLine, LogLevel } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/Input'
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

interface LogsScreenProps {
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

// Chẩn đoán thông minh từ nội dung log
function analyzeLogContent(rawContent: string): LogDiagnosisItem[] {
  const issues: LogDiagnosisItem[] = []

  // 1. Tràn RAM (OutOfMemory)
  if (
    rawContent.includes('java.lang.OutOfMemoryError') ||
    rawContent.includes('Java heap space') ||
    rawContent.includes('There is insufficient memory for the Java Runtime Environment')
  ) {
    issues.push({
      type: 'danger',
      title: 'Lỗi tràn bộ nhớ (Out of Memory)',
      description:
        'Minecraft đã sử dụng hết lượng RAM được cấp phát và bị hệ thống cưỡng chế dừng hoạt động.',
      suggestion:
        'Hãy vào mục "Cài đặt" hoặc "Cấu hình game", tăng mức RAM tối đa (Max RAM) lên ít nhất 4GB - 8GB phù hợp với gói modpack của bạn.',
    })
  }

  // 2. Không tương thích phiên bản Java
  if (
    rawContent.includes('UnsupportedClassVersionError') ||
    rawContent.includes('has been compiled by a more recent version of the Java Runtime')
  ) {
    issues.push({
      type: 'danger',
      title: 'Không tương thích phiên bản Java Runtime',
      description:
        'Game hoặc một số Mod yêu cầu phiên bản Java mới hơn (ví dụ Java 17 hoặc Java 21) so với phiên bản Java đang chạy.',
      suggestion:
        'Hãy vào mục "Cấu hình game" -> "Đổi phiên bản Java" và chọn Java 17 (cho 1.18 - 1.20.4) hoặc Java 21 (cho 1.20.5+).',
    })
  }

  // 3. Thiếu Fabric API / Quilt API / Forge dependencies
  if (
    rawContent.includes('Requires:') ||
    rawContent.includes('requires fabric') ||
    rawContent.includes('Mod resolution failed') ||
    rawContent.includes('Could not find required mod')
  ) {
    issues.push({
      type: 'warning',
      title: 'Thiếu Mod phụ thuộc (Missing Dependencies)',
      description:
        'Một hoặc nhiều Mod bạn cài đặt yêu cầu thư viện hoặc mod bổ trợ (như Fabric API, Architectury, Cloth Config) để có thể khởi động.',
      suggestion:
        'Vào Tab "Mods", hệ thống sẽ tự động quét và cung cấp nút "Tự động sửa Mod" để cài đặt đủ các mod còn thiếu.',
    })
  }

  // 4. Lỗi xung đột Mixin (Mixin Apply Failed)
  if (rawContent.includes('org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError') || rawContent.includes('Mixin apply failed')) {
    issues.push({
      type: 'danger',
      title: 'Xung đột can thiệp mã nguồn (Mixin Conflict)',
      description:
        'Có hai hoặc nhiều mod can thiệp vào cùng một đoạn mã game Minecraft dẫn đến xung đột không thể tải.',
      suggestion:
        'Hãy thử tạm tắt (Disable) các mod vừa mới thêm gần đây nhất để tìm ra mod xung đột.',
    })
  }

  // 5. Lỗi Driver Card đồ họa (OpenGL / GLFW)
  if (
    rawContent.includes('GLFW error 65542') ||
    rawContent.includes('WGL: The driver does not appear to support OpenGL') ||
    rawContent.includes('Pixel format not accelerated')
  ) {
    issues.push({
      type: 'danger',
      title: 'Lỗi Card màn hình / OpenGL (GLFW 65542)',
      description:
        'Driver đồ họa máy tính của bạn không hỗ trợ phiên bản OpenGL yêu cầu của Minecraft.',
      suggestion:
        'Hãy cập nhật Driver Card màn hình (NVIDIA, AMD hoặc Intel Graphics) lên phiên bản mới nhất từ trang chủ nhà sản xuất.',
    })
  }

  return issues
}

// Phân tích từng dòng log
function parseLogLines(rawText: string): ParsedLogLine[] {
  if (!rawText) return []
  const lines = rawText.split(/\r?\n/)
  const parsed: ParsedLogLine[] = []

  // Chuẩn Regex: [HH:mm:ss] [thread/LEVEL] [logger]: message
  const logRegex = /^\[(\d{2}:\d{2}:\d{2})\]\s*\[([^/]+)\/([A-Z]+)\]\s*(?:\[([^\]]+)\])?:\s*(.*)$/

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue

    const match = raw.match(logRegex)
    if (match) {
      const [, timestamp, thread, levelRaw, logger, message] = match
      let level: ParsedLogLine['level'] = 'UNKNOWN'

      if (levelRaw === 'INFO') level = 'INFO'
      else if (levelRaw === 'WARN') level = 'WARN'
      else if (levelRaw === 'ERROR') level = 'ERROR'
      else if (levelRaw === 'FATAL') level = 'FATAL'
      else if (levelRaw === 'DEBUG') level = 'DEBUG'

      parsed.push({
        id: i + 1,
        raw,
        timestamp,
        thread,
        level,
        logger,
        message,
      })
    } else {
      // Dòng phụ / Stack Trace
      let level: ParsedLogLine['level'] = 'UNKNOWN'
      if (raw.includes('ERROR') || raw.includes('Exception') || raw.includes('Error') || raw.startsWith('\tat ')) {
        level = 'ERROR'
      } else if (raw.includes('WARN')) {
        level = 'WARN'
      }

      parsed.push({
        id: i + 1,
        raw,
        level,
        message: raw,
      })
    }
  }

  return parsed
}

export function LogsScreen({ gameDir, profileName }: LogsScreenProps) {
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [activeLogs, setActiveLogs] = useState<LogFileInfo[]>([])
  const [crashReports, setCrashReports] = useState<LogFileInfo[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)

  // Selected file
  const [selectedFile, setSelectedFile] = useState<LogFileInfo | null>(null)
  const [rawLogContent, setRawLogContent] = useState<string>('')
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('ALL')
  const [autoScroll, setAutoScroll] = useState(false)

  // Active Category: 'latest' | 'crashes' | 'history'
  const [activeCategory, setActiveCategory] = useState<'latest' | 'crashes' | 'history'>('latest')

  // Upload modal state
  const [isUploading, setIsUploading] = useState(false)
  const [mclogsResult, setMclogsResult] = useState<{ url: string; id: string } | null>(null)

  const consoleEndRef = useRef<HTMLDivElement>(null)

  // 1. Tải danh sách tệp log & crash
  const loadFiles = async () => {
    setIsLoadingFiles(true)
    try {
      const res = await launcherClient.listLogFiles(gameDir)
      setActiveLogs(res.activeLogs)
      setCrashReports(res.crashReports)

      // Mặc định chọn latest.log hoặc tệp đầu tiên
      const latest = res.activeLogs.find((l) => l.fileName === 'latest.log') || res.activeLogs[0]
      if (latest) {
        setSelectedFile(latest)
      } else if (res.crashReports[0]) {
        setSelectedFile(res.crashReports[0])
      }
    } catch (e: any) {
      console.error('Error loading log files:', e)
      showToast('error', `Không thể tải danh sách tệp log: ${e?.message || e}`)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  useEffect(() => {
    void loadFiles()
  }, [gameDir])

  // 2. Đọc nội dung file đã chọn
  useEffect(() => {
    if (!selectedFile) {
      setRawLogContent('')
      return
    }

    let isMounted = true
    setIsLoadingContent(true)

    launcherClient
      .readLogFile(selectedFile.filePath)
      .then((content) => {
        if (isMounted) {
          setRawLogContent(content)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setRawLogContent(`[Lỗi] Không thể đọc nội dung tệp: ${err?.message || err}`)
          showToast('error', `Lỗi đọc tệp log: ${err?.message || err}`)
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingContent(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedFile])

  // 3. Phân tích chẩn đoán thông minh
  const diagnoses = useMemo(() => {
    return analyzeLogContent(rawLogContent)
  }, [rawLogContent])

  // 4. Phân tích các dòng log
  const parsedLines = useMemo(() => {
    return parseLogLines(rawLogContent)
  }, [rawLogContent])

  // 5. Lọc các dòng log
  const filteredLines = useMemo(() => {
    return parsedLines.filter((line) => {
      // Lọc Level
      if (selectedLevel !== 'ALL' && line.level !== selectedLevel && line.level !== 'UNKNOWN') {
        return false
      }

      // Lọc Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        return line.raw.toLowerCase().includes(query)
      }

      return true
    })
  }, [parsedLines, selectedLevel, searchQuery])

  // Tự động cuộn xuống cuối khi có log mới
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredLines, autoScroll])

  // Thống kê lỗi trong file hiện tại
  const stats = useMemo(() => {
    let errorCount = 0
    let warnCount = 0
    for (const l of parsedLines) {
      if (l.level === 'ERROR' || l.level === 'FATAL') errorCount++
      else if (l.level === 'WARN') warnCount++
    }
    return { errorCount, warnCount, total: parsedLines.length }
  }, [parsedLines])

  // Sao chép toàn bộ log vào Clipboard
  const handleCopyAll = async () => {
    if (!rawLogContent) return
    try {
      await navigator.clipboard.writeText(rawLogContent)
      showToast('success', 'Đã sao chép toàn bộ nội dung Log vào Clipboard!')
    } catch (e: any) {
      showToast('error', `Lỗi sao chép: ${e?.message || e}`)
    }
  }

  // Tải lên mclo.gs
  const handleUploadMclogs = async () => {
    if (!rawLogContent.trim()) {
      showToast('info', 'Nội dung log trống, không thể tải lên.')
      return
    }

    setIsUploading(true)
    try {
      const res = await launcherClient.uploadLogToMclogs(rawLogContent)
      if (res.success && res.url && res.id) {
        setMclogsResult({ url: res.url, id: res.id })
        showToast('success', 'Đã tải log lên mclo.gs thành công!')
      } else {
        showToast('error', res.error || 'Tải lên mclo.gs thất bại')
      }
    } catch (e: any) {
      showToast('error', `Lỗi tải lên: ${e?.message || e}`)
    } finally {
      setIsUploading(false)
    }
  }

  // Mở thư mục logs trong Explorer
  const handleOpenFolder = (type: 'logs' | 'crash-reports' = 'logs') => {
    void launcherClient.openLogsFolder(gameDir, type)
  }

  // Dọn dẹp logs cũ
  const handleClearOldLogs = async () => {
    const isConfirmed = await confirm({
      title: 'Dọn dẹp logs cũ',
      message: 'Bạn có chắc chắn muốn xóa tất cả các tệp lịch sử log nén (.log.gz) cũ để giải phóng dung lượng?',
      isDestructive: true,
    })

    if (!isConfirmed) return

    try {
      const res = await launcherClient.clearOldLogs(gameDir)
      if (res.success) {
        showToast('success', `Đã xóa ${res.count} tệp log cũ, giải phóng ${formatBytes(res.freedBytes)}!`)
        await loadFiles()
      }
    } catch (e: any) {
      showToast('error', `Lỗi dọn dẹp: ${e?.message || e}`)
    }
  }

  // Xóa 1 tệp log
  const handleDeleteCurrentFile = async () => {
    if (!selectedFile) return

    const isConfirmed = await confirm({
      title: 'Xóa tệp log',
      message: `Bạn có chắc chắn muốn xóa tệp "${selectedFile.fileName}" không?`,
      isDestructive: true,
    })

    if (!isConfirmed) return

    try {
      const ok = await launcherClient.deleteLogFile(selectedFile.filePath)
      if (ok) {
        showToast('success', `Đã xóa "${selectedFile.fileName}"`)
        await loadFiles()
      }
    } catch (e: any) {
      showToast('error', `Xóa tệp thất bại: ${e?.message || e}`)
    }
  }

  // Lọc danh sách tệp theo danh mục đang chọn
  const historyLogs = activeLogs.filter((l) => l.fileName.endsWith('.gz') || l.fileName !== 'latest.log')
  const latestLog = activeLogs.find((l) => l.fileName === 'latest.log')

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col h-full gap-4 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-foreground tracking-tight whitespace-nowrap">
              Nhật ký & Phân tích Lỗi
            </h2>
            {profileName && (
              <span className="text-xs font-medium text-zinc-300 px-2.5 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg truncate max-w-xs">
                Cấu hình: <strong className="text-primary font-semibold">{profileName}</strong>
              </span>
            )}
            {selectedFile && (
              <span className="text-xs font-mono text-zinc-400 px-2.5 py-1 bg-zinc-900/90 border border-zinc-800 rounded-lg flex items-center gap-1.5">
                <FileText size={12} className="text-primary" />
                <span className="text-zinc-200 font-semibold">{selectedFile.fileName}</span>
                <span className="text-zinc-500">({formatBytes(selectedFile.sizeBytes)})</span>
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2.5 whitespace-nowrap">
            <span className="whitespace-nowrap">Tổng: <strong className="text-zinc-200 font-semibold">{stats.total}</strong> dòng</span>
            {stats.errorCount > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-red-400 font-semibold flex items-center gap-1 whitespace-nowrap">
                  <AlertOctagon size={12} /> {stats.errorCount} lỗi (Error)
                </span>
              </>
            )}
            {stats.warnCount > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-amber-400 font-medium flex items-center gap-1 whitespace-nowrap">
                  <AlertTriangle size={12} /> {stats.warnCount} cảnh báo (Warn)
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 1-Click Upload to mclo.gs */}
          <Button
            onClick={handleUploadMclogs}
            disabled={isUploading || !rawLogContent.trim()}
            variant="primary"
            size="sm"
            className="h-9 px-3.5 shadow-sm font-semibold text-xs gap-1.5"
            title="Đăng tải log lên dịch vụ mclo.gs để nhận link chia sẻ"
          >
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            <span>Đăng lên mclo.gs</span>
          </Button>

          {/* Copy Log */}
          <Button
            onClick={handleCopyAll}
            disabled={!rawLogContent}
            variant="outline"
            size="sm"
            className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs"
            title="Sao chép toàn bộ nội dung log"
          >
            <Copy size={13} className="mr-1.5" />
            Sao chép
          </Button>

          {/* Open Folder Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
                title="Mở thư mục lưu trữ trong Explorer"
              >
                <FolderOpen size={14} />
                <span>Thư mục</span>
                <ChevronDown size={12} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-900/95 border-zinc-700/60 rounded-2xl backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50">
              <DropdownMenuItem
                onClick={() => handleOpenFolder('logs')}
                className="cursor-pointer text-xs py-2 px-2.5 gap-2 text-zinc-200 hover:bg-zinc-800/90 hover:text-white rounded-xl"
              >
                <FolderOpen size={13} />
                <span>Thư mục logs/</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleOpenFolder('crash-reports')}
                className="cursor-pointer text-xs py-2 px-2.5 gap-2 text-zinc-200 hover:bg-zinc-800/90 hover:text-white rounded-xl"
              >
                <AlertOctagon size={13} className="text-red-400" />
                <span>Thư mục crash-reports/</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800 my-1" />
              <DropdownMenuItem
                onClick={handleClearOldLogs}
                className="cursor-pointer text-xs py-2 px-2.5 gap-2 text-amber-400 hover:bg-zinc-800/90 rounded-xl"
              >
                <Trash2 size={13} />
                <span>Dọn dẹp log cũ (.gz)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh */}
          <Button
            onClick={loadFiles}
            disabled={isLoadingFiles}
            variant="outline"
            size="sm"
            className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs"
            title="Làm mới log"
          >
            <RefreshCw size={13} className={cn(isLoadingFiles && 'animate-spin', 'mr-1.5')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Category Pills & File Selection */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Category Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
          {/* latest.log button */}
          <button
            onClick={() => {
              setActiveCategory('latest')
              if (latestLog) setSelectedFile(latestLog)
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              activeCategory === 'latest'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <FileText size={13} />
            <span>latest.log (Mới nhất)</span>
          </button>

          {/* Crash Reports button */}
          <button
            onClick={() => {
              setActiveCategory('crashes')
              if (crashReports[0]) setSelectedFile(crashReports[0])
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              activeCategory === 'crashes'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <AlertOctagon size={13} className={crashReports.length > 0 ? 'text-red-400' : ''} />
            <span>Báo cáo Lỗi</span>
            {crashReports.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white">
                {crashReports.length}
              </span>
            )}
          </button>

          {/* Historical Logs button */}
          <button
            onClick={() => {
              setActiveCategory('history')
              if (historyLogs[0]) setSelectedFile(historyLogs[0])
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              activeCategory === 'history'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <FileArchive size={13} />
            <span>Lịch sử ({historyLogs.length})</span>
          </button>
        </div>

        {/* Specific File Selector Dropdown (for Crashes or History) */}
        {(activeCategory === 'crashes' || activeCategory === 'history') && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Chọn tệp:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 bg-zinc-900/90 border-zinc-700/70 text-zinc-200 hover:text-white text-xs gap-1.5 rounded-xl max-w-xs truncate"
                >
                  <span className="truncate">{selectedFile?.fileName || 'Chọn tệp...'}</span>
                  <ChevronDown size={12} className="text-zinc-400 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto bg-zinc-900/95 border-zinc-700/60 rounded-2xl backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50">
                <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 px-3 py-1.5">
                  {activeCategory === 'crashes' ? 'Danh sách Crash Reports' : 'Danh sách tệp log cũ'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                {(activeCategory === 'crashes' ? crashReports : historyLogs).map((file) => {
                  const isSelected = selectedFile?.id === file.id
                  return (
                    <DropdownMenuItem
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-xs rounded-xl cursor-pointer transition-all',
                        isSelected
                          ? 'bg-primary/20 text-white font-semibold border border-primary/30'
                          : 'text-zinc-200 hover:bg-zinc-800/90 hover:text-white'
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-mono">{file.fileName}</p>
                        <p className="text-[10px] text-zinc-500">{formatDateTime(file.createdAt)}</p>
                      </div>
                      {isSelected && <Check size={13} className="text-primary shrink-0" />}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedFile && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleDeleteCurrentFile}
                className="h-8 w-8 bg-zinc-900 border-zinc-700 text-destructive hover:bg-destructive/10"
                title="Xóa tệp này"
              >
                <Trash2 size={13} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Smart Crash Diagnosis Alert Box (if detected) */}
      {diagnoses.length > 0 && (
        <div className="flex flex-col gap-2.5 animate-in fade-in">
          {diagnoses.map((diag, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3.5 p-3.5 rounded-2xl border shadow-lg backdrop-blur-md',
                diag.type === 'danger'
                  ? 'bg-red-950/40 border-red-800/60 text-red-200'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-md',
                  diag.type === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                )}
              >
                {diag.type === 'danger' ? <AlertOctagon size={18} /> : <AlertTriangle size={18} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {diag.title}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-zinc-300">
                    Phát hiện tự động
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{diag.description}</p>
                {diag.suggestion && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex items-start gap-1.5 text-xs text-white">
                    <Sparkles size={13} className="text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong>Hướng khắc phục:</strong> {diag.suggestion}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Level Filter Bar */}
      <div className="flex gap-2.5 items-center">
        {/* Search Field */}
        <div className="flex-1 min-w-[200px]">
          <Input
            className="bg-zinc-900/90 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-primary/60 h-9 rounded-xl text-xs"
            type="text"
            placeholder="Tìm kiếm trong log (Exception, Missing, Mod, Player...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4 text-zinc-400" />}
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-xl p-0.5 h-9 shrink-0 gap-0.5">
          {(['ALL', 'INFO', 'WARN', 'ERROR', 'FATAL'] as LogLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={cn(
                'px-2.5 h-full rounded-lg text-xs font-medium transition-all',
                selectedLevel === lvl
                  ? lvl === 'ERROR' || lvl === 'FATAL'
                    ? 'bg-red-500/20 text-red-400 font-bold'
                    : lvl === 'WARN'
                    ? 'bg-amber-500/20 text-amber-400 font-bold'
                    : 'bg-primary/20 text-primary font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {lvl === 'ALL' ? 'Tất cả' : lvl}
            </button>
          ))}
        </div>

        {/* Auto Scroll Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoScroll((prev) => !prev)}
          className={cn(
            'h-9 px-3 text-xs gap-1.5 rounded-xl shrink-0 transition-all border-zinc-700/70 shadow-sm',
            autoScroll
              ? 'bg-primary/20 text-primary border-primary/40 font-semibold'
              : 'bg-zinc-900/80 text-zinc-300 hover:text-white'
          )}
          title="Tự động cuộn xuống dòng mới nhất khi chơi game"
        >
          <ArrowDown size={13} className={cn(autoScroll && 'animate-bounce text-primary')} />
          <span>Cuộn tự động</span>
        </Button>
      </div>

      {/* Terminal Log Console */}
      <div className="flex-1 min-h-0 relative flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/85 transition-all shadow-md overflow-hidden">
        {isLoadingContent ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Đang tải nội dung tệp log...</p>
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/40 border border-zinc-700/40 text-zinc-400">
              <FileText size={32} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {searchQuery || selectedLevel !== 'ALL'
                  ? 'Không tìm thấy dòng log phù hợp'
                  : 'Tệp log trống hoặc chưa có dữ liệu'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                {searchQuery || selectedLevel !== 'ALL'
                  ? 'Hãy thử tìm kiếm từ khóa khác hoặc chuyển sang "Tất cả".'
                  : 'Hãy khởi động game Minecraft để ghi nhật ký hoạt động.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed select-text">
            {filteredLines.map((line) => {
              const isError = line.level === 'ERROR' || line.level === 'FATAL'
              const isWarn = line.level === 'WARN'
              const isInfo = line.level === 'INFO'

              return (
                <div
                  key={line.id}
                  className={cn(
                    'flex items-start gap-2.5 py-0.5 px-2 rounded-lg hover:bg-zinc-800/70 transition-colors',
                    isError && 'bg-red-950/25 text-red-300 font-medium',
                    isWarn && 'bg-amber-950/20 text-amber-200',
                    line.level === 'UNKNOWN' && line.raw.startsWith('\tat ') && 'text-red-400/80 pl-6'
                  )}
                >
                  {/* Line Number */}
                  <span className="text-zinc-500 select-none text-right w-10 shrink-0 font-mono text-[10px]">
                    {line.id}
                  </span>

                  {/* Timestamp */}
                  {line.timestamp && (
                    <span className="text-zinc-400 select-none shrink-0">[{line.timestamp}]</span>
                  )}

                  {/* Level Badge */}
                  {line.level !== 'UNKNOWN' && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 tracking-wider',
                        isError && 'bg-red-500/20 text-red-400 border border-red-500/30',
                        isWarn && 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                        isInfo && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
                        line.level === 'DEBUG' && 'bg-zinc-800 text-zinc-400'
                      )}
                    >
                      {line.level}
                    </span>
                  )}

                  {/* Logger */}
                  {line.logger && (
                    <span className="text-cyan-400/90 font-medium shrink-0">[{line.logger}]</span>
                  )}

                  {/* Message */}
                  <span
                    className={cn(
                      'flex-1 break-all whitespace-pre-wrap',
                      !isError && !isWarn && 'text-zinc-200'
                    )}
                  >
                    {line.message}
                  </span>
                </div>
              )
            })}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>

      {/* mclo.gs Share Result Modal */}
      <Modal
        isOpen={Boolean(mclogsResult)}
        onClose={() => setMclogsResult(null)}
        title="Đã tạo liên kết chia sẻ mclo.gs"
        description="Nhật ký game của bạn đã được tải lên mclo.gs và tự động loại bỏ các thông tin nhạy cảm."
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (mclogsResult) {
                    void launcherClient.openExternal(mclogsResult.url)
                  }
                }}
                className="text-xs font-semibold gap-1.5 shadow-sm"
              >
                <ExternalLink size={13} />
                Mở trên trình duyệt
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (mclogsResult) {
                    void navigator.clipboard.writeText(mclogsResult.url)
                    showToast('success', 'Đã sao chép liên kết vào Clipboard!')
                  }
                }}
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5"
              >
                <Copy size={13} />
                Sao chép Link
              </Button>
            </div>

            <Button variant="outline" onClick={() => setMclogsResult(null)} className="bg-zinc-900 border-zinc-800">
              Đóng
            </Button>
          </div>
        }
      >
        {mclogsResult && (
          <div className="space-y-4 py-2">
            <div
              onClick={() => {
                if (mclogsResult) void launcherClient.openExternal(mclogsResult.url)
              }}
              className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-primary/50 hover:bg-zinc-900 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
              title="Nhấn để mở trên trình duyệt web"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Đường dẫn xem trực tuyến:</p>
                <p className="text-sm font-bold text-primary truncate font-mono mt-0.5 group-hover:underline">
                  {mclogsResult.url}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void launcherClient.openExternal(mclogsResult.url)
                }}
                className="p-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-primary hover:text-primary-foreground transition-all shrink-0 shadow-sm"
                title="Mở trong trình duyệt web ngoài"
              >
                <ExternalLink size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Bạn có thể gửi liên kết này trên <strong>Discord Server</strong> hoặc gửi cho đội ngũ hỗ trợ để được phân tích nguyên nhân lỗi chính xác nhất!
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
