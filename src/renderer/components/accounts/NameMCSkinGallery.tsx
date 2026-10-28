import { useState, useMemo } from 'react'
import { Sparkles, Search, Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '../ui/Input'
import { SkinBody } from '../ui/SkinBody'
import type { ToastType } from '../ui/Toast'
import { NAMEMC_CURATED_SKINS, NAMEMC_CATEGORIES, type NameMCSkin } from '../../data/namemcSkins'

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
      className={[
        'rounded-md p-2 flex flex-col items-center gap-1.5 transition-all group relative border text-left',
        isSelected
          ? 'border-primary bg-primary/10 shadow-[0_0_12px_rgba(var(--primary),0.2)]'
          : 'border-border/40 bg-background/40 backdrop-blur-sm hover:border-primary/40 hover:bg-background/80 hover:-translate-y-0.5',
      ].join(' ')}
      title={`${skin.name} (${skin.model === 'slim' ? 'Tay mảnh' : 'Classic'})`}
    >
      <div className="w-16 h-24 rounded-md overflow-hidden flex items-center justify-center bg-zinc-900/30 group-hover:scale-105 transition-transform drop-shadow-sm">
        <SkinBody skinUrl={skin.url} width={48} height={96} className="h-full object-contain" />
      </div>
      <div className="w-full text-center min-w-0 px-1">
        <p className="text-[11px] font-semibold text-foreground truncate">{skin.name}</p>
        <span className="inline-block text-[9px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted/40 truncate max-w-full">
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
  isTargetLocal = false,
}: NameMCSkinGalleryProps) {
  const [galleryQuery, setGalleryQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [galleryPage, setGalleryPage] = useState(1)
  const [isSearchingPlayer, setIsSearchingPlayer] = useState(false)

  const filteredSkins = useMemo(() => {
    return NAMEMC_CURATED_SKINS.filter(skin => {
      const matchesCat = selectedCategory === 'all' || skin.category === selectedCategory
      const q = galleryQuery.trim().toLowerCase()
      const matchesQuery =
        !q ||
        skin.name.toLowerCase().includes(q) ||
        skin.id.toLowerCase().includes(q) ||
        (skin.author && skin.author.toLowerCase().includes(q))
      return matchesCat && matchesQuery
    })
  }, [selectedCategory, galleryQuery])

  const SKINS_PER_PAGE = 12
  const totalPages = Math.max(1, Math.ceil(filteredSkins.length / SKINS_PER_PAGE))
  const paginatedSkins = useMemo(() => {
    const start = (galleryPage - 1) * SKINS_PER_PAGE
    return filteredSkins.slice(start, start + SKINS_PER_PAGE)
  }, [filteredSkins, galleryPage])

  const handleLivePlayerSearch = async () => {
    if (!galleryQuery.trim()) return
    setIsSearchingPlayer(true)
    try {
      const playerData = await window.launcherApi.lookupPlayerSkin(galleryQuery.trim())
      if (playerData && playerData.url) {
        const base64Skin = await window.launcherApi.fetchMojangTexture(playerData.url)
        let base64Cape: string | undefined
        if (playerData.capeUrl && isTargetLocal) {
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
    <div className="pt-4 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-3">
      {/* Search & Pagination Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            Thư viện Skin (NameMC)
          </label>
          <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full">
            {filteredSkins.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
            <Input
              placeholder="Tìm kiếm skin..."
              className="h-8 text-xs pl-8 w-44 sm:w-52"
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
              className="h-8 text-xs px-2"
              disabled={galleryPage <= 1}
              onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </Button>
            <span className="text-xs font-medium text-muted-foreground flex items-center px-1">
              {galleryPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2"
              disabled={galleryPage >= totalPages}
              onClick={() => setGalleryPage((p) => Math.min(totalPages, p + 1))}
            >
              Sau
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
            className={[
              'text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-all border shrink-0',
              selectedCategory === cat.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground',
            ].join(' ')}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Skin Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5 max-h-64 sm:max-h-72 overflow-y-auto pr-1">
        {paginatedSkins.length === 0 ? (
          <div className="col-span-4 flex flex-col items-center justify-center text-center py-8 gap-2 bg-accent/10 rounded-md border border-dashed border-border/60">
            <p className="text-xs text-muted-foreground">Không có skin nào trong danh mục phù hợp với từ khóa.</p>
            {galleryQuery.trim() && (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs bg-primary/20 text-primary border border-primary/30"
                onClick={() => void handleLivePlayerSearch()}
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
              onSelect={() => onSelectSkin(skin.url, skin.model)}
            />
          ))
        )}
      </div>
    </div>
  )
}
