import { useState, useEffect, useRef } from 'react'
import { Box, Trash2, Power, PowerOff, RefreshCw, Search, Loader2 } from 'lucide-react'
import type { GameContentItem, GameContentMetadata } from '../../shared/types'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { launcherClient } from '../services/launcherClient'
import { Button } from '../components/ui/button'
import { DropZone } from '../components/ui/DropZone'
import { useConfirm } from '../components/ui/ConfirmDialogContext'

interface ModsScreenProps {
  gameDir: string
  profileName?: string
}

const META_CONCURRENCY = 4

export const ModsScreen = ({ gameDir, profileName }: ModsScreenProps) => {
  const [mods, setMods] = useState<GameContentItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [loading, setLoading] = useState(false)
  const [operatingMods, setOperatingMods] = useState<Set<string>>(new Set())
  const [loadingMeta, setLoadingMeta] = useState<Set<string>>(new Set())
  const metaGen = useRef(0)
  const confirm = useConfirm()

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
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm" className="h-9 px-3 bg-card">
            <RefreshCw className={`h-3.5 w-3.5  ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button onClick={handleOpenFolder} variant="outline" size="sm" className="h-9 px-3 bg-card">
            <Box className="h-3.5 w-3.5" />
            Thư mục
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <Input
            className='bg-card'
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
            <div className="flex flex-col gap-2">
              {filteredMods.map((mod) => {
                const isOperating = operatingMods.has(mod.path)
                const metaLine = [mod.metadata?.modId, mod.metadata?.version].filter(Boolean).join(' · ')
                return (
                  <div
                    key={mod.path}
                    className="group flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/40 transition"
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
    </div>
  )
}
