import { useState, useEffect } from 'react'
import {
  Zap,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Package,
  Layers,
  Sliders,
  Monitor,
  Download,
  AlertCircle,
  Sparkles,
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
    } catch (err: any) {
      showToast('error', err?.message || 'Có lỗi xảy ra.')
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
    } catch (err: any) {
      showToast('error', err?.message || `Có lỗi khi cài đặt mod ${name}.`)
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
    } catch (err: any) {
      showToast('error', err?.message || 'Có lỗi khi cài đặt các mod.')
    } finally {
      setInstallingAll(false)
    }
  }

  const missingCount = status?.essentialMods?.filter((m) => !m.installed).length || 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tối Ưu Hiệu Năng & Đồ Họa Minecraft"
      description="Tự động chỉnh options.txt theo từng preset — từ máy siêu yếu đến máy chiến game mạnh"
      maxWidth="max-w-[780px]"
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
              className="h-8 px-4 text-xs font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/20"
            >
              {applying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang áp dụng...
                </>
              ) : (
                <>
                  <Zap size={14} className="fill-current" />
                  Áp dụng tối ưu hóa đồ họa
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
            {/* Status overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">Tầm nhìn (Render Distance)</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-base font-bold text-foreground">
                    {status?.currentRenderDistance ?? 12}
                  </span>
                  <span className="text-xs text-muted-foreground">chunks</span>
                </div>
                <span className="text-[10px] text-emerald-400 mt-1">Gợi ý máy yếu: 4 - 6 chunks</span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">Sinh Mipmap (VRAM Load)</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-base font-bold text-foreground">
                    Cấp {status?.mipmapLevels ?? 4}
                  </span>
                  {status?.mipmapLevels === 0 ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">Tối ưu</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">Nặng</span>
                  )}
                </div>
                <span className="text-[10px] text-emerald-400 mt-1">Gợi ý: Cấp 0 (Tắt sinh mipmap)</span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between">
                <span className="text-[11px] text-muted-foreground">Đồ họa & Mây</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-base font-bold text-foreground">
                    {status?.fastGraphics ? 'Nhanh (Fast)' : 'Đẹp (Fancy)'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 mt-1">
                  {status?.cloudsEnabled ? 'Mây: Đang bật' : 'Mây: Đã tắt (Nhẹ)'}
                </span>
              </div>
            </div>

            {/* Optimization Level Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={13} className="text-primary" />
                Chọn mức độ tối ưu hóa đồ họa
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Level 1: Ultra Potato */}
                <div
                  onClick={() => setSelectedLevel('ultra_potato')}
                  className={cn(
                    'p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 text-left relative overflow-hidden',
                    selectedLevel === 'ultra_potato'
                      ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Zap size={14} className="text-emerald-400" />
                        🥔 Siêu Nhẹ (Ultra Potato)
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Máy Yếu
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Render {customChunks} chunks, tắt Mipmap, đồ họa Nhanh, tắt Mây. Tiết kiệm tối đa RAM/VRAM.
                    </p>
                  </div>

                  {selectedLevel === 'ultra_potato' && (
                    <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Tầm nhìn (Chunks):</span>
                      <div className="flex items-center gap-1">
                        {[4, 6, 8].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomChunks(c)
                            }}
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold transition',
                              customChunks === c
                                ? 'bg-emerald-500 text-zinc-950'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            )}
                          >
                            {c} chunks
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Level 2: Balanced Low */}
                <div
                  onClick={() => setSelectedLevel('balanced_low')}
                  className={cn(
                    'p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 text-left',
                    selectedLevel === 'balanced_low'
                      ? 'border-teal-500/60 bg-teal-500/10 ring-1 ring-teal-500/30'
                      : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                        <Monitor size={14} className="text-teal-400" />
                        ⚖️ Cân Bằng (Balanced Low)
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300">
                        Máy Trung
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Render 8 chunks, Mipmap 1, đồ họa Nhanh, mây Nhanh. Cân bằng giữa độ nét và độ mượt.
                    </p>
                  </div>
                </div>

                {/* Level 3: High Quality */}
                <div
                  onClick={() => setSelectedLevel('high_quality')}
                  className={cn(
                    'p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 text-left',
                    selectedLevel === 'high_quality'
                      ? 'border-sky-500/60 bg-sky-500/10 ring-1 ring-sky-500/30'
                      : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-sky-400" />
                        ✨ Chơi Đẹp (High Quality)
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                        Máy Khá
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Render 16 chunks, Mipmap đầy đủ, đồ họa Đẹp (Fancy), mây bật. Tận dụng sức mạnh máy để chơi trải nghiệm đẹp hơn.
                    </p>
                  </div>
                </div>

                {/* Level 4: Ultra Quality */}
                <div
                  onClick={() => setSelectedLevel('ultra_quality')}
                  className={cn(
                    'p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 text-left relative overflow-hidden',
                    selectedLevel === 'ultra_quality'
                      ? 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30'
                      : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'
                  )}
                >
                  {/* Glow corner */}
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-violet-500/20 rounded-full blur-xl pointer-events-none" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                        <Zap size={14} className="text-violet-400 fill-current" />
                        🚀 Siêu Đẹp (Ultra Quality)
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-200 border border-violet-500/30">
                        Máy Mạnh
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Render 24 chunks, Mipmap cực cao, đồ họa Đẹp tối đa, Sodium tối ưu hiệu năng GPU. Dành cho máy RTX/RX hoặc CPU mạnh ≥8 nhân.
                    </p>
                  </div>
                </div>
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
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {status?.essentialMods?.filter((m) => m.installed).length || 0}/
                      {status?.essentialMods?.length || 0} đã cài
                    </span>
                  )}
                </div>

                {!isVanilla && missingCount > 0 && (
                  <Button
                    size="sm"
                    disabled={installingAll || !!installingModSlug}
                    onClick={handleInstallAllMissing}
                    className="h-7 px-3 text-[11px] font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-sm"
                  >
                    {installingAll ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang cài {missingCount} mod...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Cài đặt tất cả ({missingCount} mod)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Vanilla Warning Banner */}
              {isVanilla ? (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-xs shadow-sm">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle size={17} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-amber-200">
                      Cấu hình hiện tại là Minecraft Vanilla (Không hỗ trợ nạp Mod)
                    </h5>
                    <p className="text-[11px] text-zinc-300/85 leading-relaxed">
                      Các mod tăng tốc tối ưu hiệu năng như Sodium, FerriteCore, Lithium yêu cầu môi trường Fabric, Quilt, Forge hoặc NeoForge. Bạn vui lòng đổi hoặc tạo cấu hình Fabric/Forge để có thể cài đặt các mod này.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 max-h-[175px] overflow-y-auto pr-1">
                {status?.essentialMods?.map((mod) => (
                  <div
                    key={mod.id}
                    className={cn(
                      'p-2.5 rounded-xl border flex items-center justify-between gap-2 transition',
                      mod.installed
                        ? 'border-emerald-500/30 bg-zinc-950/70'
                        : 'border-zinc-800/80 bg-zinc-950/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border',
                          mod.installed
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        )}
                      >
                        {mod.installed ? <CheckCircle2 size={15} /> : <Layers size={15} />}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-foreground truncate">{mod.name}</h5>
                        <p className="text-[10px] text-muted-foreground truncate">{mod.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isVanilla ? (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-500 border border-zinc-700/50">
                          Không khả dụng
                        </span>
                      ) : mod.installed ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          Đã cài
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={installingModSlug === mod.slug || installingAll}
                          onClick={() => handleInstallSingleMod(mod.slug, mod.name)}
                          className="h-6 px-2.5 text-[10px] font-bold gap-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-sm"
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
