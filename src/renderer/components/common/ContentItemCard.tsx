import React from 'react'
import { cn } from '@/lib/utils'

export interface ContentItemCardProps {
  icon: React.ReactNode
  iconClassName?: string
  title: React.ReactNode
  badges?: React.ReactNode
  metaLine?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  disabled?: boolean
  highlighted?: boolean
  className?: string
  onClick?: () => void
}

export const ContentItemCard: React.FC<ContentItemCardProps> = ({
  icon,
  iconClassName,
  title,
  badges,
  metaLine,
  description,
  actions,
  disabled = false,
  highlighted = false,
  className,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between gap-3.5 p-3 px-3.5 rounded-2xl border transition-all duration-150 shadow-sm cv-auto',
        highlighted
          ? 'border-emerald-500/50 bg-zinc-900/95 ring-1 ring-emerald-500/20'
          : disabled
          ? 'border-zinc-800/60 bg-zinc-950/60 opacity-75 hover:opacity-100 hover:border-zinc-700'
          : 'border-zinc-800/80 bg-zinc-900/85 hover:border-emerald-500/50 hover:bg-zinc-900',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Left: Icon & Content details */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-colors',
            iconClassName || 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
          )}
        >
          {icon}
        </div>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {/* Title & Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm font-bold truncate transition-colors',
                disabled ? 'text-zinc-400 line-through' : 'text-foreground group-hover:text-primary'
              )}
            >
              {title}
            </span>
            {badges}
          </div>

          {/* Metadata subline */}
          {metaLine && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {metaLine}
            </div>
          )}

          {/* Description preview */}
          {description && (
            <p className="text-[11px] text-muted-foreground/75 truncate max-w-lg">{description}</p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  )
}
