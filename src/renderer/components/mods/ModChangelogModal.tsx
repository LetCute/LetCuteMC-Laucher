import { createPortal } from 'react-dom'
import { X, ArrowUpCircle, Calendar, HardDrive, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '../ui/button'
import type { ModUpdateItem } from '@/shared/types'

interface ModChangelogModalProps {
  updateItem: ModUpdateItem | null
  onClose: () => void
  onUpdate: (item: ModUpdateItem) => void
  isUpdating: boolean
}

export const ModChangelogModal = ({
  updateItem,
  onClose,
  onUpdate,
  isUpdating,
}: ModChangelogModalProps) => {
  if (!updateItem) return null

  const sizeMb = (updateItem.newFileSize / (1024 * 1024)).toFixed(2)
  const formattedDate = new Date(updateItem.releaseDate).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const modalNode = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg rounded-md border border-zinc-800/90 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950/60">
          <div className="flex items-center gap-3 min-w-0">
            {updateItem.projectIconUrl ? (
              <img
                src={updateItem.projectIconUrl}
                alt={updateItem.modName}
                className="h-10 w-10 rounded-md object-contain bg-zinc-900 border border-zinc-800 shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                <ArrowUpCircle size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">{updateItem.modName}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="text-zinc-400 font-mono">{updateItem.currentVersion}</span>
                <span>→</span>
                <span className="text-primary font-mono font-bold">{updateItem.newVersion}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-zinc-800/80 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info Meta */}
        <div className="px-4 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-zinc-400" />
            <span>Ngày phát hành: <strong className="text-zinc-200">{formattedDate}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive size={13} className="text-zinc-400" />
            <span>Dung lượng: <strong className="text-zinc-200">{sizeMb} MB</strong></span>
          </div>
        </div>

        {/* Changelog Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <FileText size={13} className="text-primary" />
            <span>Nhật ký thay đổi (Changelog):</span>
          </div>
          <div className="p-3 rounded-md border border-zinc-800 bg-zinc-950/70 text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto selection:bg-primary/30">
            {updateItem.changelog}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground truncate">
            Tệp mới: <span className="font-mono text-zinc-300">{updateItem.newFileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-3 text-xs">
              Đóng
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdate(updateItem)}
              className="h-8 px-3.5 text-xs font-semibold gap-1.5"
            >
              {isUpdating ? (
                <>Đang cập nhật...</>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  Cập nhật ngay
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode
}
