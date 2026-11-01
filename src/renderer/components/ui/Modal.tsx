import { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
  closable?: boolean
  overlay?: ReactNode
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-[760px]',
  closable = true,
  overlay,
}: ModalProps) => {
  if (!isOpen) return null

  const handleClose = () => {
    if (closable) {
      onClose()
    }
  }

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div
        className={`relative w-full ${maxWidth} bg-card border border-border rounded-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] z-10`}
        onClick={(e) => e.stopPropagation()}
      >
        {overlay}

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {description && (
              <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {closable && (
            <button
              onClick={handleClose}
              className="ml-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode
}
