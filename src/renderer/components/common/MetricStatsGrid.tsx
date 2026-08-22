import React from 'react'
import { cn } from '@/lib/utils'

export interface MetricStatItem {
  id: string
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor?: string
  badge?: React.ReactNode
  description?: React.ReactNode
}

interface MetricStatsGridProps {
  items: MetricStatItem[]
  columns?: 2 | 3 | 4
}

export const MetricStatsGrid: React.FC<MetricStatsGridProps> = ({ items, columns = 3 }) => {
  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-3'

  return (
    <div className={cn('grid gap-3', colClass)}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.id}
            className="p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 flex items-center gap-3.5 shadow-sm hover:border-zinc-700 transition-colors"
          >
            <div
              className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner',
                item.iconColor || 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              )}
            >
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
                {item.badge}
              </div>
              <div className="text-sm font-bold text-foreground mt-0.5 truncate">{item.value}</div>
              {item.description && (
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {item.description}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
