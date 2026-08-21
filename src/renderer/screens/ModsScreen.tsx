import { useState, useEffect, useRef } from 'react'
import { Box, Trash2, Power, PowerOff, RefreshCw, Search, Loader2, ShieldCheck, AlertCircle, CheckCircle2, Download, Sparkles } from 'lucide-react'
import type { GameContentItem, GameContentMetadata, ModDependencyScanResult, AutoFixDependenciesResult } from '../../shared/types'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { launcherClient } from '../services/launcherClient'
import { Button } from '../components/ui/button'
import { DropZone } from '../components/ui/DropZone'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { Modal } from '../components/ui/Modal'

interface ModsScreenProps {
  gameDir: string
  profileName?: string
  minecraftVersion?: string
}


const META_CONCURRENCY = 4

export const ModsScreen = ({ gameDir, profileName, minecraftVersion }: ModsScreenProps) => {
  const [mods, setMods] = useState<GameContentItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [loading, setLoading] = useState(false)
  const [operatingMods, setOperatingMods] = useState<Set<string>>(new Set())
  const [loadingMeta, setLoadingMeta] = useState<Set<string>>(new Set())
  const metaGen = useRef(0)
  const confirm = useConfirm()

  // Dependency Inspector State
  const [depModalOpen, setDepModalOpen] = useState(false)
  const [isScanningDeps, setIsScanningDeps] = useState(false)
  const [isFixingDeps, setIsFixingDeps] = useState(false)
  const [depScanResult, setDepScanResult] = useState<ModDependencyScanResult | null>(null)
  const [fixResult, setFixResult] = useState<AutoFixDependenciesResult | null>(null)

  const handleOpenDepInspector = async () => {
    if (!gameDir) return
    setDepModalOpen(true)
    setIsScanningDeps(true)
    setFixResult(null)
    try {
      const res = await launcherClient.inspectModDependencies(gameDir, minecraftVersion || '1.20.1')
      setDepScanResult(res)
    } catch (e) {
      console.error('Failed to inspect mod dependencies:', e)
    } finally {
      setIsScanningDeps(false)
    }
  }

  const handleAutoFix = async () => {
    if (!gameDir) return
    setIsFixingDeps(true)
    setFixResult(null)
    try {
      const res = await launcherClient.autoFixModDependencies(gameDir, minecraftVersion || '1.20.1')
      setFixResult(res)
      await fetchMods()
      // Re-scan
      const newScan = await launcherClient.inspectModDependencies(gameDir, minecraftVersion || '1.20.1')
      setDepScanResult(newScan)
    } catch (e) {
      console.error('Failed to auto-fix mod dependencies:', e)
    } finally {
      setIsFixingDeps(false)
    }
  }

  const loadMetadataProgressive = (list: GameContentItem[]) => {
    const gen = ++metaGen.current
    const queue = list.filter((m) => m.path.endsWith('.jar') || m.path.endsWith('.jar.disabled'))
    if (queue.length === 0) return

    setLoadingMeta(new Set(queue.map((m) => m.path)))

    let idx = 0
    const worker = async () => {
      while (idx < queue.length) {
        if (metaGen.current !== gen) return
        const item = queue[idx++]
        try {
          const meta: GameContentMetadata = await launcherClient.getModMetadata(item.path)
          if (metaGen.current !== gen) return
          setMods((prev) => prev.map((m) => (m.path === item.path ? { ...m, metadata: meta } : m)))
        } catch {
          // keep unknown
        } finally {
          if (metaGen.current === gen) {
            setLoadingMeta((prev) => {
              const n = new Set(prev)
              n.delete(item.path)
              return n
            })
          }
        }
      }
    }

    void Promise.all(Array.from({ length: Math.min(META_CONCURRENCY, queue.length) }, () => worker()))
  }

  const fetchMods = async () => {
    if (!gameDir) return
    setLoading(true)
    metaGen.current++
    setLoadingMeta(new Set())
    try {
      const list = await launcherClient.scanMods(gameDir)
      setMods(list)
      loadMetadataProgressive(list)
    } catch (e) {
      console.error('Failed to load mods:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMods()
    return () => {
      metaGen.current++
    }
  }, [gameDir])

  const handleRefresh = async () => {
    await fetchMods()
  }

  const handleOpenFolder = async () => {
    if (gameDir) await launcherClient.openContentFolder(gameDir, 'mod')
  }

  const handleToggleMod = async (mod: GameContentItem) => {
    setOperatingMods((prev) => new Set(prev).add(mod.path))
    try {
      if (mod.status === 'enabled') await launcherClient.disableGameContent(gameDir, mod.path)
      else await launcherClient.enableGameContent(gameDir, mod.path)
      await fetchMods()
    } catch (e) {
      console.error(e)
    } finally {
      setOperatingMods((prev) => {
        const n = new Set(prev)
        n.delete(mod.path)
        return n
      })
    }
  }

  const handleDelete = async (mod: GameContentItem) => {
    if (!(await confirm({ message: 'Bạn chắc chắn muốn xóa?', isDestructive: true }))) return
    setOperatingMods((prev) => new Set(prev).add(mod.path))
    try {
      await launcherClient.deleteGameContent(gameDir, mod.path)
      await fetchMods()
    } catch (e) {
      console.error(e)
    } finally {
      setOperatingMods((prev) => {
        const n = new Set(prev)
        n.delete(mod.path)
        return n
      })
    }
  }

  const handleDropImport = async (paths: string[]) => {
    for (const p of paths) {
      try {
        await launcherClient.importGameContent({ gameDir, sourcePath: p, type: 'mod' })
      } catch (e) {
        console.error(e)
      }
    }
    await fetchMods()
  }


  const filteredMods = mods.filter((mod) => {
    const matchesSearch = mod.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'enabled' && mod.status === 'enabled') ||
      (filterStatus === 'disabled' && mod.status === 'disabled')
    return matchesSearch && matchesFilter
  })

  const enabledCount = mods.filter((m) => m.status === 'enabled').length
  const disabledCount = mods.filter((m) => m.status === 'disabled').length

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('vi-VN')

  const missingDeps = depScanResult?.missingDependencies || []
  const hasMissing = missingDeps.length > 0

  return (
    <div className="px-6 pt-2 pb-6 flex flex-col h-full gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground/80">
            Quản lý Mods {profileName && <span className="text-sm font-normal text-muted-foreground ml-2 px-2 py-0.5 bg-accent/30 rounded-md">Cấu hình: {profileName}</span>}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tổng: {mods.length} · <span className="text-emerald-400">{enabledCount} bật</span> ·{' '}
            <span className="text-amber-400">{disabledCount} tắt</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenDepInspector}
            variant="outline"
            size="sm"
            className="h-9 px-3 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors shadow-sm"
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
            Kiểm tra & Sửa Mod
          </Button>
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm" className="h-9 px-3 bg-background/50 backdrop-blur-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button onClick={handleOpenFolder} variant="outline" size="sm" className="h-9 px-3 bg-background/50 backdrop-blur-sm">
            <Box className="h-3.5 w-3.5" />
            Thư mục
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <Input
            className='bg-background/50 backdrop-blur-sm'
            type="text"
            placeholder="Tìm kiếm mods..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'enabled', 'disabled'] as const).map((s) => (
            <Button
              key={s}
              onClick={() => setFilterStatus(s)}
              variant={filterStatus === s ? 'primary' : 'outline'}
              size="sm"
              className="h-8 px-3 rounded-lg text-xs"
            >
              {s === 'all' ? 'Tất cả' : s === 'enabled' ? 'Bật' : 'Tắt'}
            </Button>
          ))}
        </div>
      </div>

      <DropZone accept={['jar']} onDropFiles={handleDropImport} label="Thả file .jar">
        {filteredMods.length > 0 ? (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {filteredMods.map((mod) => {
                const isOperating = operatingMods.has(mod.path)
                const metaLine = [mod.metadata?.modId, mod.metadata?.version].filter(Boolean).join(' · ')
                return (
                  <div
                    key={mod.path}
                    className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary/50 hover:bg-accent/40 transition"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{mod.name}</span>
                        <Badge variant={mod.status === 'enabled' ? 'success' : 'secondary'}>
                          {mod.status === 'enabled' ? 'Bật' : 'Tắt'}
                        </Badge>
                        {loadingMeta.has(mod.path) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loader...
                          </span>
                        ) : mod.metadata?.loader && mod.metadata.loader !== 'unknown' ? (
                          <Badge variant="info" className="capitalize">
                            {mod.metadata.loader}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        {metaLine ? <span className="truncate max-w-[240px]">{metaLine}</span> : null}
                        {metaLine ? <span>·</span> : null}
                        <span>{formatSize(mod.sizeBytes)}</span>
                        <span>·</span>
                        <span>{formatDate(mod.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        disabled={isOperating}
                        onClick={() => handleToggleMod(mod)}
                        variant="secondary"
                        size="sm"
                        title={mod.status === 'enabled' ? 'Tắt' : 'Bật'}
                      >
                        {mod.status === 'enabled' ? <PowerOff size={14} /> : <Power size={14} />}
                      </Button>
                      <Button
                        disabled={isOperating}
                        onClick={() => handleDelete(mod)}
                        variant="secondary"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Box size={32} />}
            title="Chưa cài mod nào"
            description="Kéo thả file .jar vào đây để thêm mod."
          />
        )}
      </DropZone>

      {/* ─── Mod Dependency Inspector Modal ────────────────────────────────────── */}
      <Modal
        isOpen={depModalOpen}
        onClose={() => setDepModalOpen(false)}
        title="Kiểm tra & Tự động sửa Mod (Inspector & Auto-Fixer)"
        description={`Phân tích cây phụ thuộc của các mod trong cấu hình: ${profileName || 'Hiện tại'}`}
        maxWidth="max-w-[700px]"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDepInspector}
              disabled={isScanningDeps || isFixingDeps}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isScanningDeps ? 'animate-spin' : ''}`} />
              Quét lại
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDepModalOpen(false)}>
                Đóng
              </Button>
              {hasMissing && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAutoFix}
                  disabled={isFixingDeps || isScanningDeps}
                  className="shadow-md shadow-primary/20"
                >
                  {isFixingDeps ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải & sửa...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Tự động tải {missingDeps.length} mod thiếu
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 py-1">
          {isScanningDeps ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Đang trích xuất metadata và phân tích các mod...</p>
            </div>
          ) : (
            <>
              {/* Fix Notification */}
              {fixResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 text-sm ${fixResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                >
                  {fixResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{fixResult.message}</p>
                    {fixResult.downloadedMods.length > 0 && (
                      <ul className="mt-1 list-disc list-inside text-xs opacity-90">
                        {fixResult.downloadedMods.map((dm, i) => (
                          <li key={i}>{dm.title} ({dm.fileName})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Status Banner */}
              {!hasMissing ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-300">Tất cả Mod đã đầy đủ</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Đã quét {depScanResult?.totalMods || 0} mod. Toàn bộ các mod phụ thuộc (dependencies) cần thiết đều đã được cài đặt.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-300">
                      Phát hiện {missingDeps.length} mod phụ thuộc còn thiếu
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Nếu không cài các mod này, game có thể bị crash khi khởi chạy. Bạn có thể bấm nút Tự động tải bên dưới để sửa nhanh.
                    </p>
                  </div>
                </div>
              )}

              {/* Missing Dependencies List */}
              {hasMissing && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Danh sách Mod cần bổ sung
                  </h4>
                  <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                    {missingDeps.map((dep, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:border-primary/40 transition"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              {dep.resolvedProject?.title || dep.modId}
                            </span>
                            <Badge variant="outline" className="text-[11px] font-mono">
                              {dep.modId}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Yêu cầu bởi: <span className="text-foreground/80 font-medium">{dep.requiredBy}</span>
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {dep.resolvedProject ? (
                            <Badge variant="success" className="gap-1">
                              <Download className="h-3 w-3" />
                              Sẵn sàng tải ({dep.resolvedProject.versionNumber})
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground">
                              Không tìm thấy trên Modrinth
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
