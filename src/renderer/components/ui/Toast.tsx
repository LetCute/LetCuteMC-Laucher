import { useState, useEffect, createContext, useContext, useRef, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Info, XIcon } from 'lucide-react'

export type ToastType = 'error' | 'success' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Cooldown tracker for recently dismissed or shown toasts (anti-spam window: 3s)
  const dismissedHistoryRef = useRef<Map<string, number>>(new Map())

  const showToast = useCallback((type: ToastType, message: string) => {
    const now = Date.now()
    const lastSeen = dismissedHistoryRef.current.get(message)
    if (lastSeen && now - lastSeen < 3000) {
      return // Ignore spam if closed/seen within last 3 seconds
    }

    const id = crypto.randomUUID()
    setToasts(prev => {
      // Prevent duplicate active messages
      if (prev.some(t => t.message === message)) {
        return prev
      }
      // Limit to 3 max toasts
      return [...prev, { id, type, message }].slice(-3)
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => {
      const target = prev.find(t => t.id === id)
      if (target) {
        dismissedHistoryRef.current.set(target.message, Date.now())
      }
      return prev.filter(t => t.id !== id)
    })
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] pointer-events-none w-[320px]">
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            total={toasts.length}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, index, total, onClose }: { toast: Toast; index: number; total: number; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  const icons = {
    error: <AlertCircle className="h-5 w-5 text-destructive" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    info: <Info className="h-5 w-5 text-blue-400" />,
  }

  const bgColors = {
    error: 'bg-destructive/90 border-destructive text-destructive-foreground',
    success: 'bg-green-600/90 border-green-600 text-white',
    info: 'bg-blue-600/90 border-blue-600 text-white',
  }

  const offset = total - 1 - index;

  return (
    <div
      className={cn(
        'absolute bottom-0 right-0 w-full flex items-center gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur-md pointer-events-auto transition-all duration-300 ease-out',
        bgColors[toast.type]
      )}
      style={{
        transform: `translateY(-${offset * 16}px) scale(${1 - offset * 0.05})`,
        zIndex: 100 - offset,
        opacity: offset > 2 ? 0 : 1 - offset * 0.15,
      }}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition-opacity"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  )
}