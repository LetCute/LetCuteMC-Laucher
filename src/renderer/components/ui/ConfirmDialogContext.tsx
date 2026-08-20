import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { Modal } from './Modal'
import { Button } from './button'

interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined)

export const useConfirm = () => {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  }
  return context.confirm
}

export const ConfirmDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmDialogOptions>({ message: '' })
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmDialogOptions | string) => {
    return new Promise<boolean>((resolve) => {
      setOptions(typeof opts === 'string' ? { message: opts } : opts)
      setResolvePromise(() => resolve)
      setIsOpen(true)
    })
  }, [])

  const handleConfirm = () => {
    setIsOpen(false)
    if (resolvePromise) resolvePromise(true)
  }

  const handleCancel = () => {
    setIsOpen(false)
    if (resolvePromise) resolvePromise(false)
  }

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title={options.title || 'Xác nhận'}
        maxWidth="max-w-[400px]"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {options.message}
          </p>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={handleCancel}>
              {options.cancelText || 'Hủy'}
            </Button>
            <Button
              onClick={handleConfirm}
              variant="outline"
              className={options.isDestructive ? 'border-destructive text-destructive hover:bg-destructive/10' : ''}
            >
              {options.confirmText || 'Đồng ý'}
            </Button>
          </div>
        </div>
      </Modal>
    </ConfirmDialogContext.Provider>
  )
}
