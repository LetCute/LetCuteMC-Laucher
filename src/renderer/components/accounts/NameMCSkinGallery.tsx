import { useState, useMemo } from 'react'
import { Sparkles, Search, Loader2, User, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '../ui/Input'
import { SkinBody } from '../ui/SkinBody'
import type { ToastType } from '../ui/Toast'
import { NAMEMC_CURATED_SKINS, NAMEMC_CATEGORIES, type NameMCSkin } from '../../data/namemcSkins'
import { cn } from '@/lib/utils'

interface NameMCSkinGalleryProps {
  pendingSkinFile: string | null
  onSelectSkin: (skinUrl: string, model: 'classic' | 'slim') => void
  onDirectPlayerLoaded?: (skinBase64: string, model: 'classic' | 'slim', capeBase64?: string) => void
  showToast: (type: ToastType, message: string) => void
  isTargetLocal?: boolean
}

const GallerySkinItem = ({
  skin,
  onSelect,
  isSelected,
}: {
  skin: NameMCSkin
  onSelect: () => void
  isSelected?: boolean
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-xl p-2 flex flex-col items-center gap-1.5 transition-all group relative border text-left',
        isSelected
          ? 'border-primary/60 bg-primary/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-primary/40'
          : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/60'
      )}
      title={`${skin.name} (${skin.model === 'slim' ? 'Tay mảnh (Slim)' : 'Classic'})`}
    >
      {isSelected && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm z-10">
          <Check size={10} className="stroke-[3]" />
        </span>
      )}
      <div className="w-full max-w-[64px] aspect-[1/1.6] rounded-lg overflow-hidden flex items-center justify-center bg-zinc-900/60 border border-zinc-800/50 group-hover:scale-105 transition-transform drop-shadow-sm">
        <SkinBody skinUrl={skin.url} width={44} height={88} className="h-full object-contain" />
      </div>
      <div className="w-full text-center min-w-0 px-0.5">
        <p className="text-[11px] font-semibold text-foreground truncate">{skin.name}</p>
        <span
          className={cn(
            'inline-block text-[9px] font-medium px-1.5 py-0.5 rounded mt-0.5 max-w-full truncate border',
            skin.model === 'slim'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          )}
        >
          {skin.model === 'slim' ? 'Slim' : 'Classic'}
        </span>
      </div>
    </button>
  )
}

export default function NameMCSkinGallery({
  pendingSkinFile,
  onSelectSkin,
  onDirectPlayerLoaded,
  showToast,
}: NameMCSkinGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [galleryQuery, setGalleryQuery] = useState('')
  const [galleryPage, setGalleryPage] = useState(1)
  const [isSearchingPlayer, setIsSearchingPlayer] = useState(false)

  const filteredSkins = useMemo(() => {
    return NAMEMC_CURATED_SKINS.filter((skin) => {
      const matchCat = selectedCategory === 'all' || skin.category === selectedCategory
      const q = galleryQuery.trim().toLowerCase()
      const matchQuery =
        !q ||
        skin.name.toLowerCase().includes(q) ||
        skin.id.toLowerCase().includes(q) ||
        (skin.author && skin.author.toLowerCase().includes(q))
      return matchCat && matchQuery
    })
  }, [selectedCategory, galleryQuery])

  const SKINS_PER_PAGE = 12
  const totalPages = Math.max(1, Math.ceil(filteredSkins.length / SKINS_PER_PAGE))
  const paginatedSkins = useMemo(() => {
    const start = (Math.min(galleryPage, totalPages) - 1) * SKINS_PER_PAGE
    return filteredSkins.slice(start, start + SKINS_PER_PAGE)
  }, [filteredSkins, galleryPage, totalPages])

  const handleLivePlayerSearch = async () => {
    if (!galleryQuery.trim()) return
    setIsSearchingPlayer(true)
    try {
      const playerData = await window.launcherApi.lookupPlayerSkin(galleryQuery.trim())
      if (playerData && playerData.url) {
        const base64Skin = await window.launcherApi.fetchMojangTexture(playerData.url)
        let base64Cape: string | undefined
        if (playerData.capeUrl) {
          const fetchedCape = await window.launcherApi.fetchMojangTexture(playerData.capeUrl)
          if (fetchedCape) base64Cape = fetchedCape
        }

        if (base64Skin && onDirectPlayerLoaded) {
          onDirectPlayerLoaded(base64Skin, (playerData.model as 'classic' | 'slim') || 'classic', base64Cape)
        }
        showToast('success', `Đã tìm thấy & nạp skin người chơi ${playerData.username}!`)
      } else {
        showToast('error', `Không tìm thấy người chơi "${galleryQuery.trim()}" trên NameMC / Mojang.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi tìm kiếm người chơi'
      showToast('error', message)
    } finally {
      setIsSearchingPlayer(false)
    }
  }

  return (
    <div className="pt-3 border-t border-zinc-800/80 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-3">
      {/* Search & Pagination Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary" /> Thư viện Skin (NameMC)
          </label>
          <span className="text-[10px] text-zinc-400 bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded-full font-medium">
            {filteredSkins.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
            <Input
              placeholder="Tìm kiếm skin..."
              className="h-8 text-xs pl-8 w-40 sm:w-48 bg-zinc-950/60 border-zinc-800 focus-visible:border-primary/60 rounded-lg"
              value={galleryQuery}
              onChange={(e) => {
                setGalleryQuery(e.target.value)
                setGalleryPage(1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleLivePlayerSearch()
              }}
            />
          </div>

          <div className="flex gap-1 items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
              disabled={galleryPage <= 1}
              onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}
              title="Trang trước"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs font-medium text-zinc-400 flex items-center px-1.5 min-w-[3rem] justify-center">
              {galleryPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
              disabled={galleryPage >= totalPages}
              onClick={() => setGalleryPage((p) => Math.min(totalPages, p + 1))}
              title="Trang sau"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {NAMEMC_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => {
              setSelectedCategory(cat.key)
              setGalleryPage(1)
            }}
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap transition-all border shrink-0',
              selectedCategory === cat.key
                ? 'bg-primary/15 text-primary border-primary/40 shadow-sm font-semibold'
                : 'bg-zinc-950/60 text-zinc-400 border-zinc-800/80 hover:bg-zinc-900 hover:text-zinc-200 hover:border-zinc-700'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid Skins */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1">
        {paginatedSkins.length === 0 ? (
          <div className="col-span-4 sm:col-span-6 flex flex-col items-center justify-center text-center py-8 gap-2 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
            <span className="text-xs text-muted-foreground">Không tìm thấy skin nào phù hợp.</span>
            {galleryQuery.trim() && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 rounded-lg mt-1"
                onClick={handleLivePlayerSearch}
                disabled={isSearchingPlayer}
              >
                {isSearchingPlayer ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <User size={12} className="mr-1" />
                )}
                Tìm skin người chơi "{galleryQuery.trim()}" trên NameMC
              </Button>
            )}
          </div>
        ) : (
          paginatedSkins.map((skin) => (
            <GallerySkinItem
              key={skin.id}
              skin={skin}
              isSelected={pendingSkinFile === skin.url}
              onSelect={() => onSelectSkin(skin.url, skin.model === 'slim' ? 'slim' : 'classic')}
            />
          ))
        )}
      </div>
    </div>
  )
}
