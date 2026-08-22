import type { MinecraftVersionCatalog, MinecraftVersionItem } from '@/shared/types'
import {
  FolderOpen,
  PlusCircle,
  Trash2,
  RefreshCw,
  Box,
  FlaskConical,
  HardDrive,
  CheckCircle2,
  Calendar,
  Cpu,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { ScreenHeader } from '../components/common/ScreenHeader'
import { ScreenFilterBar } from '../components/common/ScreenFilterBar'
import { MetricStatsGrid } from '../components/common/MetricStatsGrid'
import { AsyncStateWrapper } from '../components/common/AsyncStateWrapper'
import {
  useVersions,
  getEstimatedJavaVersion,
  formatDate,
  VersionTabKey,
} from '../hooks/useVersions'
import { cn } from '@/lib/utils'

interface VersionsScreenProps {
  catalog: MinecraftVersionCatalog | null
  gameDir: string
  onCreateProfile: (versionItem?: MinecraftVersionItem) => void
  onRefresh?: () => void
  isWorking?: boolean
}

export function VersionsScreen({
  catalog,
  gameDir,
  onCreateProfile,
  onRefresh,
  isWorking,
}: VersionsScreenProps) {
  const {
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filteredList,
    installedCount,
    categoriesWithOptions,
    handleOpenVersionsFolder,
    handleDeleteVersion,
    handleOpenSpecificVersionFolder,
  } = useVersions({
    catalog,
    gameDir,
    onCreateProfile,
    onRefresh,
  })

  return (
    <div className="px-6 pt-2 pb-6 flex flex-col h-full gap-4 select-none">
      {/* ─── Screen Header ────────────────────────────────────────────────────────── */}
      <ScreenHeader
        title="Danh Mục Phiên Bản Minecraft"
        subtitle={
          catalog ? (
            <span>
              Đã tải: <span className="text-foreground font-bold">{catalog.all.length}</span> phiên bản ·{' '}
              <span className="text-emerald-400 font-semibold">{catalog.releases.length} bản chính thức</span> ·{' '}
              <span className="text-purple-400 font-semibold">{catalog.snapshots.length} thử nghiệm</span> ·{' '}
              <span className="text-cyan-400 font-semibold">{installedCount} đã có trên máy</span>
            </span>
          ) : (
            'Đang lấy danh mục phiên bản mới nhất từ máy chủ Mojang...'
          )
        }
        actions={
          <>
            <Button
              onClick={handleOpenVersionsFolder}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
              title="Mở thư mục .minecraft/versions trong Windows Explorer"
            >
              <FolderOpen size={14} className="text-primary" />
              Thư mục versions
            </Button>
            <Button
              onClick={onRefresh}
              disabled={isWorking}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
              title="Tải lại danh mục từ Mojang"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isWorking && 'animate-spin')} />
              Làm mới
            </Button>
            <Button
              onClick={() => onCreateProfile()}
              variant="primary"
              size="sm"
              className="h-9 px-3.5 text-xs font-bold gap-1.5 shadow-md shadow-primary/20 bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
            >
              <PlusCircle size={14} />
              Tạo cấu hình mới
            </Button>
          </>
        }
      />

      {/* ─── Metric Stats Grid ────────────────────────────────────────────────────── */}
      {catalog && (
        <MetricStatsGrid
          columns={3}
          items={[
            {
              id: 'releases',
              label: 'Bản chính thức (Release)',
              value: `${catalog.releases.length} phiên bản`,
              icon: Box,
              iconColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
            },
            {
              id: 'snapshots',
              label: 'Bản thử nghiệm (Snapshot)',
              value: `${catalog.snapshots.length} phiên bản`,
              icon: FlaskConical,
              iconColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
            },
            {
              id: 'installed',
              label: 'Đã có trên máy',
              value: `${installedCount} phiên bản sẵn sàng`,
              icon: HardDrive,
              iconColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
            },
          ]}
        />
      )}

      {/* ─── Filter Bar: Custom Dropdown & Search Input ─────────────────────────── */}
      <ScreenFilterBar<VersionTabKey>
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm theo tên phiên bản (VD: 1.21.4, 1.20, 26.1, 24w...)"
        categoryOptions={categoriesWithOptions}
        activeCategoryKey={activeTab}
        onCategorySelect={setActiveTab}
      />

      {/* ─── Version Cards List ─────────────────────────────────────────────────── */}
      <AsyncStateWrapper
        loading={!catalog}
        loadingMessage="Đang đồng bộ danh mục phiên bản từ máy chủ Mojang..."
        isEmpty={filteredList.length === 0}
        emptyIcon={<Box size={36} className="text-zinc-600" />}
        emptyTitle={searchTerm ? 'Không tìm thấy phiên bản' : 'Không có phiên bản nào'}
        emptyDescription={
          searchTerm
            ? `Không có phiên bản nào khớp với từ khóa "${searchTerm}".`
            : 'Mục này hiện chưa có phiên bản nào.'
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
            {filteredList.map((ver) => {
              const javaReq = getEstimatedJavaVersion(ver.id)
              const releaseDate = formatDate(ver.releaseTime)
              const isInstalled = !!ver.isInstalled

              return (
                <div
                  key={ver.id}
                  className={cn(
                    'group flex items-center justify-between gap-3 p-3 px-3.5 rounded-2xl border transition-all duration-150 shadow-sm',
                    isInstalled
                      ? 'border-emerald-500/40 bg-zinc-900/95 hover:border-emerald-500/60'
                      : 'border-zinc-800/80 bg-zinc-900/85 hover:border-emerald-500/40 hover:bg-zinc-900'
                  )}
                >
                  {/* Left: Icon & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-colors',
                        isInstalled
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : ver.type === 'snapshot'
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                      )}
                    >
                      {isInstalled ? <CheckCircle2 size={18} /> : <Box size={18} />}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          Minecraft {ver.name || ver.id}
                        </span>

                        {isInstalled && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            Đã cài đặt
                          </span>
                        )}

                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                          <Cpu size={10} className="text-primary" />
                          {javaReq}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="truncate max-w-[200px] font-mono text-zinc-400 text-[11px]">{ver.id}</span>
                        {releaseDate && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                              <Calendar size={11} />
                              {releaseDate}
                            </span>
                          </>
                        )}
                        {ver.path && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="truncate max-w-[140px] text-[10px] font-mono text-zinc-500">
                              {ver.path}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      onClick={() => onCreateProfile(ver)}
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 rounded-xl gap-1"
                      title={`Tạo cấu hình chơi Minecraft ${ver.name}`}
                    >
                      <PlusCircle size={12} />
                      Tạo cấu hình
                    </Button>

                    {isInstalled && ver.path && (
                      <Button
                        onClick={() => handleOpenSpecificVersionFolder(ver.path!)}
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl"
                        title="Mở thư mục phiên bản"
                      >
                        <FolderOpen size={13} />
                      </Button>
                    )}

                    {isInstalled && ver.path && (
                      <Button
                        onClick={() => handleDeleteVersion(ver)}
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 bg-zinc-800/80 border-zinc-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 rounded-xl"
                        title="Xóa bản cài đặt này"
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </AsyncStateWrapper>
    </div>
  )
}

export default VersionsScreen
