import { useEffect, useRef, useCallback } from 'react'
import { Copy, Download, Trash2, TerminalSquare } from 'lucide-react'
import type { LauncherLog } from '../../shared/types'
import { Button } from '../components/ui/button'

interface LogsScreenProps {
  logs: LauncherLog[]
  onClear: () => void
  onCopy: () => void
  onExport: () => void
}

const LEVEL_CONFIG = {
  info: { cls: 'text-foreground/80', badge: 'text-muted-foreground' },
  success: { cls: 'text-emerald-300', badge: 'text-emerald-300 font-semibold' },
  warn: { cls: 'text-amber-300', badge: 'text-amber-300 font-semibold' },
  error: { cls: 'text-red-300', badge: 'text-red-300 font-semibold' },
  debug: { cls: 'text-foreground/40', badge: 'text-muted-foreground/60 text-[10px]' },
} as const

export const LogsScreen = ({ logs, onClear, onCopy, onExport }: LogsScreenProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const atBottomRef = useRef(true)

  // Track if user scrolled away from bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = distFromBottom < 40
  }, [])

  // Auto-scroll with requestAnimationFrame debounce (no layout thrash)
  useEffect(() => {
    if (!atBottomRef.current) return

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })

    return () => cancelAnimationFrame(rafRef.current)
  }, [logs.length])

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour12: false })
    } catch {
      return isoString
    }
  }

  const handleCopy = useCallback(() => {
    const text = logs
      .map(l => `[${formatTime(l.createdAt)}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n')
    void navigator.clipboard.writeText(text)
    onCopy()
  }, [logs, onCopy])

  const handleExport = useCallback(() => {
    const text = logs
      .map(l => `[${l.createdAt}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `letcutemc-log-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    onExport()
  }, [logs, onExport])

  return (
    <div className="px-6 pt-2 pb-6 flex flex-col h-full max-w-5xl mx-auto w-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50">
            <TerminalSquare className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground/80">Nhật ký hoạt động</h2>
            <p className="text-xs text-muted-foreground">{logs.length} dòng log</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className='bg-card'

          >
            <Copy className="h-3.5 w-3.5" />
            Sao chép
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className='bg-card'
          >
            <Download className="h-3.5 w-3.5" />
            Xuất file
          </Button>
          <Button
            onClick={onClear}
            variant="danger"
            size="sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa sạch
          </Button>
        </div>
      </div>

      {/* Terminal panel */}
      <div className="flex-1 rounded-2xl border border-border overflow-hidden flex flex-col bg-card">
        {/* Terminal titlebar */}
        <div className="px-4 py-2.5 border-b border-border bg-card flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-amber-500/60" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-xs text-muted-foreground ml-2 font-mono">letcutemc_log</span>
        </div>

        {/* Log output */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 font-mono text-[12.5px] leading-relaxed select-text"
        >
          {logs.length > 0 ? (
            <div className="space-y-0.5">
              {logs.map(log => {
                const cfg = LEVEL_CONFIG[log.level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.info
                return (
                  <div
                    key={log.id}
                    className="flex gap-3 hover:bg-white/3 py-0.5 px-2 rounded -mx-2 group"
                  >
                    <span className="text-muted-foreground/60 shrink-0 select-none">
                      {formatTime(log.createdAt)}
                    </span>
                    <span className={`shrink-0 w-14 ${cfg.badge}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className={`break-words whitespace-pre-wrap flex-1 ${cfg.cls}`}>
                      {log.message}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm italic">
              Không có nhật ký nào để hiển thị...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
