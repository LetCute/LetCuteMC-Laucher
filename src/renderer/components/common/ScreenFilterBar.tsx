import React from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/DropdownMenu'
import { cn } from '@/lib/utils'

export interface FilterCategoryOption<T extends string = string> {
  key: T
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  badgeColor?: string
  count?: number
}

export interface FilterTabItem<T extends string = string> {
  key: T
  label: string
  count?: number
}

interface ScreenFilterBarProps<TCat extends string = string, TTab extends string = string> {
  searchTerm: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string

  // Optional Category Dropdown Selector
  categoryOptions?: FilterCategoryOption<TCat>[]
  activeCategoryKey?: TCat
  onCategorySelect?: (key: TCat) => void

  // Optional Filter Tabs
  filterTabs?: FilterTabItem<TTab>[]
  activeTabKey?: TTab
  onTabSelect?: (key: TTab) => void

  extraSlot?: React.ReactNode
}

export function ScreenFilterBar<TCat extends string = string, TTab extends string = string>({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  categoryOptions,
  activeCategoryKey,
  onCategorySelect,
  filterTabs,
  activeTabKey,
  onTabSelect,
  extraSlot,
}: ScreenFilterBarProps<TCat, TTab>) {
  const activeCategory = categoryOptions?.find((c) => c.key === activeCategoryKey)
  const ActiveIcon = activeCategory?.icon

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Optional Category Dropdown */}
      {categoryOptions && onCategorySelect && activeCategory && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="elevated"
              className="h-10 px-3.5 rounded-md gap-2.5 min-w-[260px] justify-between group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {ActiveIcon && (
                  <div
                    className={cn(
                      'h-6 w-6 rounded-md flex items-center justify-center shrink-0 border text-xs',
                      activeCategory.badgeColor ||
                        'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                    )}
                  >
                    <ActiveIcon size={13} />
                  </div>
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold truncate">{activeCategory.title}</span>
                  {activeCategory.count !== undefined && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                      {activeCategory.count}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown
                size={14}
                className="text-muted-foreground group-hover:text-foreground transition-transform duration-150 shrink-0"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-80 bg-zinc-900/95 border-zinc-700/60 rounded-md backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Chọn Danh Mục
            </div>
            <div className="space-y-1">
              {categoryOptions.map((cat) => {
                const Icon = cat.icon
                const isSelected = activeCategoryKey === cat.key

                return (
                  <DropdownMenuItem
                    key={cat.key}
                    onClick={() => onCategorySelect(cat.key)}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all',
                      isSelected
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold'
                        : 'hover:bg-zinc-800/80 text-zinc-200'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {Icon && (
                        <div
                          className={cn(
                            'h-7 w-7 rounded-md flex items-center justify-center shrink-0 border',
                            isSelected
                              ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          )}
                        >
                          <Icon size={14} />
                        </div>
                      )}
                      <div className="flex flex-col text-left min-w-0">
                        <span className="text-xs truncate">{cat.title}</span>
                        {cat.subtitle && (
                          <span className="text-[10px] text-muted-foreground font-normal truncate">
                            {cat.subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {cat.count !== undefined && (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.2 rounded-md',
                            isSelected
                              ? 'bg-emerald-500/25 text-emerald-300'
                              : 'bg-zinc-800 text-zinc-400'
                          )}
                        >
                          {cat.count}
                        </span>
                      )}
                      {isSelected && <Check size={13} className="text-emerald-400" />}
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none z-10" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-10 text-xs bg-zinc-900/90 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-primary/60 rounded-md w-full"
        />
      </div>

      {/* Optional Segmented Filter Tabs */}
      {filterTabs && onTabSelect && (
        <div className="flex gap-1.5 flex-wrap shrink-0">
          {filterTabs.map((item) => {
            const isActive = activeTabKey === item.key
            return (
              <Button
                key={item.key}
                onClick={() => onTabSelect(item.key)}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
                className={cn(
                  'h-10 px-3 rounded-md text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/20'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={cn(
                      'ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                      isActive
                        ? 'bg-zinc-950/40 text-primary-foreground'
                        : 'bg-zinc-800 text-zinc-400'
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Button>
            )
          })}
        </div>
      )}

      {extraSlot && <div className="shrink-0">{extraSlot}</div>}
    </div>
  )
}
