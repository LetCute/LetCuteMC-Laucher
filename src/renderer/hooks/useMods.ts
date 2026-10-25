import { useState, useEffect, useRef, useMemo } from 'react'
import type {
  GameContentItem,
  GameContentMetadata,
  ModDependencyScanResult,
  AutoFixDependenciesResult,
  ModUpdateItem,
  ModUpdateCheckResult,
  ModConflictCheckResult,
  ResolveConflictOption,
} from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { queryCache, CACHE_TTL } from '../services/queryCache'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { useToast } from '../components/ui/Toast'

interface UseModsProps {
  gameDir: string
  minecraftVersion?: string
}

const META_CONCURRENCY = 4

export function useMods({ gameDir, minecraftVersion }: UseModsProps) {
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [mods, setMods] = useState<GameContentItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled' | 'updates'>('all')
  const [loading, setLoading] = useState(false)
  const [operatingMods, setOperatingMods] = useState<Set<string>>(new Set())
  const [loadingMeta, setLoadingMeta] = useState<Set<string>>(new Set())
  const metaGen = useRef(0)

  // Dependency Inspector State
  const [depModalOpen, setDepModalOpen] = useState(false)
  const [isScanningDeps, setIsScanningDeps] = useState(false)
  const [isFixingDeps, setIsFixingDeps] = useState(false)
  const [depScanResult, setDepScanResult] = useState<ModDependencyScanResult | null>(null)
  const [fixResult, setFixResult] = useState<AutoFixDependenciesResult | null>(null)

  // Mod Auto-Updater State
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isUpdatingAll, setIsUpdatingAll] = useState(false)
  const [updatingModIds, setUpdatingModIds] = useState<Set<string>>(new Set())
  const [updateCheckResult, setUpdateCheckResult] = useState<ModUpdateCheckResult | null>(null)
  const [selectedChangelogMod, setSelectedChangelogMod] = useState<ModUpdateItem | null>(null)

  // Mod Conflict & Crash Predictor State
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [isScanningConflicts, setIsScanningConflicts] = useState(false)
  const [isResolvingConflict, setIsResolvingConflict] = useState(false)
  const [conflictCheckResult, setConflictCheckResult] = useState<ModConflictCheckResult | null>(null)

  // Progressive metadata loader — reads from queryCache first (cache-forever per path)
  const loadMetadataProgressive = (list: GameContentItem[]) => {
    const gen = ++metaGen.current
    // Only load items that aren't already cached
    const queue = list.filter(
      (m) =>
        !m.metadata &&
        (m.path.endsWith('.jar') || m.path.endsWith('.jar.disabled')) &&
        !queryCache.has(`mod-meta:${m.path}`)
    )

    // Apply already-cached metadata immediately without showing loading state
    const cached = list.filter(
      (m) =>
        !m.metadata &&
        (m.path.endsWith('.jar') || m.path.endsWith('.jar.disabled')) &&
        queryCache.has(`mod-meta:${m.path}`)
    )
    if (cached.length > 0) {
      setMods((prev) =>
        prev.map((m) => {
          const cacheKey = `mod-meta:${m.path}`
          if (queryCache.has(cacheKey)) {
            const cachedMeta = queryCache['store'].get(cacheKey)?.data as GameContentMetadata | undefined
            return cachedMeta ? { ...m, metadata: cachedMeta } : m
          }
          return m
        })
      )
    }

    if (queue.length === 0) return

    setLoadingMeta(new Set(queue.map((m) => m.path)))

    let idx = 0
    const worker = async () => {
      while (idx < queue.length) {
        if (metaGen.current !== gen) return
        const item = queue[idx++]
        try {
          const meta: GameContentMetadata = await queryCache.get(
            `mod-meta:${item.path}`,
            () => launcherClient.getModMetadata(item.path),
            CACHE_TTL.MOD_META
          )
          if (metaGen.current !== gen) return
          setMods((prev) => prev.map((m) => (m.path === item.path ? { ...m, metadata: meta } : m)))
        } catch {
          // ignore individual failures
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

    void Promise.all(
      Array.from({ length: Math.min(META_CONCURRENCY, queue.length) }, () => worker())
    )
  }

  const fetchMods = async (force = false) => {
    if (!gameDir) return
    const cacheKey = `mods:${gameDir}`

    // Use cached scan on tab-revisit unless forced (after delete/toggle/import)
    if (!force && queryCache.has(cacheKey)) {
      const cached = queryCache['store'].get(cacheKey)?.data as GameContentItem[] | undefined
      if (cached) {
        setMods(cached)
        loadMetadataProgressive(cached)
        return
      }
    }

    setLoading(true)
    metaGen.current++
    setLoadingMeta(new Set())
    try {
      const list = await queryCache.get(cacheKey, () => launcherClient.scanMods(gameDir), CACHE_TTL.SCAN)
      setMods(list)
      loadMetadataProgressive(list)
    } catch (e) {
      console.error('Failed to load mods:', e)
      showToast('error', 'Không thể quét danh sách mod. Kiểm tra lại thư mục game.')
    } finally {
      setLoading(false)
    }
  }

  /** Force-refresh: clears scan cache for this gameDir then re-fetches */
  const refetchMods = async () => {
    queryCache.invalidate(`mods:${gameDir}`)
    await fetchMods(true)
  }

  useEffect(() => {
    void fetchMods()
    return () => {
      metaGen.current++
    }
  }, [gameDir])

  const handleToggleMod = async (mod: GameContentItem) => {
    setOperatingMods((prev) => new Set(prev).add(mod.path))
    try {
      if (mod.status === 'enabled') await launcherClient.disableGameContent(gameDir, mod.path)
      else await launcherClient.enableGameContent(gameDir, mod.path)
      await refetchMods()
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

  const handleDeleteMod = async (mod: GameContentItem) => {
    if (!(await confirm({ message: `Bạn chắc chắn muốn xóa "${mod.name}"?`, isDestructive: true })))
      return
    setOperatingMods((prev) => new Set(prev).add(mod.path))
    try {
      await launcherClient.deleteGameContent(gameDir, mod.path)
      // Invalidate mod metadata cache for deleted file
      queryCache.invalidate(`mod-meta:${mod.path}`)
      await refetchMods()
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
    await refetchMods()
  }

  const handleOpenFolder = async () => {
    if (gameDir) await launcherClient.openContentFolder(gameDir, 'mod')
  }

  // Conflict Checker
  const handleOpenConflictChecker = async () => {
    if (!gameDir) return
    setConflictModalOpen(true)
    setIsScanningConflicts(true)
    try {
      const res = await launcherClient.checkModConflicts(gameDir, minecraftVersion || '1.20.1')
      setConflictCheckResult(res)
    } catch (e) {
      console.error('Failed to check mod conflicts:', e)
      showToast('error', 'Không thể quét xung đột mod.')
    } finally {
      setIsScanningConflicts(false)
    }
  }

  const handleResolveConflict = async (option: ResolveConflictOption) => {
    if (!gameDir) return
    setIsResolvingConflict(true)
    try {
      const res = await launcherClient.resolveModConflict(gameDir, option, minecraftVersion)
      if (res.success) {
        showToast('success', res.message)
        await refetchMods()
        const refreshed = await launcherClient.checkModConflicts(
          gameDir,
          minecraftVersion || '1.20.1'
        )
        setConflictCheckResult(refreshed)
      } else {
        showToast('error', res.message)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Có lỗi xảy ra khi xử lý xung đột.'
      showToast('error', message)
    } finally {
      setIsResolvingConflict(false)
    }
  }

  const handleResolveAllCriticalConflicts = async () => {
    if (!gameDir || !conflictCheckResult?.conflicts) return
    setIsResolvingConflict(true)
    try {
      const res = await launcherClient.resolveAllCriticalConflicts(
        gameDir,
        conflictCheckResult.conflicts,
        minecraftVersion || '1.20.1'
      )
      if (res.success) {
        showToast('success', res.message)
        await refetchMods()
        const refreshed = await launcherClient.checkModConflicts(
          gameDir,
          minecraftVersion || '1.20.1'
        )
        setConflictCheckResult(refreshed)
      } else {
        showToast('error', res.message)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Có lỗi khi tự động giải quyết xung đột.'
      showToast('error', message)
    } finally {
      setIsResolvingConflict(false)
    }
  }

  // Dependency Inspector
  const handleOpenDepInspector = async () => {
    if (!gameDir) return
    setDepModalOpen(true)
    setIsScanningDeps(true)
    setFixResult(null)
    try {
      const result = await launcherClient.inspectModDependencies(
        gameDir,
        minecraftVersion || '1.20.1'
      )
      setDepScanResult(result)
    } catch (e) {
      console.error('Failed to scan dependencies:', e)
      showToast('error', 'Không thể kiểm tra mod phụ thuộc.')
    } finally {
      setIsScanningDeps(false)
    }
  }

  const handleAutoFixDependencies = async () => {
    if (!gameDir) return
    setIsFixingDeps(true)
    try {
      const res = await launcherClient.autoFixModDependencies(
        gameDir,
        minecraftVersion || '1.20.1'
      )
      setFixResult(res)
      if (res.fixedCount > 0) {
        showToast('success', `Đã tự động tải ${res.fixedCount} mod phụ thuộc thành công!`)
        await refetchMods()
        const newScan = await launcherClient.inspectModDependencies(
          gameDir,
          minecraftVersion || '1.20.1'
        )
        setDepScanResult(newScan)
      } else if (res.unresolvedMods?.length > 0) {
        showToast('error', 'Một số mod phụ thuộc không thể tải tự động.')
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi khi tự động sửa dependencies.'
      showToast('error', message)
    } finally {
      setIsFixingDeps(false)
    }
  }

  // Auto Updater
  const handleCheckUpdates = async () => {
    if (!gameDir) return
    setIsCheckingUpdates(true)
    try {
      const res = await launcherClient.checkForModUpdates(
        gameDir,
        minecraftVersion || '1.20.1'
      )
      setUpdateCheckResult(res)
      if (res.updatesAvailableCount > 0) {
        showToast('success', `Tìm thấy ${res.updatesAvailableCount} bản cập nhật mod mới!`)
      } else {
        showToast('info', 'Tất cả các mod đều đang ở phiên bản mới nhất.')
      }
    } catch (e) {
      console.error('Failed to check mod updates:', e)
      showToast('error', 'Không thể kiểm tra cập nhật mod từ Modrinth.')
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handleUpdateSingleMod = async (updateItem: ModUpdateItem) => {
    if (!gameDir) return
    setUpdatingModIds((prev) => new Set(prev).add(updateItem.modId))
    try {
      const res = await launcherClient.updateSingleMod(gameDir, updateItem)
      if (res.success) {
        showToast('success', `Đã cập nhật ${updateItem.modName} lên v${updateItem.newVersion}!`)
        await refetchMods()
        setUpdateCheckResult((prev) => {
          if (!prev) return null
          const nextItems = prev.updates.filter((i) => i.modId !== updateItem.modId)
          return {
            ...prev,
            updates: nextItems,
            updatesAvailableCount: nextItems.length,
          }
        })
      } else {
        showToast('error', res.error || 'Cập nhật mod thất bại.')
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi khi cập nhật mod.'
      showToast('error', message)
    } finally {
      setUpdatingModIds((prev) => {
        const n = new Set(prev)
        n.delete(updateItem.modId)
        return n
      })
    }
  }

  const handleUpdateAllMods = async () => {
    if (!gameDir || !updateCheckResult?.updates.length) return
    setIsUpdatingAll(true)
    try {
      const res = await launcherClient.updateAllMods(gameDir, updateCheckResult.updates)
      if (res.totalUpdated > 0) {
        showToast('success', `Đã cập nhật thành công ${res.totalUpdated} mods!`)
        await refetchMods()
        setUpdateCheckResult(null)
      }
      if (res.failedCount > 0) {
        showToast('error', `${res.failedCount} mods cập nhật thất bại.`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi khi cập nhật toàn bộ mod.'
      showToast('error', message)
    } finally {
      setIsUpdatingAll(false)
    }
  }

  // Computed
  const enabledCount = mods.filter((m) => m.status === 'enabled').length
  const disabledCount = mods.filter((m) => m.status === 'disabled').length
  const updatesCount = updateCheckResult?.updatesAvailableCount || 0

  const updatesMap = useMemo(() => {
    const map = new Map<string, ModUpdateItem>()
    if (updateCheckResult?.updates) {
      for (const item of updateCheckResult.updates) {
        map.set(item.modName.toLowerCase(), item)
        map.set(item.modId.toLowerCase(), item)
      }
    }
    return map
  }, [updateCheckResult])

  const filteredMods = useMemo(() => {
    return mods.filter((mod) => {
      const matchesSearch =
        mod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mod.metadata?.modId &&
          mod.metadata.modId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (mod.fileName && mod.fileName.toLowerCase().includes(searchTerm.toLowerCase()))

      if (!matchesSearch) return false

      if (filterStatus === 'enabled') return mod.status === 'enabled'
      if (filterStatus === 'disabled') return mod.status === 'disabled'
      if (filterStatus === 'updates') {
        return (
          updatesMap.has(mod.name.toLowerCase()) ||
          (mod.metadata?.modId ? updatesMap.has(mod.metadata.modId.toLowerCase()) : false)
        )
      }
      return true
    })
  }, [mods, searchTerm, filterStatus, updatesMap])

  return {
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
    fetchMods,
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
  }
}
