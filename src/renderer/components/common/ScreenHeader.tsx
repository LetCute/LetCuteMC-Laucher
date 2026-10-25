import React, { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  subtitle?: ReactNode
  profileName?: string
  actions?: ReactNode
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  profileName,
  actions,
}) => {
  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: title + profile badge + action buttons all on same line */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-foreground/90 tracking-tight shrink-0">{title}</h2>
        {profileName && (
          <span className="text-xs font-semibold text-zinc-300 px-2.5 py-0.5 bg-zinc-800/90 border border-zinc-700/80 rounded-md shrink-0">
            Cấu hình: {profileName}
          </span>
        )}
        {/* Spacer */}
        <div className="flex-1 min-w-0" />
        {actions && (
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">{actions}</div>
        )}
      </div>

      {/* Row 2: subtitle */}
      {subtitle && (
        <div className="text-xs text-muted-foreground leading-relaxed">{subtitle}</div>
      )}
    </div>
  )
}
