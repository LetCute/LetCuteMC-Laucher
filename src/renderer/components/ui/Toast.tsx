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
  // Cooldown tracker for recently dismissed or shown toasts (anti-spam window: 1.5s)
  const lastShownRef = useRef<{ message: string; time: number } | null>(null)

  const showToast = useCallback((type: ToastType, message: string) => {
    const now = Date.now()
    if (lastShownRef.current && lastShownRef.current.message === message && now - lastShownRef.current.time < 1500) {
      return // Ignore duplicate toast within 1.5s
    }
    lastShownRef.current = { message, time: now }

    const id = crypto.randomUUID()
    setToasts(prev => {
      // If there is already a toast of same message, don't add duplicate
      if (prev.some(t => t.message === message)) {
        return prev
      }
      // Replace existing toast or keep max 1 single toast to prevent stacking spam
      return [{ id, type, message }]
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
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

function ToastItem({ toast, onClose }: { toast: Toast; index: number; total: number; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3200)
    return () => clearTimeout(timer)
  }, [onClose])

  const icons = {
    error: <AlertCircle className="h-4 w-4 text-white shrink-0" />,
    success: <CheckCircle className="h-4 w-4 text-white shrink-0" />,
    info: <Info className="h-4 w-4 text-white shrink-0" />,
  }

  const bgColors = {
    error: 'bg-rose-600/95 border-rose-500 text-white',
    success: 'bg-emerald-600/95 border-emerald-500 text-white',
    info: 'bg-sky-600/95 border-sky-500 text-white',
  }

  return (
    <div
      className={cn(
        'w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-2xl backdrop-blur-md pointer-events-auto transition-all duration-200 animate-in fade-in slide-in-from-bottom-2',
        bgColors[toast.type]
      )}
    >
      {icons[toast.type]}
      <p className="flex-1 text-xs font-semibold leading-snug truncate">{toast.message}</p>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition-opacity p-0.5"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}