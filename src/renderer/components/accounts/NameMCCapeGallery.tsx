import { useState, useMemo } from 'react'
import { Sparkles, Search } from 'lucide-react'
import { Input } from '../ui/Input'
import { CapePreview } from '../ui/CapePreview'
import { NAMEMC_CURATED_CAPES, type NameMCCape } from '../../data/namemcCapes'

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
    <div className="pt-4 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles size={14} className="text-primary" />
          Thư viện Áo choàng NameMC
        </label>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
          <Input
            placeholder="Tìm kiếm áo choàng..."
            className="h-8 text-xs pl-8 w-48"
            value={capeGalleryQuery}
            onChange={(e) => setCapeGalleryQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 max-h-56 overflow-y-auto pr-1">
        {filteredCapes.length === 0 ? (
          <div className="col-span-4 text-center text-xs text-muted-foreground py-8">
            Không tìm thấy áo choàng nào.
          </div>
        ) : (
          filteredCapes.map((cape) => {
            const isSelected = pendingCapeFile === cape.url || selectedCapeUrl === cape.url
            return (
              <button
                key={cape.id}
                type="button"
                onClick={() => onSelectCape(cape)}
                className={[
                  'border rounded-md p-2 flex flex-col items-center gap-1.5 transition-all group relative',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-[0_0_12px_rgba(var(--primary),0.2)] ring-1 ring-primary'
                    : 'border-border/40 bg-background/40 backdrop-blur-sm hover:border-primary/40 hover:bg-background/80 hover:-translate-y-0.5',
                ].join(' ')}
                title={`${cape.name}${cape.description ? ` - ${cape.description}` : ''}`}
              >
                <div className="w-16 h-24 rounded-md overflow-hidden flex items-center justify-center bg-zinc-900/20 group-hover:scale-105 transition-transform drop-shadow-sm">
                  <CapePreview capeUrl={cape.url} width={40} height={64} className="shrink-0 drop-shadow-md" />
                </div>
                <span
                  className={[
                    'text-[11px] font-semibold w-full text-center px-1 truncate',
                    isSelected ? 'text-primary' : 'text-foreground',
                  ].join(' ')}
                >
                  {cape.name}
                </span>
                {cape.year && (
                  <span className="text-[9px] text-muted-foreground px-1 py-0.2 rounded bg-muted/40">
                    {cape.year}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
