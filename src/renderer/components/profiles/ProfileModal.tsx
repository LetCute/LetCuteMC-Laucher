import { useState, useEffect } from 'react'
import type {
  LauncherProfile,
  CreateProfileInput,
  MinecraftVersionCatalog,
  MinecraftVersionItem,
} from '@/shared/types'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (profile: CreateProfileInput) => void
  profile?: LauncherProfile | null
  versionCatalog: MinecraftVersionCatalog | null
  preselectedVersion?: MinecraftVersionItem | null
  defaultGameDir: string
}

interface FormState {
  name: string
  minecraftVersion: string
  gameDir: string
  minMemoryMb: number
  maxMemoryMb: number
}

const selectClass =
  'w-full h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:opacity-50'

export function ProfileModal({
  isOpen,
  onClose,
  onSave,
  profile,
  versionCatalog,
  preselectedVersion,
  defaultGameDir,
}: ProfileModalProps) {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    minecraftVersion: '',
    gameDir: defaultGameDir || '',
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedVersionItem, setSelectedVersionItem] = useState<MinecraftVersionItem | null>(null)

  useEffect(() => {
    if (!versionCatalog || !formData.minecraftVersion) {
      setSelectedVersionItem(null)
      return
    }
    const found = versionCatalog.all.find(v => v.id === formData.minecraftVersion) ?? null
    setSelectedVersionItem(found)
  }, [formData.minecraftVersion, versionCatalog])

  useEffect(() => {
    if (!isOpen) return
    if (profile) {
      setFormData({
        name: profile.name,
        minecraftVersion: profile.minecraftVersion,
        gameDir: profile.gameDir || defaultGameDir,
        minMemoryMb: profile.minMemoryMb,
        maxMemoryMb: profile.maxMemoryMb,
      })
    } else {
      const first = preselectedVersion ?? (versionCatalog?.releases?.[0] ?? null)
      setFormData({
        name: first?.id ? first.id : '',
        minecraftVersion: first?.id ?? '',
        gameDir: defaultGameDir || '',
        minMemoryMb: 2048,
        maxMemoryMb: 4096,
      })
    }
    setErrors({})
  }, [isOpen, profile, preselectedVersion, versionCatalog, defaultGameDir])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Tên profile không được rỗng'
    if (!formData.minecraftVersion.trim()) newErrors.minecraftVersion = 'Phiên bản không được rỗng'
    if (!formData.gameDir.trim()) newErrors.gameDir = 'Thư mục game không được rỗng'
    if (formData.minMemoryMb < 512) newErrors.minMemoryMb = 'RAM tối thiểu >= 512 MB'
    if (formData.maxMemoryMb < formData.minMemoryMb)
      newErrors.maxMemoryMb = 'RAM tối đa phải >= RAM tối thiểu'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      name: formData.name,
      minecraftVersion: formData.minecraftVersion,
      gameDir: formData.gameDir,
      minMemoryMb: formData.minMemoryMb,
      maxMemoryMb: formData.maxMemoryMb,
    })
  }

  const isVersionNotInstalled = selectedVersionItem && !selectedVersionItem.isInstalled
  const hasVersions = (versionCatalog?.all?.length ?? 0) > 0
  const btnText = profile ? 'Lưu thay đổi' : 'Tạo Profile'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={profile ? 'Chỉnh Sửa Profile' : 'Tạo Profile'}
      description="Chọn phiên bản Minecraft"
      maxWidth="max-w-sm"
      footer={
        <>
          <Button onClick={onClose} variant="ghost" size="sm">
            Hủy
          </Button>
          <Button onClick={handleSubmit} variant="primary" size="sm">
            {btnText}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-5">
        <div className="col-span-2">
          <Input
            label="Tên Profile"
            placeholder="Ví dụ: Survival 1.21"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Phiên bản</label>
          {hasVersions ? (
            <select
              className={selectClass}
              value={formData.minecraftVersion}
              onChange={(e) => setFormData(p => ({ ...p, minecraftVersion: e.target.value }))}
            >
              {(versionCatalog?.all ?? []).map(v => (
                <option key={v.id} value={v.id}>
                  {v.id}{v.isInstalled ? ' ✓' : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className={selectClass}
              placeholder="Ví dụ: 1.21.1"
              value={formData.minecraftVersion}
              onChange={(e) => setFormData({ ...formData, minecraftVersion: e.target.value })}
            />
          )}
          {errors.minecraftVersion && (
            <span className="text-xs text-destructive">{errors.minecraftVersion}</span>
          )}
          {isVersionNotInstalled && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/8 border border-amber-500/20 rounded-lg p-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>
                Phiên bản này chưa được tải. Launcher sẽ tải tự động khi chạy lần đầu.
              </span>
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Input
            label="Thư Mục Game"
            placeholder="Đường dẫn đến thư mục .minecraft"
            value={formData.gameDir}
            onChange={(e) => setFormData({ ...formData, gameDir: e.target.value })}
            error={errors.gameDir}
          />
        </div>

        <Input
          label="RAM Tối Thiểu (MB)"
          type="number"
          value={formData.minMemoryMb}
          onChange={(e) => setFormData({ ...formData, minMemoryMb: parseInt(e.target.value) || 0 })}
          error={errors.minMemoryMb}
        />
        <Input
          label="RAM Tối Đa (MB)"
          type="number"
          value={formData.maxMemoryMb}
          onChange={(e) => setFormData({ ...formData, maxMemoryMb: parseInt(e.target.value) || 0 })}
          error={errors.maxMemoryMb}
        />
      </div>
    </Modal>
  )
}

export default ProfileModal
