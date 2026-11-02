import { useState, useEffect } from 'react'
import {
  Check,
  RefreshCw,
  Loader2,
  Package,
  Layers,
  SlidersHorizontal,
  Download,
  AlertCircle,
  Gauge,
  Scale,
  Eye,
  Flame,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/button'
import type {
  LauncherProfile,
  LowEndBoostCheckResult,
  LowEndOptimizationLevel,
  OptimizeVideoSettingsOptions,
  OptimizeVideoSettingsResult,
  InstallEssentialModResult,
  InstallAllEssentialModsResult,
} from '@/shared/types'
import { launcherClient } from '../../services/launcherClient'
import { useToast } from '../ui/Toast'
import { cn } from '@/lib/utils'

interface PresetItem {
  id: LowEndOptimizationLevel
  title: string
  subtitle: string
  badge: string
  desc: string
  specs: string
  icon: typeof Gauge
}

const PRESETS: PresetItem[] = [
  {
    id: 'ultra_potato',
    title: 'Siêu Nhẹ',
    subtitle: 'Ultra Potato',
    badge: 'Máy Yếu',
    desc: 'Cắt giảm tối đa tải RAM/VRAM, tắt mây và hiệu ứng hạt nặng.',
    specs: 'Mipmap 0 • Fast • Tắt mây',
    icon: Gauge,
  },
  {
    id: 'balanced_low',
    title: 'Cân Bằng',
    subtitle: 'Balanced Low',
    badge: 'Máy Trung',
    desc: 'Cân bằng khung hình ổn định, hiển thị mây và chi tiết cơ bản.',
    specs: '8 chunks • Mipmap 1 • Fast',
    icon: Scale,
  },
  {
    id: 'high_quality',
    title: 'Chất Lượng',
    subtitle: 'High Quality',
    badge: 'Máy Khá',
    desc: 'Tầm nhìn rộng, đồ họa chi tiết và bật toàn bộ hiệu ứng hình ảnh.',
    specs: '16 chunks • Mipmap 4 • Fancy',
    icon: Eye,
  },
  {
    id: 'ultra_quality',
    title: 'Cực Đại',
    subtitle: 'Ultra Quality',
    badge: 'Máy Mạnh',
    desc: 'Thiết lập tối đa đồ họa, tận dụng GPU rời và vi xử lý đa nhân.',
    specs: '24 chunks • Mipmap 4 • Fancy tối đa',
    icon: Flame,
  },
]

interface LowEndOptimizerModalProps {
  isOpen: boolean
  onClose: () => void
  gameDir?: string
  activeProfile?: LauncherProfile | null
  onApplied?: () => void
}

export const LowEndOptimizerModal = ({
  isOpen,
  onClose,
  gameDir,
  activeProfile,
  onApplied,
}: LowEndOptimizerModalProps) => {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [installingModSlug, setInstallingModSlug] = useState<string | null>(null)
  const [installingAll, setInstallingAll] = useState(false)
  const [status, setStatus] = useState<LowEndBoostCheckResult | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<LowEndOptimizationLevel>('ultra_potato')
  const [customChunks, setCustomChunks] = useState<number>(6)

  const rawVersion = activeProfile?.minecraftVersion || '1.20.1'
  const rawLoader = activeProfile?.loader || 'fabric'

  const isVanilla =
    (!activeProfile?.loader || activeProfile.loader === 'vanilla') &&
    !rawVersion.toLowerCase().includes('fabric') &&
    !rawVersion.toLowerCase().includes('forge') &&
    !rawVersion.toLowerCase().includes('quilt') &&
    !rawVersion.toLowerCase().includes('neoforge')

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await launcherClient.checkLowEndOptimizationStatus(gameDir)
      setStatus(res)
      if (res.currentRenderDistance <= 6) {
        setCustomChunks(res.currentRenderDistance)
      } else {
        setCustomChunks(6)
      }
    } catch (e) {
      console.error('Failed to check low-end status:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchStatus()
    }
  }, [isOpen, gameDir])

  const handleApply = async () => {
    setApplying(true)
    try {
      let opts: OptimizeVideoSettingsOptions

      if (selectedLevel === 'high_quality') {
        opts = {
          gameDir,
          level: selectedLevel,
          customRenderDistance: 16,
          disableMipmap: false,
          disableClouds: false,
          fastGraphics: false,
          tuneSodium: true,
        }
      } else if (selectedLevel === 'ultra_quality') {
        opts = {
          gameDir,
          level: selectedLevel,
          customRenderDistance: 24,
          disableMipmap: false,
          disableClouds: false,
          fastGraphics: false,
          tuneSodium: true,
        }
      } else {
        opts = {
          gameDir,
          level: selectedLevel,
          customRenderDistance: customChunks,
          disableMipmap: selectedLevel === 'ultra_potato',
          disableClouds: selectedLevel === 'ultra_potato',
          fastGraphics: selectedLevel === 'ultra_potato' || selectedLevel === 'balanced_low',
          tuneSodium: true,
        }
      }

      const res: OptimizeVideoSettingsResult = await launcherClient.optimizeInGameVideoSettings(opts)
      if (res.success) {
        showToast('success', res.message)
        await fetchStatus()
        onApplied?.()
      } else {
        showToast('error', res.message || 'Không thể áp dụng cài đặt.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra.'
      showToast('error', message)
    } finally {
      setApplying(false)
    }
  }

  const handleInstallSingleMod = async (slug: string, name: string) => {
    if (!gameDir) return
    setInstallingModSlug(slug)
    try {
      const res: InstallEssentialModResult = await launcherClient.installEssentialMod(
        gameDir,
        slug,
        rawVersion,
        rawLoader
      )
      if (res.success) {
        showToast('success', res.message)
        await fetchStatus()
      } else {
        showToast('error', res.message || `Không thể cài đặt mod ${name}.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Có lỗi khi cài đặt mod ${name}.`
      showToast('error', message)
    } finally {
      setInstallingModSlug(null)
    }
  }

  const handleInstallAllMissing = async () => {
    if (!gameDir) return
    setInstallingAll(true)
    try {
      const res: InstallAllEssentialModsResult = await launcherClient.installAllMissingEssentialMods(
        gameDir,
        rawVersion,
        rawLoader
      )
      if (res.success) {
        showToast('success', res.message)
        await fetchStatus()
      } else {
        showToast('error', res.message || 'Không thể tải toàn bộ mod.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi khi cài đặt các mod.'
      showToast('error', message)
    } finally {
      setInstallingAll(false)
    }
  }

  const missingCount = status?.essentialMods?.filter((m) => !m.installed).length || 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tối Ưu Hiệu Năng & Đồ Họa"
      description="Cấu hình đồ họa options.txt và cài đặt mod tăng tốc chuyên dụng cho profile"
      maxWidth="max-w-[760px]"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading || applying || !!installingModSlug || installingAll}
            className="gap-1.5 h-8 text-xs bg-zinc-900 border-zinc-800"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Làm mới
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="h-8 text-xs">
              Đóng
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={applying || loading}
              onClick={handleApply}
              className="h-8 px-4 text-xs font-semibold gap-1.5"
            >
              {applying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang áp dụng...
                </>
              ) : (
                <>
                  <SlidersHorizontal size={14} />
                  Áp dụng thiết lập
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1 select-none">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs">Đang kiểm tra thông số options.txt và danh sách mod tăng tốc...</p>
          </div>
        ) : (
          <>
            {/* Status telemetry */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">Tầm nhìn hiện tại</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm font-semibold text-primary font-mono">
                    {status?.currentRenderDistance ?? 12}
                  </span>
                  <span className="text-[11px] text-muted-foreground">chunks</span>
                </div>
              </div>

              <div className="p-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">Khử răng cưa Mipmap</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm font-semibold text-primary font-mono">
                    Cấp {status?.mipmapLevels ?? 4}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {status?.mipmapLevels === 0 ? '(Đã tắt)' : '(Bật)'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">Đồ họa & Mây</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm font-semibold text-primary font-mono">
                    {status?.fastGraphics ? 'Nhanh (Fast)' : 'Đẹp (Fancy)'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {status?.cloudsEnabled ? '• Mây bật' : '• Mây tắt'}
                  </span>
                </div>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-primary" />
                  Cấu hình đồ họa mẫu
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon
                  const isSelected = selectedLevel === preset.id
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedLevel(preset.id)}
                      className={cn(
                        'p-3.5 rounded-md border cursor-pointer transition-all flex flex-col justify-between gap-2.5 text-left',
                        isSelected
                          ? 'border-primary/70 bg-primary/[0.04] ring-1 ring-primary/30'
                          : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/40'
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon
                              size={15}
                              className={cn(
                                'shrink-0',
                                isSelected ? 'text-primary' : 'text-zinc-400'
                              )}
                            />
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={cn(
                                  'text-xs font-semibold',
                                  isSelected ? 'text-primary' : 'text-zinc-300'
                                )}
                              >
                                {preset.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground/80 font-mono">
                                {preset.subtitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                                isSelected
                                  ? 'bg-primary/15 text-primary border-primary/30'
                                  : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
                              )}
                            >
                              {preset.badge}
                            </span>
                            {isSelected && (
                              <Check size={13} className="text-primary shrink-0" />
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {preset.desc}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>{preset.specs}</span>
                        {preset.id === 'ultra_potato' && isSelected && (
                          <div className="flex items-center gap-1 font-sans">
                            <span className="text-muted-foreground text-[10px]">Chunks:</span>
                            {[4, 6, 8].map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCustomChunks(c)
                                }}
                                className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors',
                                  customChunks === c
                                    ? 'bg-primary text-primary-foreground font-semibold'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                )}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Essential Performance Mods Checklist */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={13} className="text-primary" />
                    Gói Mod Tăng Tốc Khuyến Nghị Cho Máy Yếu
                  </label>
                  {!isVanilla && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                      {status?.essentialMods?.filter((m) => m.installed).length || 0}/
                      {status?.essentialMods?.length || 0} đã cài
                    </span>
                  )}
                </div>

                {!isVanilla && missingCount > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={installingAll || !!installingModSlug}
                    onClick={handleInstallAllMissing}
                    className="h-7 px-3 text-[11px] font-semibold gap-1.5"
                  >
                    {installingAll ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang cài {missingCount} mod...
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        Cài đặt tất cả ({missingCount} mod)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Vanilla Warning Banner */}
              {isVanilla ? (
                <div className="p-3 rounded-md border border-amber-500/20 bg-amber-950/20 flex items-start gap-3 text-xs">
                  <div className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-400/90 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle size={15} />
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-semibold text-amber-300/90 text-xs">
                      Cấu hình Minecraft Vanilla (Không hỗ trợ mod)
                    </h5>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Các mod tăng tốc yêu cầu Fabric, Quilt, Forge hoặc NeoForge. Vui lòng chuyển sang profile hỗ trợ mod để cài đặt.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 max-h-[175px] overflow-y-auto pr-1">
                {status?.essentialMods?.map((mod) => (
                  <div
                    key={mod.id}
                    className={cn(
                      'p-2.5 rounded-md border flex items-center justify-between gap-2 transition',
                      mod.installed
                        ? 'border-primary/25 bg-primary/[0.03]'
                        : 'border-zinc-800/80 bg-zinc-950/40'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-md flex items-center justify-center shrink-0 border',
                          mod.installed
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                        )}
                      >
                        {mod.installed ? <Check size={14} className="text-primary" /> : <Layers size={14} />}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-foreground/90 truncate">{mod.name}</h5>
                        <p className="text-[10px] text-muted-foreground truncate">{mod.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isVanilla ? (
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                          Không khả dụng
                        </span>
                      ) : mod.installed ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/25 flex items-center gap-1">
                          <Check size={11} className="text-primary" />
                          Đã cài
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={installingModSlug === mod.slug || installingAll}
                          onClick={() => handleInstallSingleMod(mod.slug, mod.name)}
                          className="h-6 px-2.5 text-[10px] font-medium gap-1 border-primary/35 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none"
                        >
                          {installingModSlug === mod.slug ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Đang tải...
                            </>
                          ) : (
                            <>
                              <Download size={11} />
                              Cài ngay
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
