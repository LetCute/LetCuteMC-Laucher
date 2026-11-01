import type { LauncherProfile } from '../../shared/types'
import { Layers, Edit2, Trash2, Check, Play, PlusCircle, Share2, DownloadCloud, FileArchive, RefreshCw } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { cn, formatVersionDisplay } from '@/lib/utils'
import { ExportProfileModal } from '../components/profiles/ExportProfileModal'
import { ImportProfileModal } from '../components/profiles/ImportProfileModal'
// Images now loaded directly from public/assets

interface ProfilesScreenProps {
  profiles: LauncherProfile[]
  activeProfileId: string | null
  onSetActive: (id: string) => void
  onCreateProfile: () => void
  onEdit: (profile: LauncherProfile) => void
  onDelete: (id: string) => void
  onLaunchProfile: (id: string) => Promise<void>
  onReloadProfiles?: () => Promise<void>
  isWorking?: boolean
}

function ProfileImage({ profile }: { profile: LauncherProfile }) {
  const [iconData, setIconData] = useState<string | null>(null)

  const loader = profile.loader || ''
  const ver = profile.minecraftVersion.toLowerCase()
  const isFabric = loader === 'fabric' || ver.includes('fabric')
  const isQuilt = loader === 'quilt' || ver.includes('quilt')
  const isNeoForge = loader === 'neoforge' || ver.includes('neoforge')
  const isForge = (loader === 'forge' || (ver.includes('forge') && !ver.includes('neoforge'))) && !isNeoForge

  useEffect(() => {
    let isMounted = true
    if (profile.gameDir) {
      const sep = profile.gameDir.includes('\\') ? '\\' : '/'
      const iconPath = profile.gameDir.endsWith(sep) ? `${profile.gameDir}icon.png` : `${profile.gameDir}${sep}icon.png`
      window.launcherApi.readLocalImageBase64(iconPath)
        .then(res => {
          if (isMounted && res) setIconData(res)
        })
        .catch(() => { })
    }
    return () => { isMounted = false }
  }, [profile.id, profile.gameDir])

  const imageClass = "w-10 h-10 rounded-md shadow-sm object-cover bg-black/20"

  if (iconData) {
    return <img src={iconData} className={imageClass} alt="Modpack" />
  }

  if (isFabric) {
    return <img src="./assets/fabric.png" className={imageClass} alt="Fabric" onError={(e) => { e.currentTarget.src = "./assets/grass_block.png" }} />
  }

  if (isQuilt) {
    return <img src="./assets/quilt.svg" className={imageClass} alt="Quilt" onError={(e) => { e.currentTarget.src = "./assets/grass_block.png" }} />
  }

  if (isNeoForge) {
    return <img src="./assets/neoforged.png" className={imageClass} alt="NeoForge" onError={(e) => { e.currentTarget.src = "./assets/grass_block.png" }} />
  }

  if (isForge) {
    return <img src="./assets/forge.png" className={imageClass} alt="Forge" onError={(e) => { e.currentTarget.src = "./assets/grass_block.png" }} />
  }

  return <img src="./assets/grass_block.png" className={imageClass} alt="Vanilla" />
}

export const ProfilesScreen = ({
  profiles,
  activeProfileId,
  onSetActive,
  onCreateProfile,
  onEdit,
  onDelete,
  onLaunchProfile,
  onReloadProfiles,
  isWorking,
}: ProfilesScreenProps) => {
  const [exportProfile, setExportProfile] = useState<LauncherProfile | null>(null)
  const [importPackagePath, setImportPackagePath] = useState<string | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isReloading, setIsReloading] = useState(false)

  const canLaunch = !isWorking

  const handleReload = async () => {
    if (!onReloadProfiles || isReloading) return
    setIsReloading(true)
    try {
      await onReloadProfiles()
    } finally {
      setIsReloading(false)
    }
  }

  const handleLaunchProfileDirectly = async (profileId: string) => {
    onSetActive(profileId)
    await onLaunchProfile(profileId)
  }

  const handleOpenImportFileDialog = async () => {
    const filePath = await window.launcherApi.openFileDialog([
      { name: 'LetCute Profile Package (*.letcutepack, *.zip)', extensions: ['letcutepack', 'zip'] },
    ])
    if (filePath) {
      setImportPackagePath(filePath)
      setIsImportModalOpen(true)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDraggingOver(true)
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDraggingOver(false)
        const file = e.dataTransfer.files[0]
        if (file) {
          const path = window.launcherApi.getPathForFile(file)
          if (path && (path.endsWith('.letcutepack') || path.endsWith('.zip'))) {
            setImportPackagePath(path)
            setIsImportModalOpen(true)
          }
        }
      }}
      className={cn(
        'px-6 pt-2 pb-6 h-full flex flex-col gap-6 relative transition-all',
        isDraggingOver && 'ring-2 ring-primary ring-inset bg-primary/5'
      )}
    >
      {/* Drag Overlay Notice */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="h-16 w-16 rounded-md bg-primary/20 text-primary border border-primary/40 flex items-center justify-center animate-bounce">
            <FileArchive size={32} />
          </div>
          <p className="text-base font-bold text-foreground">Thả tệp .letcutepack hoặc .zip để nhập cấu hình!</p>
        </div>
      )}

      {/* Profiles List */}
      <div className="flex flex-col gap-5 h-full min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground/80">Cấu hình game</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Danh sách các cấu hình cài đặt & chia sẻ
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onReloadProfiles && (
              <Button
                onClick={() => void handleReload()}
                disabled={isWorking || isReloading}
                variant="elevated"
                size="sm"
                className="h-9 px-3 text-xs gap-1.5"
                title="Tải lại danh sách cấu hình và quét thư mục instance"
              >
                <RefreshCw size={14} className={cn("text-primary", isReloading && "animate-spin")} />
                Tải lại
              </Button>
            )}
            <Button
              onClick={handleOpenImportFileDialog}
              disabled={isWorking}
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              title="Nhập gói cấu hình từ bạn bè hoặc tệp sao lưu"
            >
              <DownloadCloud size={14} className="text-primary" />
              Nhập gói (.letcutepack)
            </Button>

            <Button
              onClick={() => onCreateProfile()}
              disabled={isWorking}
              variant="primary"
              size="sm"
              className="h-9 px-3"
              title="Tạo cấu hình mới"
            >
              <PlusCircle size={14} className="mr-1.5" />
              Tạo cấu hình
            </Button>
          </div>
        </div>

        {/* List or Empty State */}
        <div className="flex-1 overflow-y-auto pr-1">
          {profiles.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {profiles.map(profile => {
                const isActive = profile.id === activeProfileId

                return (
                  <div
                    key={profile.id}
                    onClick={() => {
                      onSetActive(profile.id)
                    }}
                    className={cn(
                      'group flex items-center justify-between gap-4 p-4 rounded-md border transition-all duration-200 shadow-xs cursor-pointer',
                      isActive
                        ? 'border-primary/60 bg-zinc-900/90 ring-1 ring-primary/30'
                        : 'border-zinc-800/60 bg-zinc-950/45 hover:bg-zinc-950/70 hover:border-zinc-700/60'
                    )}
                  >
                    {/* Left: Info */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Image Indicator */}
                      <div className="relative shrink-0">
                        <ProfileImage profile={profile} />
                        {isActive && (
                          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
                            <Check size={10} strokeWidth={4} />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'text-base font-bold truncate transition-colors',
                            isActive ? 'text-primary' : 'text-foreground/85 group-hover:text-foreground'
                          )}>
                            {profile.name}
                          </span>
                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-zinc-700">{formatVersionDisplay(profile.minecraftVersion)}</Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>RAM: <span className="font-semibold text-zinc-300">{profile.minMemoryMb}M – {profile.maxMemoryMb}M</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Button
                        title="Chơi ngay cấu hình này"
                        disabled={!canLaunch}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleLaunchProfileDirectly(profile.id)
                        }}
                        variant="ghost"
                        size="icon-sm"
                        className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 disabled:opacity-50 disabled:pointer-events-none h-8 w-8 rounded-md"
                      >
                        <Play size={13} className="fill-current" />
                      </Button>
                      <Button
                        title="Xuất gói cấu hình (.letcutepack) để chia sẻ hoặc sao lưu"
                        disabled={isWorking}
                        onClick={(e) => {
                          e.stopPropagation()
                          setExportProfile(profile)
                        }}
                        variant="elevated"
                        size="icon-sm"
                        className="h-8 w-8 text-primary hover:text-white rounded-md"
                      >
                        <Share2 size={13} />
                      </Button>
                      <Button
                        title="Sửa cấu hình"
                        disabled={isWorking}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(profile)
                        }}
                        variant="elevated"
                        size="icon-sm"
                        className="h-8 w-8 text-zinc-200 hover:text-white rounded-md"
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        title="Xóa cấu hình"
                        disabled={isWorking}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(profile.id)
                        }}
                        variant="elevated"
                        size="icon-sm"
                        className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:border-rose-500/40 rounded-md"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Layers size={32} />}
              title="Chưa có cấu hình nào"
              description="Vào mục Phiên bản, chọn phiên bản rồi bấm Tạo cấu hình hoặc Nhập gói cấu hình."
            />
          )}
        </div>
      </div>

      {/* Export Profile Package Modal */}
      <ExportProfileModal
        isOpen={!!exportProfile}
        onClose={() => setExportProfile(null)}
        profile={exportProfile}
      />

      {/* Import Profile Package Modal */}
      <ImportProfileModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
          setImportPackagePath(null)
        }}
        packagePath={importPackagePath}
        onSuccess={async (newProfile) => {
          await onReloadProfiles?.();
          onSetActive(newProfile.id)
        }}
      />
    </div>
  )
}
