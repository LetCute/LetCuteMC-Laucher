import { useState, useEffect } from 'react'
import type {
  LauncherProfile,
  CreateProfileInput,
  MinecraftVersionCatalog,
  MinecraftVersionItem,
} from '@/shared/types'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { AlertCircle, Info, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { formatVersionDisplay } from '@/lib/utils'
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
  'w-full h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:opacity-50'

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
  const [versionTypeFilter, setVersionTypeFilter] = useState<'releases' | 'snapshots' | 'old_beta' | 'old_alpha'>('releases')

  const [modLoader, setModLoader] = useState<ModLoaderType>('vanilla')
  const [loaderVersions, setLoaderVersions] = useState<ModLoaderVersion[]>([])
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>('')
  const [isFetchingLoaders, setIsFetchingLoaders] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const { showToast } = useToast()

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
      const defaultName = first?.id ? `Cấu hình ${first.id}` : ''
      window.launcherApi.getSettings().then(settings => {
        setFormData({
          name: defaultName,
          minecraftVersion: first?.id ?? '',
          gameDir: defaultGameDir || '',
          minMemoryMb: settings.defaultMinMemoryMb || 2048,
          maxMemoryMb: settings.defaultMaxMemoryMb || 4096,
        })
      }).catch(() => {
        setFormData({
          name: defaultName,
          minecraftVersion: first?.id ?? '',
          gameDir: defaultGameDir || '',
          minMemoryMb: 2048,
          maxMemoryMb: 4096,
        })
      })
    }
    setErrors({})
    setModLoader('vanilla')
    setSelectedLoaderVersion('')
  }, [isOpen, profile, preselectedVersion, versionCatalog, defaultGameDir])

  useEffect(() => {
    async function fetchLoaders() {
      if (modLoader === 'vanilla' || !formData.minecraftVersion) {
        setLoaderVersions([])
        setSelectedLoaderVersion('')
        return
      }
      setIsFetchingLoaders(true)
      try {
        let versions: ModLoaderVersion[] = []
        if (modLoader === 'fabric') versions = await window.launcherApi.getFabricVersions()
        if (modLoader === 'quilt') versions = await window.launcherApi.getQuiltVersions()
        if (modLoader === 'forge') versions = await window.launcherApi.getForgeVersions(formData.minecraftVersion)
        if (modLoader === 'neoforge') versions = await window.launcherApi.getNeoForgeVersions(formData.minecraftVersion)

        setLoaderVersions(versions)
        if (versions.length > 0 && versions[0]) {
          setSelectedLoaderVersion(versions[0].version)
        } else {
          setSelectedLoaderVersion('')
        }
      } catch (e) {
        console.error('Failed to fetch loaders', e)
        setLoaderVersions([])
        setSelectedLoaderVersion('')
      } finally {
        setIsFetchingLoaders(false)
      }
    }
    fetchLoaders()
  }, [modLoader, formData.minecraftVersion])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Tên profile không được rỗng'
    if (!formData.minecraftVersion.trim()) newErrors.minecraftVersion = 'Phiên bản không được rỗng'
    if (modLoader !== 'vanilla' && !selectedLoaderVersion) {
      newErrors.modLoader = 'Chưa chọn phiên bản Loader hoặc không có bản tương thích'
    }
    if (formData.minMemoryMb < 512) newErrors.minMemoryMb = 'RAM tối thiểu >= 512 MB'
    if (formData.maxMemoryMb < formData.minMemoryMb)
      newErrors.maxMemoryMb = 'RAM tối đa phải >= RAM tối thiểu'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    let finalMinecraftVersion = formData.minecraftVersion

    let finalGameDir = formData.gameDir
    let mcRootDir = defaultGameDir

    if (finalGameDir === defaultGameDir || !finalGameDir) {
      const safeName = formData.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const sep = defaultGameDir.includes('\\') ? '\\' : '/'
      finalGameDir = `${defaultGameDir}${sep}profiles${sep}${safeName}`
    }

    if (modLoader !== 'vanilla' && selectedLoaderVersion) {
      setIsInstalling(true)
      try {
        if (modLoader === 'fabric') {
          finalMinecraftVersion = await window.launcherApi.installFabric(
            formData.minecraftVersion,
            selectedLoaderVersion,
            mcRootDir!
          )
        } else if (modLoader === 'quilt') {
          finalMinecraftVersion = await window.launcherApi.installQuilt(
            formData.minecraftVersion,
            selectedLoaderVersion,
            mcRootDir!
          )
        } else if (modLoader === 'forge') {
          finalMinecraftVersion = await window.launcherApi.installForge(
            formData.minecraftVersion,
            selectedLoaderVersion,
            mcRootDir!
          )
        } else if (modLoader === 'neoforge') {
          finalMinecraftVersion = await window.launcherApi.installNeoForge(
            formData.minecraftVersion,
            selectedLoaderVersion,
            mcRootDir!
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi cài đặt Mod Loader'
        showToast('error', msg)
        setIsInstalling(false)
        return
      }
      setIsInstalling(false)
    }

    onSave({
      name: formData.name,
      minecraftVersion: finalMinecraftVersion,
      gameDir: finalGameDir,
      mcRootDir: mcRootDir,
      minMemoryMb: formData.minMemoryMb,
      maxMemoryMb: formData.maxMemoryMb,
    })
  }

  const isVersionNotInstalled = selectedVersionItem && !selectedVersionItem.isInstalled
  const hasVersions = (versionCatalog?.all?.length ?? 0) > 0
  const btnText = profile ? 'Lưu thay đổi' : 'Tạo Profile'

  const loaderName =
    modLoader === 'fabric'
      ? 'Fabric'
      : modLoader === 'quilt'
        ? 'Quilt'
        : modLoader === 'forge'
          ? 'Forge'
          : 'NeoForge'

  const installingOverlay = isInstalling ? (
    <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 size={18} className="text-primary animate-spin" />
        </div>
      </div>

      <h3 className="text-base font-bold text-foreground mb-1">
        Đang cài đặt {loaderName}
      </h3>
      <p className="text-xs text-primary font-mono mb-3">
        {selectedLoaderVersion} • Minecraft {formData.minecraftVersion}
      </p>

      <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-4">
        Launcher đang tải tệp cài đặt và các thư viện cần thiết. Quá trình này có thể mất 1 - 3 phút tùy vào tốc độ mạng.
      </p>

      <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden mb-4 border border-border">
        <div className="h-full bg-primary rounded-full animate-pulse w-full" />
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md">
        <AlertCircle size={13} className="shrink-0" />
        <span>Vui lòng không đóng launcher trong khi đang cài đặt</span>
      </div>
    </div>
  ) : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isInstalling) onClose()
      }}
      closable={!isInstalling}
      overlay={installingOverlay}
      title={profile ? 'Chỉnh Sửa Profile' : 'Tạo Profile'}
      description={profile ? 'Cập nhật thông tin cấu hình' : 'Chọn phiên bản Minecraft'}
      maxWidth="max-w-md"
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
            placeholder="Ví dụ: Cấu hình 1.21.7"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Phiên bản</label>
          {profile ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between h-10 w-full rounded-md border border-border bg-input/40 px-3.5 py-2 text-sm select-none">
                <span className="font-mono text-foreground font-medium truncate">
                  {formatVersionDisplay(formData.minecraftVersion)}
                </span>
                <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border/50 shrink-0 font-normal">
                  Cố định
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Không thể thay đổi phiên bản của cấu hình đã tạo.
              </span>
            </div>
          ) : hasVersions ? (
            <div className="flex items-center gap-3 w-full">
              <div className="w-1/3">
                <Select
                  value={versionTypeFilter}
                  onChange={(val) => {
                    setVersionTypeFilter(val as any)
                    // Optionally reset selected version when changing type
                    let firstList = []
                    if (val === 'snapshots') firstList = versionCatalog?.snapshots ?? []
                    else if (val === 'old_beta') firstList = versionCatalog?.oldBeta ?? []
                    else if (val === 'old_alpha') firstList = versionCatalog?.oldAlpha ?? []
                    else firstList = versionCatalog?.releases ?? []

                    if (firstList.length > 0 && firstList[0]) {
                      const nextVer = firstList[0].id
                      setFormData(p => ({
                        ...p,
                        minecraftVersion: nextVer,
                        name: (!profile && (p.name === '' || p.name === p.minecraftVersion || p.name === `Cấu hình ${p.minecraftVersion}`))
                          ? `Cấu hình ${nextVer}`
                          : p.name
                      }))
                    }
                  }}
                  options={[
                    { value: 'releases', label: 'Releases' },
                    { value: 'snapshots', label: 'Snapshots' },
                    { value: 'old_beta', label: 'Old Beta' },
                    { value: 'old_alpha', label: 'Old Alpha' },
                  ]}
                />
              </div>
              <div className="w-2/3">
                <Select
                  value={formData.minecraftVersion}
                  onChange={(val) => setFormData(p => ({
                    ...p,
                    minecraftVersion: val,
                    name: (!profile && (p.name === '' || p.name === p.minecraftVersion || p.name === `Cấu hình ${p.minecraftVersion}`))
                      ? `Cấu hình ${val}`
                      : p.name
                  }))}
                  options={(
                    versionTypeFilter === 'snapshots' ? versionCatalog?.snapshots :
                      versionTypeFilter === 'old_beta' ? versionCatalog?.oldBeta :
                        versionTypeFilter === 'old_alpha' ? versionCatalog?.oldAlpha :
                          versionCatalog?.releases ?? []
                  )?.map(v => ({
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
                  })) ?? []}
                />
              </div>
            </div>
          ) : (
            <input
              type="text"
              className={selectClass}
              placeholder="Ví dụ: 1.21.1"
              value={formData.minecraftVersion}
              onChange={(e) => setFormData({ ...formData, minecraftVersion: e.target.value })}
            />
          )}
          {!profile && isVersionNotInstalled && modLoader === 'vanilla' && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/8 border border-amber-500/20 rounded-md p-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>
                Phiên bản này chưa được tải. Launcher sẽ tải tự động khi chạy lần đầu.
              </span>
            </div>
          )}
        </div>

        {!profile && (
          <div className="col-span-2 grid grid-cols-10 gap-5">
            <div className={modLoader === 'vanilla' ? 'col-span-10 flex flex-col gap-1.5' : 'col-span-4 flex flex-col gap-1.5'}>
              <label className="text-sm font-medium text-foreground">Cài đặt Mod</label>
              <Select
                value={modLoader}
                onChange={(val) => setModLoader(val as ModLoaderType)}
                options={[
                  { value: 'vanilla', label: 'Không' },
                  { value: 'fabric', label: 'Fabric' },
                  { value: 'quilt', label: 'Quilt' },
                  { value: 'forge', label: 'Forge' },
                  { value: 'neoforge', label: 'NeoForge' },
                ]}
              />
            </div>

            {modLoader !== 'vanilla' && (
              <div className="col-span-6 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Phiên bản Loader</label>
                <Select
                  value={selectedLoaderVersion}
                  onChange={setSelectedLoaderVersion}
                  options={isFetchingLoaders
                    ? [{ value: selectedLoaderVersion, label: 'Đang tải danh sách...' }]
                    : loaderVersions.length === 0
                      ? [{ value: '', label: 'Không có phiên bản tương thích' }]
                      : loaderVersions.map(v => ({
                        value: v.version,
                        label: v.version + (v.stable ? ' (Stable)' : ' (Beta)')
                      }))}
                />
                {errors.modLoader && (
                  <span className="text-xs text-destructive">{errors.modLoader}</span>
                )}
              </div>
            )}
          </div>
        )}

        {!profile && modLoader !== 'vanilla' && (
          <div className="col-span-2 flex items-start gap-2 text-xs text-primary/90 bg-primary/10 border border-primary/20 rounded-md p-2.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>
              Launcher sẽ tự động tải và cài đặt nền tảng {modLoader === 'fabric' ? 'Fabric' : modLoader === 'quilt' ? 'Quilt' : modLoader === 'forge' ? 'Forge' : 'NeoForge'} vào thư mục game.
            </span>
          </div>
        )}

        {/* <div className="col-span-2">
          <Input
            label="Thư Mục Game"
            placeholder="Để trống để Launcher tự tạo thư mục riêng biệt"
            value={formData.gameDir}
            onChange={(e) => setFormData({ ...formData, gameDir: e.target.value })}
            error={errors.gameDir}
          />
        </div> */}

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
