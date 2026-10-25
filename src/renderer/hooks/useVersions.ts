import { useState, useMemo } from 'react'
import type { MinecraftVersionCatalog, MinecraftVersionItem } from '@/shared/types'
import { launcherClient } from '../services/launcherClient'
import { useConfirm } from '../components/ui/ConfirmDialogContext'
import { useToast } from '../components/ui/Toast'
import { Box, FlaskConical, HardDrive, History } from 'lucide-react'
import type { FilterCategoryOption } from '../components/common/ScreenFilterBar'

export type VersionTabKey = 'releases' | 'snapshots' | 'installed' | 'old_beta' | 'old_alpha'

export const VERSION_CATEGORIES: FilterCategoryOption<VersionTabKey>[] = [
  {
    key: 'releases',
    title: 'Bản chính thức (Releases)',
    subtitle: 'Phiên bản hoàn thiện từ Mojang',
    icon: Box,
    badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  },
  {
    key: 'snapshots',
    title: 'Bản thử nghiệm (Snapshots)',
    subtitle: 'Bản beta, preview cập nhật sớm',
    icon: FlaskConical,
    badgeColor: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  },
  {
    key: 'installed',
    title: 'Đã cài trên máy (Installed)',
    subtitle: 'Phiên bản sẵn sàng chơi offline',
    icon: HardDrive,
    badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  },
  {
    key: 'old_beta',
    title: 'Phiên bản Old Beta',
    subtitle: 'Minecraft thời kỳ Beta (2010 - 2011)',
    icon: History,
    badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  },
  {
    key: 'old_alpha',
    title: 'Phiên bản Old Alpha',
    subtitle: 'Minecraft thời kỳ Alpha & Classic',
    icon: History,
    badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  },
]

export function getEstimatedJavaVersion(versionId: string): string {
  // Minecraft 26.x và snapshots 26w yêu cầu Java 25
  if (/^26(?:\.|$)/.test(versionId) || /^26w/i.test(versionId)) {
    return 'Java 25'
  }
  // Snapshots 24w, 25w
  if (/^(?:24w|25w)/i.test(versionId)) {
    return 'Java 21+'
  }

  const match = versionId.match(/^1\.(\d+)(?:\.(\d+))?/)
  if (match) {
    const minor = parseInt(match[1], 10)
    const patch = parseInt(match[2] || '0', 10)
    if (minor >= 26) return 'Java 25'
    if (minor > 20 || (minor === 20 && patch >= 5)) return 'Java 21+'
    if (minor >= 18) return 'Java 17+'
    if (minor >= 17) return 'Java 16'
    return 'Java 8+'
  }
  return 'Java 8+'
}

export function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return null
  }
}

interface UseVersionsProps {
  catalog: MinecraftVersionCatalog | null
  gameDir: string
  onCreateProfile: (versionItem?: MinecraftVersionItem) => void
  onRefresh?: () => void
}

export function useVersions({
  catalog,
  gameDir,
  onCreateProfile,
  onRefresh,
}: UseVersionsProps) {
  const [activeTab, setActiveTab] = useState<VersionTabKey>('releases')
  const [searchTerm, setSearchTerm] = useState('')
  const confirm = useConfirm()
  const { showToast } = useToast()

  const installedCount = catalog?.all.filter((v) => v.isInstalled).length || 0

  const rawList = useMemo(() => {
    if (!catalog) return []
    switch (activeTab) {
      case 'releases':
        return catalog.releases
      case 'snapshots':
        return catalog.snapshots
      case 'installed':
        return catalog.all.filter((v) => v.isInstalled)
      case 'old_beta':
        return catalog.oldBeta
      case 'old_alpha':
        return catalog.oldAlpha
      default:
        return catalog.releases
    }
  }, [activeTab, catalog])

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return rawList
    return rawList.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.type && v.type.toLowerCase().includes(q))
    )
  }, [rawList, searchTerm])

  const categoriesWithOptions = useMemo(() => {
    return VERSION_CATEGORIES.map((cat) => {
      const count =
        cat.key === 'releases'
          ? catalog?.releases.length || 0
          : cat.key === 'snapshots'
          ? catalog?.snapshots.length || 0
          : cat.key === 'installed'
          ? installedCount
          : cat.key === 'old_beta'
          ? catalog?.oldBeta.length || 0
          : catalog?.oldAlpha.length || 0
      return { ...cat, count }
    })
  }, [catalog, installedCount])

  const handleOpenVersionsFolder = async () => {
    if (!gameDir) return
    const firstInstalled = catalog?.all.find((v) => v.isInstalled && v.path)
    if (firstInstalled?.path) {
      await launcherClient.openVersionFolder(firstInstalled.path)
    } else {
      await launcherClient.openVersionFolder(gameDir)
    }
  }

  const handleDeleteVersion = async (v: MinecraftVersionItem) => {
    if (!v.path) return
    const isOk = await confirm({
      message: `Bạn có chắc muốn xóa bản cài đặt ${v.name}?`,
      isDestructive: true,
    })
    if (!isOk) return
    try {
      await launcherClient.deleteVersion(v.path)
      showToast('success', `Đã xóa bản cài đặt ${v.name}`)
      onRefresh?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Không thể xóa phiên bản: ${msg}`)
    }
  }

  const handleOpenSpecificVersionFolder = async (path: string) => {
    await launcherClient.openVersionFolder(path)
  }

  return {
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
    onCreateProfile,
  }
}
