import { useState, useEffect, useMemo } from 'react'
import type { GameContentItem, GameContentType } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { queryCache, CACHE_TTL } from '../services/queryCache'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { useToast } from '../components/ui/Toast'

interface UseGameContentProps {
  gameDir: string
  type: GameContentType
  itemTypeName: string
}

const SCAN_FN: Record<
  string,
  (gameDir: string) => Promise<GameContentItem[]>
> = {
  resource_pack: (dir) => launcherClient.scanResourcePacks(dir),
  shader_pack: (dir) => launcherClient.scanShaderPacks(dir),
  mod: (dir) => launcherClient.scanMods(dir),
}

export function useGameContent({
  gameDir,
  type,
  itemTypeName,
}: UseGameContentProps) {
  const [items, setItems] = useState<GameContentItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [operatingItems, setOperatingItems] = useState<Set<string>>(new Set())
  const confirm = useConfirm()
  const { showToast } = useToast()

  const cacheKey = `${type}:${gameDir}`

  const fetchItems = async (force = false) => {
    if (!gameDir) return

    // Serve from cache on revisit unless forced
    if (!force && queryCache.has(cacheKey)) {
      const cached = queryCache['store'].get(cacheKey)?.data as
        | GameContentItem[]
        | undefined
      if (cached) {
        setItems(cached)
        return
      }
    }

    setLoading(true)
    try {
      const scanFn = SCAN_FN[type]
      if (!scanFn) return
      const list = await queryCache.get(cacheKey, () => scanFn(gameDir), CACHE_TTL.SCAN)
      setItems(list)
    } catch (e) {
      console.error(`Failed to load ${type}:`, e)
      showToast('error', `Không thể tải danh sách ${itemTypeName}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const refetchItems = async () => {
    queryCache.invalidate(cacheKey)
    await fetchItems(true)
  }

  useEffect(() => {
    void fetchItems()
  }, [gameDir, type])

  const handleDelete = async (item: GameContentItem) => {
    if (
      !(await confirm({
        message: `Bạn chắc chắn muốn xóa ${itemTypeName} "${item.name}"?`,
        isDestructive: true,
      }))
    )
      return

    setOperatingItems((prev) => new Set(prev).add(item.path))
    try {
      await launcherClient.deleteGameContent(gameDir, item.path)
      showToast('success', `Đã xóa ${itemTypeName} "${item.name}"`)
      await refetchItems()
    } catch (e) {
      console.error(e)
      showToast('error', `Lỗi xóa ${itemTypeName}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setOperatingItems((prev) => {
        const n = new Set(prev)
        n.delete(item.path)
        return n
      })
    }
  }

  const handleDropImport = async (paths: string[]) => {
    let imported = 0
    let failed = 0
    for (const p of paths) {
      try {
        await launcherClient.importGameContent({ gameDir, sourcePath: p, type })
        imported++
      } catch (e) {
        console.error(e)
        failed++
      }
    }
    if (failed > 0) {
      showToast('error', `Thêm thất bại ${failed} tệp ${itemTypeName}.`)
    } else if (imported > 0) {
      showToast('success', `Đã thêm thành công ${imported} ${itemTypeName}`)
    }
    await refetchItems()
  }

  const handleOpenFolder = async () => {
    if (gameDir) {
      await launcherClient.openContentFolder(gameDir, type)
    }
  }

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.fileName && item.fileName.toLowerCase().includes(q))
    )
  }, [items, searchTerm])

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return 'Thư mục'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('vi-VN')

  return {
    items,
    filteredItems,
    searchTerm,
    setSearchTerm,
    loading,
    operatingItems,
    fetchItems: refetchItems,
    handleDelete,
    handleDropImport,
    handleOpenFolder,
    formatSize,
    formatDate,
  }
}
