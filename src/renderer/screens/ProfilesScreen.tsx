import type { LauncherProfile } from '../../shared/types'
import { Layers, Edit2, Trash2, Check, Play, PlusCircle } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Button } from '@/components/ui/button'

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
            <h2 className="text-xl font-bold text-foreground">Cấu hình game</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Danh sách các cấu hình cài đặt
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                try {
                  const success = await window.launcherApi.injectTopServers(activeProfileId)
                  if (success) alert('Đã cập nhật Top Server VN vào profile thành công!')
                  else alert('Lỗi: Không tìm thấy máy chủ nào hoặc lỗi khi ghi file.')
                } catch (e) {
                  alert('Có lỗi xảy ra: ' + String(e))
                }
              }}
              disabled={isWorking || !activeProfileId}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-card"
              title="Cập nhật Top Server VN vào game"
            >
              <RefreshCw size={14} className="mr-1.5" />
              Cập nhật Top Server
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
                      if (!isWorking) onSetActive(profile.id)
                    }}
                    className={[
                      'group flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border transition',
                      isWorking ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                      'border-border bg-card hover:border-primary/30 ',
                    ].join(' ')}
                  >
                    {/* Left: Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Active check indicator */}
                      <div className={[
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all duration-150',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background group-hover:border-primary/50',
                      ].join(' ')}>
                        {isActive && <Check size={12} strokeWidth={3} />}
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
