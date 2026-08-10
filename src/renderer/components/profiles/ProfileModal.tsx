import { useState, useEffect } from 'react'
import type {
  LauncherProfile,
  CreateProfileInput,
  MinecraftVersionCatalog,
  MinecraftVersionItem,
} from '@/shared/types'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { AlertCircle, Info } from 'lucide-react'
import { Button } from '../ui/button'
import { Select } from '../ui/Select'
import type { ModLoaderType, ModLoaderVersion } from '@/shared/types'

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

  const [modLoader, setModLoader] = useState<ModLoaderType>('vanilla')
  const [loaderVersions, setLoaderVersions] = useState<ModLoaderVersion[]>([])
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>('')
  const [isFetchingLoaders, setIsFetchingLoaders] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

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
    setModLoader('vanilla')
    setSelectedLoaderVersion('')
  }, [isOpen, profile, preselectedVersion, versionCatalog, defaultGameDir])

  useEffect(() => {
    async function fetchLoaders() {
      if (modLoader === 'vanilla') {
        setLoaderVersions([])
        setSelectedLoaderVersion('')
        return
      }
      setIsFetchingLoaders(true)
      try {
        let versions: ModLoaderVersion[] = []
        if (modLoader === 'fabric') versions = await window.launcherApi.getFabricVersions()
        if (modLoader === 'quilt') versions = await window.launcherApi.getQuiltVersions()

        setLoaderVersions(versions)
        if (versions.length > 0) {
          setSelectedLoaderVersion(versions[0].version)
        }
      } catch (e) {
        console.error('Failed to fetch loaders', e)
      } finally {
        setIsFetchingLoaders(false)
      }
    }
    fetchLoaders()
  }, [modLoader])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Tên profile không được rỗng'
    if (!formData.minecraftVersion.trim()) newErrors.minecraftVersion = 'Phiên bản không được rỗng'
    if (formData.minMemoryMb < 512) newErrors.minMemoryMb = 'RAM tối thiểu >= 512 MB'
    if (formData.maxMemoryMb < formData.minMemoryMb)
      newErrors.maxMemoryMb = 'RAM tối đa phải >= RAM tối thiểu'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    let finalMinecraftVersion = formData.minecraftVersion

    if (modLoader !== 'vanilla' && selectedLoaderVersion) {
      setIsInstalling(true)
      try {
        if (modLoader === 'fabric') {
          finalMinecraftVersion = await window.launcherApi.installFabric(
            formData.minecraftVersion,
            selectedLoaderVersion,
            formData.gameDir
          )
        } else if (modLoader === 'quilt') {
          finalMinecraftVersion = await window.launcherApi.installQuilt(
            formData.minecraftVersion,
            selectedLoaderVersion,
            formData.gameDir
          )
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Lỗi cài đặt Mod Loader')
        setIsInstalling(false)
        return
      }
      setIsInstalling(false)
    }

    onSave({
      name: formData.name,
      minecraftVersion: finalMinecraftVersion,
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
          <Button onClick={onClose} variant="ghost" size="sm" disabled={isInstalling}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} variant="primary" size="sm" disabled={isInstalling}>
            {isInstalling ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                Đang cài đặt...
              </span>
            ) : btnText}
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
            <Select
              value={formData.minecraftVersion}
              onChange={(val) => setFormData(p => ({ ...p, minecraftVersion: val }))}
              options={(versionCatalog?.all ?? []).map(v => ({
                value: v.id,
                label: (
                  <span className="flex items-center justify-between w-full">
                    <span>{v.id}</span>
                    {v.isInstalled && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-normal">
                        Đã tải
                      </span>
                    )}
                  </span>
                )
              }))}
            />
          ) : (
            <input
              type="text"
              className={selectClass}
              placeholder="Ví dụ: 1.21.1"
              value={formData.minecraftVersion}
              onChange={(e) => setFormData({ ...formData, minecraftVersion: e.target.value })}
            />
          )}
          {isVersionNotInstalled && modLoader === 'vanilla' && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/8 border border-amber-500/20 rounded-lg p-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>
                Phiên bản này chưa được tải. Launcher sẽ tải tự động khi chạy lần đầu.
              </span>
            </div>
          )}
        </div>

        <div className={modLoader === 'vanilla' ? 'col-span-2 flex flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
          <label className="text-sm font-medium text-foreground">Cài đặt Mod Loader</label>
          <Select
            value={modLoader}
            onChange={(val) => setModLoader(val as ModLoaderType)}
            options={[
              { value: 'vanilla', label: 'Không cài' },
              { value: 'fabric', label: 'Fabric' },
              { value: 'quilt', label: 'Quilt' },
            ]}
          />
        </div>

        {modLoader !== 'vanilla' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Phiên bản Loader</label>
            <Select
              value={selectedLoaderVersion}
              onChange={setSelectedLoaderVersion}
              options={isFetchingLoaders ? [{ value: selectedLoaderVersion, label: 'Đang tải danh sách...' }] : loaderVersions.map(v => ({
                value: v.version,
                label: v.version + (v.stable ? ' (Stable)' : ' (Beta)')
              }))}
            />
          </div>
        )}

        {modLoader !== 'vanilla' && (
          <div className="col-span-2 flex items-start gap-2 text-xs text-primary/90 bg-primary/10 border border-primary/20 rounded-lg p-2.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>
              Launcher sẽ tự động tải và cài đặt nền tảng {modLoader === 'fabric' ? 'Fabric' : 'Quilt'} vào thư mục game.
            </span>
          </div>
        )}

        <div className="col-span-2">
          <Input
            label="Thư Mục Game"
            placeholder="Để trống để Launcher tự tạo thư mục riêng biệt"
            value={formData.gameDir}
            onChange={(e) => setFormData({ ...formData, gameDir: e.target.value })}
            error={errors.gameDir}
          />
        </div>

        <Input
          label="RAM Tối Thiểu (MB)"
          type="number"
          value={formData.minMemoryMb}
          min={512}
          max={32768}
          step={512}
          onChange={(e) => setFormData({ ...formData, minMemoryMb: parseInt(e.target.value) || 0 })}
          error={errors.minMemoryMb}
        />
        <Input
          label="RAM Tối Đa (MB)"
          type="number"
          value={formData.maxMemoryMb}
          min={512}
          max={32768}
          step={512}
          onChange={(e) => setFormData({ ...formData, maxMemoryMb: parseInt(e.target.value) || 0 })}
          error={errors.maxMemoryMb}
        />
      </div>
    </Modal>
  )
}

export default ProfileModal
