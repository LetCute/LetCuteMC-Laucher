import { useState, useMemo } from 'react'
import { Sparkles, Search, Check } from 'lucide-react'
import { Input } from '../ui/Input'
import { CapePreview } from '../ui/CapePreview'
import { NAMEMC_CURATED_CAPES, type NameMCCape } from '../../data/namemcCapes'
import { cn } from '@/lib/utils'

interface NameMCCapeGalleryProps {
  pendingCapeFile: string | null
  selectedCapeUrl: string | null
  onSelectCape: (cape: NameMCCape) => void
}

export default function NameMCCapeGallery({
  pendingCapeFile,
  selectedCapeUrl,
  onSelectCape,
}: NameMCCapeGalleryProps) {
  const [capeGalleryQuery, setCapeGalleryQuery] = useState('')

  const filteredCapes = useMemo(() => {
    return NAMEMC_CURATED_CAPES.filter((cape) => {
      const q = capeGalleryQuery.trim().toLowerCase()
      return (
        !q ||
        cape.name.toLowerCase().includes(q) ||
        (cape.year && cape.year.toLowerCase().includes(q)) ||
        (cape.description && cape.description.toLowerCase().includes(q))
      )
    })
  }, [capeGalleryQuery])

  return (
    <div className="pt-3 border-t border-zinc-800/80 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary" /> Thư viện Áo choàng (NameMC)
          </label>
          <span className="text-[10px] text-zinc-400 bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded-full font-medium">
            {filteredCapes.length}
          </span>
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
          <Input
            placeholder="Tìm kiếm áo choàng..."
            className="h-8 text-xs pl-8 w-44 sm:w-52 bg-zinc-950/60 border-zinc-800 focus-visible:border-primary/60 rounded-lg"
            value={capeGalleryQuery}
            onChange={(e) => setCapeGalleryQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
        {filteredCapes.length === 0 ? (
          <div className="col-span-4 sm:col-span-6 text-center text-xs text-muted-foreground py-8 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
            Không tìm thấy áo choàng nào phù hợp.
          </div>
        ) : (
          filteredCapes.map((cape) => {
            const isSelected = pendingCapeFile === cape.url || selectedCapeUrl === cape.url
            return (
              <button
                key={cape.id}
                type="button"
                onClick={() => onSelectCape(cape)}
                className={cn(
                  'rounded-xl p-2 flex flex-col items-center gap-1.5 transition-all group relative border text-left',
                  isSelected
                    ? 'border-primary/60 bg-primary/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-primary/40'
                    : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/60'
                )}
                title={`${cape.name}${cape.description ? ` - ${cape.description}` : ''}`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm z-10">
                    <Check size={10} className="stroke-[3]" />
                  </span>
                )}
                <div className="w-full max-w-[64px] aspect-[1/1.6] rounded-lg overflow-hidden flex items-center justify-center bg-zinc-900/60 border border-zinc-800/50 group-hover:scale-105 transition-transform drop-shadow-sm">
                  <CapePreview capeUrl={cape.url} width={36} height={58} className="shrink-0 drop-shadow-md rounded-sm" />
                </div>
                <div className="w-full text-center min-w-0 px-0.5">
                  <span className={cn('text-[11px] font-semibold truncate block', isSelected ? 'text-primary' : 'text-foreground')}>
                    {cape.name}
                  </span>
                  {cape.year && (
                    <span className="inline-block text-[9px] font-medium text-zinc-400 px-1.5 py-0.2 bg-zinc-900 rounded border border-zinc-800/60 mt-0.5">
                      {cape.year}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
