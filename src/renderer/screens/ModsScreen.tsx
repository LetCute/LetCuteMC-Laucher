import {
  Box,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ArrowUpCircle,
  FileText,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { DropZone } from '../components/ui/DropZone'
import { ScreenHeader } from '../components/common/ScreenHeader'
import { ScreenFilterBar, FilterTabItem } from '../components/common/ScreenFilterBar'
import { ContentItemCard } from '../components/common/ContentItemCard'
import { AsyncStateWrapper } from '../components/common/AsyncStateWrapper'
import { ModChangelogModal } from '../components/mods/ModChangelogModal'
import { ModConflictModal } from '../components/mods/ModConflictModal'
import { ModDependencyModal } from '../components/mods/ModDependencyModal'
import { useMods } from '../hooks/useMods'
import { cn } from '@/lib/utils'

interface ModsScreenProps {
  gameDir: string
  profileName?: string
  minecraftVersion?: string
}

export const ModsScreen = ({ gameDir, profileName, minecraftVersion }: ModsScreenProps) => {
  const {
    mods,
    filteredMods,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    loading,
    operatingMods,
    loadingMeta,
    enabledCount,
    disabledCount,
    updatesCount,
    updatesMap,
    refetchMods,
    handleToggleMod,
    handleDeleteMod,
    handleDropImport,
    handleOpenFolder,

    // Dependency Inspector
    depModalOpen,
    setDepModalOpen,
    isScanningDeps,
    isFixingDeps,
    depScanResult,
    fixResult,
    handleOpenDepInspector,
    handleAutoFixDependencies,

    // Conflict Predictor
    conflictModalOpen,
    setConflictModalOpen,
    isScanningConflicts,
    isResolvingConflict,
    conflictCheckResult,
    handleOpenConflictChecker,
    handleResolveConflict,
    handleResolveAllCriticalConflicts,

    // Auto-Updater
    isCheckingUpdates,
    isUpdatingAll,
    updatingModIds,
    updateCheckResult,
    selectedChangelogMod,
    setSelectedChangelogMod,
    handleCheckUpdates,
    handleUpdateSingleMod,
    handleUpdateAllMods,
  } = useMods({ gameDir, minecraftVersion })

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return 'Thư mục'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('vi-VN')

  const filterTabs: FilterTabItem<'all' | 'enabled' | 'disabled' | 'updates'>[] = [
    { key: 'all', label: 'Tất cả', count: mods.length },
    { key: 'enabled', label: 'Bật', count: enabledCount },
    { key: 'disabled', label: 'Tắt', count: disabledCount },
    ...(updatesCount > 0
      ? [{ key: 'updates' as const, label: 'Cập nhật', count: updatesCount }]
      : []),
  ]

  return (
    <div className="px-6 pt-4 pb-6 flex flex-col h-full gap-3 select-none">
      {/* ─── Screen Header ────────────────────────────────────────────────────────── */}
      <ScreenHeader
        title="Quản Lý Mods"
        profileName={profileName}
        subtitle={
          <span>
            Tổng cộng: <span className="text-foreground font-bold">{mods.length}</span> mods ·{' '}
            <span className="text-emerald-400 font-semibold">{enabledCount} đang bật</span> ·{' '}
            <span className="text-amber-400 font-semibold">{disabledCount} đã tắt</span>
            {updatesCount > 0 && (
              <> · <span className="text-emerald-300 font-bold">{updatesCount} có bản cập nhật mới</span></>
            )}
          </span>
        }
        actions={
          <>
            <Button
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdates || loading}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors shadow-sm text-xs font-semibold gap-1.5"
            >
              <ArrowUpCircle className={cn('h-4 w-4 text-emerald-400', isCheckingUpdates && 'animate-spin')} />
              {isCheckingUpdates ? 'Đang kiểm tra...' : 'Cập nhật Mod'}
            </Button>

            <Button
              onClick={handleOpenConflictChecker}
              disabled={isScanningConflicts}
              variant="outline"
              size="sm"
              className={cn(
                'h-9 px-3 text-xs font-semibold gap-1.5 shadow-sm transition-colors',
                conflictCheckResult?.hasCritical
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25 animate-pulse'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              )}
            >
              <AlertTriangle className={cn('h-4 w-4', isScanningConflicts && 'animate-spin')} />
              {isScanningConflicts ? 'Đang quét...' : 'Xung đột Mod'}
              {conflictCheckResult?.criticalCount ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                  {conflictCheckResult.criticalCount}
                </span>
              ) : null}
            </Button>

            <Button
              onClick={handleOpenDepInspector}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors shadow-sm text-xs font-semibold gap-1.5"
            >
              <ShieldCheck className="h-4 w-4 text-primary" />
              Kiểm tra & Sửa Mod
            </Button>

            <Button
              onClick={() => void refetchMods()}
              disabled={loading}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Làm mới
            </Button>

            <Button
              onClick={handleOpenFolder}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 text-xs gap-1.5"
            >
              <Box className="h-3.5 w-3.5 text-primary" />
              Thư mục
            </Button>
          </>
        }
      />

      {/* ─── Prominent Updates Banner ────────────────────────────────────────────── */}
      {updateCheckResult && updateCheckResult.updatesAvailableCount > 0 && (
        <div className="p-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 shadow-lg flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Zap size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-200">
                Phát hiện {updateCheckResult.updatesAvailableCount} bản cập nhật Mod mới!
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Các bản cập nhật đã được đối soát tương thích chuẩn cho Minecraft {minecraftVersion || '1.20.1'}.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={isUpdatingAll}
            onClick={handleUpdateAllMods}
            className="h-8 px-4 text-xs font-bold gap-1.5 shadow-md shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shrink-0"
          >
            {isUpdatingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang cập nhật {updateCheckResult.updatesAvailableCount} mod...
              </>
            ) : (
              <>
                <Zap size={14} />
                Cập nhật tất cả ({updateCheckResult.updatesAvailableCount} mods)
              </>
            )}
          </Button>
        </div>
      )}

      {/* ─── Filter Bar: Search Input & Segmented Status Tabs ─────────────────────── */}
      <ScreenFilterBar<'', 'all' | 'enabled' | 'disabled' | 'updates'>
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm kiếm theo tên file, tên mod, modId (VD: sodium, ferritecore)..."
        filterTabs={filterTabs}
        activeTabKey={filterStatus}
        onTabSelect={setFilterStatus}
      />

      {/* ─── Mod List (DropZone Wrapped) ────────────────────────────────────────── */}
      <DropZone accept={['jar']} onDropFiles={handleDropImport} label="Thả file .jar vào đây để cài đặt Mod">
        <AsyncStateWrapper
          loading={loading && mods.length === 0}
          loadingMessage="Đang quét danh sách mods trong thư mục..."
          isEmpty={filteredMods.length === 0}
          emptyIcon={<Box size={36} className="text-zinc-600" />}
          emptyTitle={searchTerm ? 'Không tìm thấy mod nào' : 'Chưa cài đặt mod nào'}
          emptyDescription={
            searchTerm
              ? `Không có mod nào khớp với từ khóa "${searchTerm}".`
              : 'Kéo thả file .jar vào khung trên để thêm mod vào cấu hình.'
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
              {filteredMods.map((mod) => {
                const isOperating = operatingMods.has(mod.path)
                const isEnabled = mod.status === 'enabled'
                const updateItem =
                  updatesMap.get(mod.name.toLowerCase()) ||
                  (mod.metadata?.modId ? updatesMap.get(mod.metadata.modId.toLowerCase()) : undefined)
                const isUpdatingThis = updateItem && updatingModIds.has(updateItem.modId)
                const metaLine = [mod.metadata?.modId, mod.metadata?.version].filter(Boolean).join(' · ')

                return (
                  <ContentItemCard
                    key={mod.path}
                    disabled={!isEnabled}
                    highlighted={!!updateItem}
                    icon={
                      updateItem ? (
                        <ArrowUpCircle size={18} className="animate-pulse" />
                      ) : isEnabled ? (
                        <Box size={18} />
                      ) : (
                        <PowerOff size={18} />
                      )
                    }
                    iconClassName={
                      isEnabled
                        ? updateItem
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-zinc-800/80 text-zinc-500 border-zinc-700'
                    }
                    title={mod.name}
                    badges={
                      <>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.2 rounded-md border',
                            isEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          )}
                        >
                          {isEnabled ? 'Đang bật' : 'Đã tắt'}
                        </span>

                        {updateItem && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                            <ArrowUpCircle size={10} />
                            Bản mới: v{updateItem.newVersion}
                          </span>
                        )}

                        {loadingMeta.has(mod.path) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            Đang đọc...
                          </span>
                        ) : mod.metadata?.loader && mod.metadata.loader !== 'unknown' ? (
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700 capitalize">
                            {mod.metadata.loader}
                          </span>
                        ) : null}
                      </>
                    }
                    metaLine={
                      <>
                        {metaLine && (
                          <>
                            <span className="truncate max-w-[200px] font-mono text-zinc-400 text-[11px]">
                              {metaLine}
                            </span>
                            <span className="text-zinc-700">·</span>
                          </>
                        )}
                        <span className="font-semibold text-zinc-300 text-[11px]">
                          {formatSize(mod.sizeBytes)}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-zinc-400 text-[11px]">{formatDate(mod.updatedAt)}</span>
                      </>
                    }
                    actions={
                      <>
                        {updateItem && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedChangelogMod(updateItem)}
                              className="h-8 px-2 text-xs bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-200 hover:bg-zinc-800 gap-1 rounded-md"
                              title="Xem nhật ký thay đổi"
                            >
                              <FileText size={12} />
                              Log
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isUpdatingThis}
                              onClick={() => handleUpdateSingleMod(updateItem)}
                              className="h-8 px-2.5 text-xs font-bold gap-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-md"
                              title="Cập nhật bản mới"
                            >
                              {isUpdatingThis ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <ArrowUpCircle size={12} />
                              )}
                              Cập nhật
                            </Button>
                          </div>
                        )}

                        <Button
                          disabled={isOperating}
                          onClick={() => handleToggleMod(mod)}
                          variant="outline"
                          size="icon-sm"
                          className={cn(
                            'h-8 w-8 rounded-md border transition-all',
                            isEnabled
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                              : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                          )}
                          title={isEnabled ? 'Bấm để tắt mod' : 'Bấm để bật mod'}
                        >
                          {isEnabled ? (
                            <Power size={13} className="text-emerald-400" />
                          ) : (
                            <PowerOff size={13} className="text-amber-400" />
                          )}
                        </Button>

                        <Button
                          disabled={isOperating}
                          onClick={() => handleDeleteMod(mod)}
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8 bg-zinc-800/80 border-zinc-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 rounded-md transition-all"
                          title="Xóa mod này"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </>
                    }
                  />
                )
              })}
            </div>
          </div>
        </AsyncStateWrapper>
      </DropZone>

      {/* ─── Mod Changelog Modal ────────────────────────────────────────────────── */}
      <ModChangelogModal
        updateItem={selectedChangelogMod}
        onClose={() => setSelectedChangelogMod(null)}
        onUpdate={handleUpdateSingleMod}
        isUpdating={!!selectedChangelogMod && updatingModIds.has(selectedChangelogMod.modId)}
      />

      {/* ─── Mod Conflict & Crash Predictor Modal ───────────────────────────────── */}
      <ModConflictModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflictResult={conflictCheckResult}
        isScanning={isScanningConflicts}
        onRescan={handleOpenConflictChecker}
        onResolve={handleResolveConflict}
        onResolveAllCritical={handleResolveAllCriticalConflicts}
        isResolving={isResolvingConflict}
      />

      {/* ─── Mod Dependency Inspector Modal ────────────────────────────────────── */}
      <ModDependencyModal
        isOpen={depModalOpen}
        onClose={() => setDepModalOpen(false)}
        profileName={profileName}
        isScanning={isScanningDeps}
        isFixing={isFixingDeps}
        scanResult={depScanResult}
        fixResult={fixResult}
        onRescan={handleOpenDepInspector}
        onAutoFix={handleAutoFixDependencies}
      />
    </div>
  )
}

export default ModsScreen
