import { useState, useEffect, createContext, useContext, useRef, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Info, XIcon, Copy, Check } from 'lucide-react'

export type ToastType = 'error' | 'success' | 'info'

export interface ToastOptions {
  title?: string
  duration?: number
  copyable?: boolean
}

export interface ToastItemData {
  id: string
  type: ToastType
  message: string
  title: string
  duration: number
  copyable: boolean
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([])
  // Deduplication map: message -> timestamp (2.5s anti-spam window)
  const recentHistoryRef = useRef<Map<string, number>>(new Map())

  const showToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    if (!message || typeof message !== 'string') return
    const cleanMessage = message.trim()
    if (!cleanMessage) return

    const now = Date.now()
    const lastTime = recentHistoryRef.current.get(cleanMessage)

    // Anti-spam debounce: discard identical messages within 2500ms
    if (lastTime && now - lastTime < 2500) {
      return
    }

    // Prune stale entries (> 10s) to keep map tiny
    if (recentHistoryRef.current.size > 20) {
      for (const [msg, ts] of recentHistoryRef.current.entries()) {
        if (now - ts > 10000) recentHistoryRef.current.delete(msg)
      }
    }
    recentHistoryRef.current.set(cleanMessage, now)

    // Auto-detect friendly title if not specified
    let defaultTitle = 'Thông báo'
    if (type === 'error') {
      if (cleanMessage.includes('[Mã thoát') || cleanMessage.includes('[CrashDiagnostic]')) {
        defaultTitle = 'Sự cố trò chơi'
      } else {
        defaultTitle = 'Đã xảy ra lỗi'
      }
    } else if (type === 'success') {
      defaultTitle = 'Thành công'
    }

    const title = options?.title || defaultTitle
    const duration = options?.duration || (type === 'error' ? 6500 : 3500)
    const copyable = options?.copyable ?? (type === 'error' || cleanMessage.length > 60)

    const id = crypto.randomUUID()
    const newToast: ToastItemData = {
      id,
      type,
      message: cleanMessage,
      title,
      duration,
      copyable,
    }

    setToasts((prev) => {
      // Discard older duplicate if currently visible
      const filtered = prev.filter((t) => t.message !== cleanMessage)
      // Keep maximum 3 toasts visible simultaneously to prevent layout flood
      const trimmed = filtered.length >= 3 ? filtered.slice(filtered.length - 2) : filtered
      return [...trimmed, newToast]
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none flex flex-col gap-2.5 w-[400px] max-w-[calc(100vw-2.5rem)]">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: ToastItemData; onClose: () => void }) {
  const [isPaused, setIsPaused] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const remainingRef = useRef(toast.duration)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    if (isPaused) return

    startTimeRef.current = Date.now()
    const timer = setTimeout(() => {
      onClose()
    }, remainingRef.current)

    return () => {
      clearTimeout(timer)
      remainingRef.current = Math.max(500, remainingRef.current - (Date.now() - startTimeRef.current))
    }
  }, [isPaused, onClose])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(`${toast.title}\n${toast.message}`)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Ignore clipboard write failure
    }
  }

  const icons = {
    error: <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
    info: <Info className="h-4 w-4 text-sky-400 shrink-0" />,
  }

  const containerStyles = {
    error: 'border-rose-500/30 bg-gradient-to-br from-rose-950/80 via-zinc-950/95 to-zinc-950/95 text-zinc-100 shadow-[0_12px_36px_rgba(244,63,94,0.18)]',
    success: 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-zinc-950/95 to-zinc-950/95 text-zinc-100 shadow-[0_12px_36px_rgba(16,185,129,0.18)]',
    info: 'border-sky-500/30 bg-gradient-to-br from-sky-950/80 via-zinc-950/95 to-zinc-950/95 text-zinc-100 shadow-[0_12px_36px_rgba(14,165,233,0.18)]',
  }

  const iconBgStyles = {
    error: 'bg-rose-500/15 border-rose-500/30',
    success: 'bg-emerald-500/15 border-emerald-500/30',
    info: 'bg-sky-500/15 border-sky-500/30',
  }

  const titleStyles = {
    error: 'text-rose-300',
    success: 'text-emerald-300',
    info: 'text-sky-300',
  }

  const progressBgStyles = {
    error: 'bg-rose-500/50',
    success: 'bg-emerald-500/50',
    info: 'bg-sky-500/50',
  }

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-3',
        containerStyles[toast.type]
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon Badge */}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border mt-0.5 shadow-inner',
            iconBgStyles[toast.type]
          )}
        >
          {icons[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn('text-xs font-semibold tracking-wide', titleStyles[toast.type])}>
              {toast.title}
            </h4>
          </div>

          <p className="mt-1 text-xs leading-relaxed text-zinc-300/90 whitespace-pre-line break-words max-h-36 overflow-y-auto select-text scrollbar-thin">
            {toast.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-1">
          {toast.copyable && (
            <button
              onClick={handleCopy}
              title={isCopied ? 'Đã sao chép!' : 'Sao chép thông báo'}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={onClose}
            title="Đóng"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 overflow-hidden">
        <div
          className={cn('h-full transition-all ease-linear', progressBgStyles[toast.type])}
          style={{
            animation: `shrinkWidth ${toast.duration}ms linear forwards`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  )
}