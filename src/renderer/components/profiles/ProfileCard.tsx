import { Check, Edit2, Trash2 } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { LauncherProfile } from '@/shared/types'
import { Button } from '../ui/button'

interface ProfileCardProps {
  profile: LauncherProfile
  onSetActive: (id: string) => void
  onEdit: (profile: LauncherProfile) => void
  onDelete: (id: string) => void
}

export const ProfileCard = ({ profile, onSetActive, onEdit, onDelete }: ProfileCardProps) => {
  const isActive = (profile as any).isActive

  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border bg-card p-5 transition-all duration-200',
        isActive
          ? 'border-primary/50 ring-1 ring-primary/20 shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_8%,transparent)]'
          : 'border-border hover:border-border/80 hover:bg-card/80',
      ].join(' ')}
    >
      {/* Active badge */}
      {isActive && (
        <div className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Check size={13} strokeWidth={3} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 mb-4">
        <h3 className="text-base font-bold text-foreground mb-2.5 truncate" title={profile.name}>
          {profile.name}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <Badge variant="secondary">{profile.minecraftVersion}</Badge>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>RAM</span>
            <span className="text-foreground font-medium">
              {profile.minMemoryMb}M – {profile.maxMemoryMb}M
            </span>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <span>Tạo</span>
            <span className="text-muted-foreground">{new Date(profile.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <Button
          disabled={isActive}
          onClick={() => onSetActive(profile.id)}
          variant={isActive ? "secondary" : "primary"}
          size="sm"
          className="flex-1"
        >
          {isActive ? (
            <>
              <Check size={13} strokeWidth={3} />
              Đang dùng
            </>
          ) : (
            'Chọn'
          )}
        </Button>
        <Button
          onClick={() => onEdit(profile)}
          title="Chỉnh sửa"
          variant="outline"
          size="icon-sm"
        >
          <Edit2 size={14} />
        </Button>
        <Button
          onClick={() => onDelete(profile.id)}
          title="Xóa"
          variant="danger"
          size="icon-sm"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )
}
