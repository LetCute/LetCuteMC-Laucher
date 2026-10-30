import { Palette, Trash2, RefreshCw, FolderOpen } from 'lucide-react'
import { Button } from '../components/ui/button'
import { DropZone } from '../components/ui/DropZone'
import { ScreenHeader } from '../components/common/ScreenHeader'
import { ScreenFilterBar } from '../components/common/ScreenFilterBar'
import { ContentItemCard } from '../components/common/ContentItemCard'
import { AsyncStateWrapper } from '../components/common/AsyncStateWrapper'
import { useGameContent } from '../hooks/useGameContent'
import { cn } from '@/lib/utils'

interface ResourcePacksScreenProps {
  gameDir: string
  profileName?: string
}

export const ResourcePacksScreen = ({ gameDir, profileName }: ResourcePacksScreenProps) => {
  const {
    items: packs,
    filteredItems: filteredPacks,
    searchTerm,
    setSearchTerm,
    loading,
    operatingItems: operatingPacks,
    fetchItems: fetchPacks,
    handleDelete,
    handleDropImport,
    handleOpenFolder,
    formatSize,
    formatDate,
  } = useGameContent({
    gameDir,
    type: 'resource_pack',
    itemTypeName: 'gói tài nguyên',
  })

  return (
    <div className="px-6 pt-2 pb-6 flex flex-col h-full gap-4 select-none">
      {/* ─── Screen Header ────────────────────────────────────────────────────────── */}
      <ScreenHeader
        title="Gói Tài Nguyên (Resource Packs)"
        profileName={profileName}
        subtitle={
          <span>
            Tổng cộng: <span className="text-foreground font-bold">{packs.length}</span> gói texture · Kéo thả file .zip để cài đặt nhanh
          </span>
        }
        actions={
          <>
            <Button
              onClick={handleOpenFolder}
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              title="Mở thư mục resourcepacks trong Windows Explorer"
            >
              <FolderOpen size={14} className="text-primary" />
              Thư mục packs
            </Button>

            <Button
              onClick={fetchPacks}
              disabled={loading}
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              title="Quét lại thư mục resourcepacks"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Làm mới
            </Button>
          </>
        }
      />

      {/* ─── Filter Bar: Search Input ───────────────────────────────────────────── */}
      <ScreenFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm kiếm gói tài nguyên (texture packs)..."
      />

      {/* ─── Resource Pack List (DropZone Wrapped) ───────────────────────────────── */}
      <DropZone accept={['zip']} onDropFiles={handleDropImport} label="Thả file .zip vào đây để cài Resource Pack">
        <AsyncStateWrapper
          loading={loading && packs.length === 0}
          loadingMessage="Đang quét các gói tài nguyên..."
          isEmpty={filteredPacks.length === 0}
          emptyIcon={<Palette size={36} className="text-zinc-600" />}
          emptyTitle={searchTerm ? 'Không tìm thấy gói nào' : 'Chưa có gói tài nguyên nào'}
          emptyDescription={
            searchTerm
              ? `Không có resource pack nào khớp với "${searchTerm}".`
              : 'Kéo thả file .zip vào khung trên để thêm Resource Pack cho Minecraft.'
          }
          emptyAction={
            searchTerm ? (
              <Button variant="outline" size="sm" onClick={() => setSearchTerm('')} className="mt-2 text-xs">
                Xóa tìm kiếm
              </Button>
            ) : undefined
          }
        >
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {filteredPacks.map((pack) => {
                const isOperating = operatingPacks.has(pack.path)

                return (
                  <ContentItemCard
                    key={pack.path}
                    icon={<Palette size={18} />}
                    iconClassName="border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                    title={pack.name}
                    badges={
                      pack.metadata?.packFormat != null ? (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700">
                          Format {pack.metadata.packFormat}
                        </span>
                      ) : null
                    }
                    metaLine={
                      <>
                        <span className="truncate max-w-[220px] font-mono text-zinc-400 text-[11px]">
                          {pack.fileName}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className="font-semibold text-zinc-300 text-[11px]">
                          {formatSize(pack.sizeBytes)}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-zinc-400 text-[11px]">{formatDate(pack.updatedAt)}</span>
                      </>
                    }
                    description={pack.metadata?.description}
                    actions={
                      <Button
                        disabled={isOperating}
                        onClick={() => handleDelete(pack)}
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 bg-zinc-800/80 border-zinc-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 rounded-md transition-all"
                        title="Xóa gói tài nguyên này"
                      >
                        <Trash2 size={13} />
                      </Button>
                    }
                  />
                )
              })}
            </div>
          </div>
        </AsyncStateWrapper>
      </DropZone>
    </div>
  )
}

export default ResourcePacksScreen
