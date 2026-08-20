import type { LauncherProfile } from '../../shared/types'
import { Layers, Edit2, Trash2, Check, Play, PlusCircle } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
// Images now loaded directly from public/assets

interface ProfilesScreenProps {
  profiles: LauncherProfile[]
  activeProfileId: string | null
  onSetActive: (id: string) => void
  onCreateProfile: () => void
  onEdit: (profile: LauncherProfile) => void
  onDelete: (id: string) => void
  onLaunchProfile: (id: string) => Promise<void>
  isWorking?: boolean
}

function ProfileImage({ profile }: { profile: LauncherProfile }) {
  const [iconData, setIconData] = useState<string | null>(null)

  const isFabric = profile.minecraftVersion.toLowerCase().includes('fabric')
  const isQuilt = profile.minecraftVersion.toLowerCase().includes('quilt')
  const isNeoForge = profile.minecraftVersion.toLowerCase().includes('neoforge')
  const isForge = profile.minecraftVersion.toLowerCase().includes('forge') && !isNeoForge
  const isModpack = !!profile.mcRootDir

  useEffect(() => {
    let isMounted = true
    if (isModpack && profile.gameDir) {
      window.launcherApi.readLocalImageBase64(profile.gameDir + '\\icon.png')
        .then(res => {
          if (isMounted && res) setIconData(res)
        })
        .catch(() => { })
    }
    return () => { isMounted = false }
  }, [profile.id, profile.gameDir, isModpack])

  const imageClass = "w-10 h-10 rounded-lg shadow-sm object-cover bg-black/20"

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
  isWorking,
}: ProfilesScreenProps) => {

  const canLaunch = !isWorking

  const handleLaunchProfileDirectly = async (profileId: string) => {
    onSetActive(profileId)
    await onLaunchProfile(profileId)
  }

  return (
    <div className="px-6 pt-2 pb-6 h-full flex flex-col gap-6">
      {/* Profiles List */}
      <div className="flex flex-col gap-5 h-full min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground/80">Cấu hình game</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Danh sách các cấu hình cài đặt
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                      if (!isWorking) onSetActive(profile.id)
                    }}
                    className={[
                      'group flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border transition',
                      isWorking ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                      'border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/70 hover:border-primary/30',
                    ].join(' ')}
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
                          <span className={[
                            'text-sm font-bold truncate transition-colors',
                            isActive ? 'text-primary' : 'text-foreground'
                          ].join(' ')}>
                            {profile.name}
                          </span>
                          <Badge variant="secondary">{profile.minecraftVersion}</Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>RAM: <span className="font-semibold text-foreground/80">{profile.minMemoryMb}M – {profile.maxMemoryMb}M</span></span>

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
                        className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Play size={13} className="fill-current" />
                      </Button>
                      <Button
                        title="Sửa cấu hình"
                        disabled={isWorking}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(profile)
                        }}
                        variant="secondary"
                        size="icon-sm"
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
                        variant="ghost"
                        size="icon-sm"
                        className="hover:bg-destructive/10 text-destructive/80 hover:text-destructive border border-destructive/10"
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
              description="Vào mục Phiên bản, chọn phiên bản rồi bấm Tạo cấu hình."
            />
          )}
        </div>
      </div>
    </div>
  )
}
