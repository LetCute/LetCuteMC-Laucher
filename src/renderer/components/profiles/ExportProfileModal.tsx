import { useState } from 'react'
import {
  Package,
  Box,
  Settings2,
  Sliders,
  Server,
  FileArchive,
  Loader2,
  Check,
  Zap,
  Image,
} from 'lucide-react'
import type { LauncherProfile } from '@/shared/types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/button'
import { Input } from '../ui/Input'
import { launcherClient } from '../../services/launcherClient'
import { useToast } from '../ui/Toast'
import { cn } from '@/lib/utils'

interface ExportProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: LauncherProfile | null
}

export function ExportProfileModal({ isOpen, onClose, profile }: ExportProfileModalProps) {
  const { showToast } = useToast()

  const [includeMods, setIncludeMods] = useState(true)
  const [includeConfig, setIncludeConfig] = useState(true)
  const [includeShaderPacks, setIncludeShaderPacks] = useState(false)
  const [includeResourcePacks, setIncludeResourcePacks] = useState(false)
  const [includeOptions, setIncludeOptions] = useState(true)
  const [includeServers, setIncludeServers] = useState(false)

  const [author, setAuthor] = useState('LetCute Player')
  const [description, setDescription] = useState(profile?.description || '')
  const [isExporting, setIsExporting] = useState(false)

  if (!profile) return null

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const sanitizedName = profile.name.replace(/[<>:"/\\|?*]/g, '_').trim()
      const defaultFileName = `${sanitizedName}_Pack.letcutepack`

      // Open Save File Dialog
      const destinationPath = await window.launcherApi.saveFileDialog({
        defaultPath: defaultFileName,
        filters: [
          { name: 'LetCute Profile Package (*.letcutepack)', extensions: ['letcutepack'] },
          { name: 'ZIP Archive (*.zip)', extensions: ['zip'] },
        ],
      })

      if (!destinationPath) {
        setIsExporting(false)
        return
      }

      const result = await launcherClient.exportProfilePackage({
        profileId: profile.id,
        destinationPath,
        includeMods,
        includeConfig,
        includeShaderPacks,
        includeResourcePacks,
        includeOptions,
        includeServers,
        author: author.trim() || undefined,
        description: description.trim() || undefined,
      })

      if (result.success) {
        const sizeMb = result.fileSizeBytes ? (result.fileSizeBytes / (1024 * 1024)).toFixed(1) : '0'
        showToast('success', `Đã xuất gói cấu hình thành công (${sizeMb} MB)!`)
        onClose()
      } else {
        showToast('error', result.error || 'Xuất gói cấu hình thất bại.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi xuất gói.'
      showToast('error', message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isExporting ? () => {} : onClose}
      title="Xuất Gói Cấu Hình (.letcutepack)"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs select-none">
        {/* Profile Target Info Header */}
        <div className="p-3.5 rounded-md border border-zinc-800/80 bg-zinc-900/85 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-foreground truncate">{profile.name}</h4>
              <p className="text-[11px] text-muted-foreground truncate">
                Phiên bản: <strong className="text-zinc-200">{profile.minecraftVersion}</strong>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 shrink-0">
            {profile.minMemoryMb || 1024} - {profile.maxMemoryMb || 4096} MB RAM
          </span>
        </div>

        {/* Form Meta */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300">Tác giả / Người tạo</label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="VD: LetCute"
              className="h-8 text-xs bg-zinc-900/90 border-zinc-800"
              disabled={isExporting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300">Ghi chú / Mô tả</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Gói mod sinh tồn 100 ngày"
              className="h-8 text-xs bg-zinc-900/90 border-zinc-800"
              disabled={isExporting}
            />
          </div>
        </div>

        {/* Feature Checkboxes */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Chọn các thành phần đóng gói
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Mods */}
            <div
              onClick={() => !isExporting && setIncludeMods(!includeMods)}
              className={cn(
                'p-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2.5',
                includeMods
                  ? 'bg-primary/15 border-primary/50 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Box size={16} className={cn(includeMods ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-semibold">Tập tin Mods</p>
                  <p className="text-[10px] text-zinc-500">Toàn bộ thư mục mods/</p>
                </div>
              </div>
              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  includeMods
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {includeMods && <Check size={11} strokeWidth={3} />}
              </div>
            </div>

            {/* Config */}
            <div
              onClick={() => !isExporting && setIncludeConfig(!includeConfig)}
              className={cn(
                'p-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2.5',
                includeConfig
                  ? 'bg-primary/15 border-primary/50 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Settings2 size={16} className={cn(includeConfig ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-semibold">Cài đặt Mod (config/)</p>
                  <p className="text-[10px] text-zinc-500">Thiết lập tinh chỉnh mod</p>
                </div>
              </div>
              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  includeConfig
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {includeConfig && <Check size={11} strokeWidth={3} />}
              </div>
            </div>

            {/* Keybinds & Options */}
            <div
              onClick={() => !isExporting && setIncludeOptions(!includeOptions)}
              className={cn(
                'p-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2.5',
                includeOptions
                  ? 'bg-primary/15 border-primary/50 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sliders size={16} className={cn(includeOptions ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-semibold">Phím bấm & Đồ họa</p>
                  <p className="text-[10px] text-zinc-500">options.txt, độ nhạy chuột</p>
                </div>
              </div>
              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  includeOptions
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {includeOptions && <Check size={11} strokeWidth={3} />}
              </div>
            </div>

            {/* Shader Packs */}
            <div
              onClick={() => !isExporting && setIncludeShaderPacks(!includeShaderPacks)}
              className={cn(
                'p-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2.5',
                includeShaderPacks
                  ? 'bg-primary/15 border-primary/50 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Zap size={16} className={cn(includeShaderPacks ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-semibold">Shader Packs</p>
                  <p className="text-[10px] text-zinc-500">Gói đổ bóng ánh sáng</p>
                </div>
              </div>
              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  includeShaderPacks
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {includeShaderPacks && <Check size={11} strokeWidth={3} />}
              </div>
            </div>

            {/* Resource Packs */}
            <div
              onClick={() => !isExporting && setIncludeResourcePacks(!includeResourcePacks)}
              className={cn(
                'p-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2.5',
                includeResourcePacks
                  ? 'bg-primary/15 border-primary/50 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Image size={16} className={cn(includeResourcePacks ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-semibold">Resource Packs</p>
                  <p className="text-[10px] text-zinc-500">Gói kết cấu / họa tiết</p>
                </div>
              </div>
              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  includeResourcePacks
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {includeResourcePacks && <Check size={11} strokeWidth={3} />}
              </div>
            </div>

            {/* Servers */}
            <div
              onClick={() => !isExporting && setIncludeServers(!includeServers)}
              className={cn(
                'p-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2.5',
                includeServers
                  ? 'bg-primary/15 border-primary/50 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Server size={16} className={cn(includeServers ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-semibold">Danh sách Server</p>
                  <p className="text-[10px] text-zinc-500">servers.dat</p>
                </div>
              </div>
              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  includeServers
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {includeServers && <Check size={11} strokeWidth={3} />}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
          <Button
            onClick={onClose}
            disabled={isExporting}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs bg-zinc-900/90 border-zinc-800"
          >
            Hủy
          </Button>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            size="sm"
            className="h-8 px-4 text-xs font-semibold gap-1.5"
          >
            {isExporting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Đang đóng gói...
              </>
            ) : (
              <>
                <FileArchive size={13} />
                Chọn nơi lưu & Đóng gói
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
