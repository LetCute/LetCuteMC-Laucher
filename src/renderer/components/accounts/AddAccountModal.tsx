import { useState } from 'react'
import { Key, FlaskConical, PlusCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface AddAccountModalProps {
  isOpen: boolean
  onClose: () => void
  isWorking?: boolean
  onMicrosoftLogin: () => void
  onAddLocalAccount: (username: string) => Promise<boolean | void>
}

export default function AddAccountModal({
  isOpen,
  onClose,
  isWorking = false,
  onMicrosoftLogin,
  onAddLocalAccount,
}: AddAccountModalProps) {
  const [showLocalInput, setShowLocalInput] = useState(false)
  const [newLocalUsername, setNewLocalUsername] = useState('')

  const handleClose = () => {
    setShowLocalInput(false)
    setNewLocalUsername('')
    onClose()
  }

  const handleCreateLocal = async () => {
    const trimmed = newLocalUsername.trim()
    if (!trimmed) return
    const res = await onAddLocalAccount(trimmed)
    if (res !== false) {
      handleClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Thêm tài khoản"
      description="Chọn loại tài khoản bạn muốn thêm"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-3">
        {/* Microsoft Option */}
        <div className="space-y-1.5">
          <button
            onClick={onMicrosoftLogin}
            disabled={isWorking}
            className="w-full group flex items-center gap-4 p-4 rounded-md border border-zinc-800/80 bg-zinc-900/90 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all text-left disabled:opacity-50 shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/25">
              <Key size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Tài khoản Microsoft</p>
              <p className="text-xs text-muted-foreground mt-0.5">Đăng nhập bản quyền Microsoft / Xbox</p>
            </div>
            <div className="shrink-0 text-muted-foreground group-hover:text-emerald-400">
              <PlusCircle size={18} />
            </div>
          </button>
          <p className="text-[10px] text-muted-foreground/75 px-1 leading-relaxed">
            * Xác thực OAuth2 sử dụng Client ID của Prism Launcher để kết nối tới Microsoft. LetCuteMC không lưu mật khẩu.
          </p>
        </div>

        {/* Local Option */}
        {!showLocalInput ? (
          <button
            onClick={() => setShowLocalInput(true)}
            disabled={isWorking}
            className="group flex items-center gap-4 p-4 rounded-md border border-zinc-800/80 bg-zinc-900/90 hover:border-amber-500/50 hover:bg-zinc-900 transition-all text-left disabled:opacity-50 shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:bg-amber-500/25">
              <FlaskConical size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Tài khoản Local (Offline)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Khởi tạo nhanh, chơi offline</p>
            </div>
            <div className="shrink-0 text-muted-foreground group-hover:text-amber-400">
              <PlusCircle size={18} />
            </div>
          </button>
        ) : (
          <div className="p-4 rounded-md border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center gap-2">
              <FlaskConical size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-foreground/80">Tạo tài khoản Local</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  disabled={isWorking}
                  value={newLocalUsername}
                  onChange={(e) => setNewLocalUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateLocal()
                  }}
                  placeholder="Tên người chơi..."
                  className="h-9"
                  autoFocus
                />
              </div>
              <Button
                onClick={() => void handleCreateLocal()}
                disabled={isWorking || !newLocalUsername.trim()}
                variant="primary"
                className="h-9"
              >
                <Upload size={14} className="mr-1" /> Tạo
              </Button>
            </div>
            <button
              onClick={() => {
                setShowLocalInput(false)
                setNewLocalUsername('')
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Quay lại
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
