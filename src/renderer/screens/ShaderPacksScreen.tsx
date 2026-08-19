import { useState, useEffect } from 'react'
import { Zap, Trash2, RefreshCw, Search } from 'lucide-react'
import type { GameContentItem } from '../../shared/types'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { launcherClient } from '../services/launcherClient'
import { Button } from '../components/ui/button'
import { DropZone } from '../components/ui/DropZone'

interface ShaderPacksScreenProps {
  gameDir: string
  profileName?: string
}

export const ShaderPacksScreen = ({ gameDir, profileName }: ShaderPacksScreenProps) => {
  const [packs, setPacks] = useState<GameContentItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [operatingPacks, setOperatingPacks] = useState<Set<string>>(new Set())

  const fetchPacks = async () => {
    if (!gameDir) return
    setLoading(true)
    try {
      setPacks(await launcherClient.scanShaderPacks(gameDir))
    } catch (e) {
      console.error('Failed to load shader packs:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPacks()
  }, [gameDir])

  const handleDelete = async (pack: GameContentItem) => {
    if (!confirm('Bạn chắc chắn muốn xóa?')) return
    setOperatingPacks((prev) => new Set(prev).add(pack.path))
    try {
      await launcherClient.deleteGameContent(gameDir, pack.path)
      await fetchPacks()
    } catch (e) {
      console.error(e)
    } finally {
      setOperatingPacks((prev) => {
        const n = new Set(prev)
        n.delete(pack.path)
        return n
      })
    }
  }

  const handleDropImport = async (paths: string[]) => {
    for (const p of paths) {
      try {
        await launcherClient.importGameContent({ gameDir, sourcePath: p, type: 'shader_pack' })
      } catch (e) {
        console.error(e)
      }
    }
    await fetchPacks()
  }

  const filteredPacks = packs.filter((pack) => pack.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return 'Thư mục'
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
            Shader Packs {profileName && <span className="text-sm font-normal text-muted-foreground ml-2 px-2 py-0.5 bg-accent/30 rounded-md">Cấu hình: {profileName}</span>}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tổng: <span className="text-foreground font-medium">{packs.length}</span> gói
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchPacks} disabled={loading} variant="outline" size="sm" className="h-9 px-3 bg-card">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button
            onClick={() => gameDir && launcherClient.openContentFolder(gameDir, 'shader_pack')}
            variant="outline"
            size="sm"
            className="h-9 px-3 bg-card"
          >
            <Zap className="h-3.5 w-3.5" />
            Thư mục
          </Button>
        </div>
      </div>

      <Input
        type="text"
        placeholder="Tìm kiếm shader packs..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        icon={<Search className="h-4 w-4" />}
        className='bg-card'
      />

      <DropZone accept={['zip']} onDropFiles={handleDropImport} label="Thả file .zip">
        {filteredPacks.length > 0 ? (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {filteredPacks.map((pack) => {
                const isOperating = operatingPacks.has(pack.path)
                return (
                  <div
                    key={pack.path}
                    className="group flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/40 transition"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-sm font-semibold text-foreground truncate">{pack.name}</span>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="truncate max-w-[280px]">{pack.fileName}</span>
                        <span>·</span>
                        <span>{formatSize(pack.sizeBytes)}</span>
                        <span>·</span>
                        <span>{formatDate(pack.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        disabled={isOperating}
                        onClick={() => handleDelete(pack)}
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
            icon={<Zap size={32} />}
            title="Chưa có shader pack"
            description="Kéo thả file .zip vào đây để thêm shader pack."
          />
        )}
      </DropZone>
    </div>
  )
}
