import { Sparkles, Trash2, RefreshCw, FolderOpen } from 'lucide-react'
import { Button } from '../components/ui/button'
import { DropZone } from '../components/ui/DropZone'
import { ScreenHeader } from '../components/common/ScreenHeader'
import { ScreenFilterBar } from '../components/common/ScreenFilterBar'
import { ContentItemCard } from '../components/common/ContentItemCard'
import { AsyncStateWrapper } from '../components/common/AsyncStateWrapper'
import { useGameContent } from '../hooks/useGameContent'
import { cn } from '@/lib/utils'

interface ShaderPacksScreenProps {
  gameDir: string
  profileName?: string
}

export const ShaderPacksScreen = ({ gameDir, profileName }: ShaderPacksScreenProps) => {
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
    type: 'shader_pack',
    itemTypeName: 'shader pack',
  })

  return (
    <div className="px-6 pt-2 pb-6 flex flex-col h-full gap-4 select-none">
      {/* ─── Screen Header ────────────────────────────────────────────────────────── */}
      <ScreenHeader
        title="Gói Đồ Họa & Bóng (Shader Packs)"
        profileName={profileName}
        subtitle={
          <span>
            Tổng cộng: <span className="text-foreground font-bold">{packs.length}</span> gói shaders · Kéo thả file .zip để cài đặt nhanh
          </span>
        }
        actions={
          <>
            <Button
              onClick={handleOpenFolder}
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              title="Mở thư mục shaderpacks trong Windows Explorer"
            >
              <FolderOpen size={14} className="text-primary" />
              Thư mục shaders
            </Button>

            <Button
              onClick={fetchPacks}
              disabled={loading}
              variant="elevated"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5"
              title="Quét lại thư mục shaderpacks"
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
        searchPlaceholder="Tìm kiếm gói shaders (VD: Complementary, BSL, Iris...)"
      />

      {/* ─── Shader Pack List (DropZone Wrapped) ─────────────────────────────────── */}
      <DropZone accept={['zip']} onDropFiles={handleDropImport} label="Thả file .zip vào đây để cài Shader Pack">
        <AsyncStateWrapper
          loading={loading && packs.length === 0}
          loadingMessage="Đang quét các gói shader packs..."
          isEmpty={filteredPacks.length === 0}
          emptyIcon={<Sparkles size={36} className="text-zinc-600" />}
          emptyTitle={searchTerm ? 'Không tìm thấy shader nào' : 'Chưa có shader pack nào'}
          emptyDescription={
            searchTerm
              ? `Không có shader pack nào khớp với "${searchTerm}".`
              : 'Kéo thả file .zip vào khung trên để thêm Shaders cho Minecraft (Iris / Oculus / OptiFine).'
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
                    icon={<Sparkles size={18} />}
                    iconClassName="border-amber-500/30 bg-amber-500/15 text-amber-400"
                    title={pack.name}
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
                    actions={
                      <Button
                        disabled={isOperating}
                        onClick={() => handleDelete(pack)}
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 bg-zinc-800/80 border-zinc-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 rounded-md transition-all"
                        title="Xóa shader này"
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

export default ShaderPacksScreen
