import { useState, useEffect, useCallback } from 'react'
import type {
  LauncherSettings,
  LauncherProfile,
  AccountState,
  SystemPerformanceInfo,
  JavaRuntimeSelectionResult,
  DetectedJavaRuntime,
  JvmPresetInfo,
  CacheScanResult,
} from '@/shared/types'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import {
  CheckCircle2,
  AlertTriangle,
  Save,
  ShieldAlert,
  RefreshCw,
  Zap,
  Cpu,
  Trash2,
  Sparkles,
  Terminal,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Monitor,
  Check,
  Layers,
  Palette,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { launcherClient } from '../services/launcherClient'
import { LowEndOptimizerModal } from '../components/optimizer/LowEndOptimizerModal'
import { useToast } from '../components/ui/Toast'
import { cn } from '@/lib/utils'

function sourceLabel(source: DetectedJavaRuntime['source']): string {
  switch (source) {
    case 'managed':
      return 'Managed (LetCuteMC)'
    case 'manual':
    case 'custom':
      return 'Manual'
    case 'java_home':
      return 'JAVA_HOME'
    case 'minecraft':
      return 'Minecraft runtime'
    case 'path':
      return 'PATH'
    default:
      return 'System'
  }
}

interface SettingsScreenProps {
  settings: LauncherSettings
  activeProfile: LauncherProfile | null
  onSave: (settings: LauncherSettings) => void
  onSaveJavaPath?: (javaPath: string) => Promise<void> | void
  accountState: AccountState
  gameDir: string
  onAccountStateChange: (state: AccountState) => void
  appendLog: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
  isWorking?: boolean
}

export const SettingsScreen = ({
  settings,
  activeProfile,
  onSave,
  onSaveJavaPath,
  gameDir,
  isWorking,
}: SettingsScreenProps) => {
  const { showToast } = useToast()

  const [formData, setFormData] = useState<LauncherSettings>({
    ...settings,
    performanceMode: settings.performanceMode ?? 'auto',
    jvmPreset: settings.jvmPreset ?? 'aikar',
    customJvmArgs: settings.customJvmArgs ?? '',
    enableDedicatedGpu: settings.enableDedicatedGpu ?? true,
    uiGraphicQuality: settings.uiGraphicQuality ?? 'auto',
  })

  const [jvmPresets, setJvmPresets] = useState<JvmPresetInfo[]>([])
  const [showFlagsList, setShowFlagsList] = useState(false)

  const [javaSelection, setJavaSelection] = useState<JavaRuntimeSelectionResult | null>(null)
  const [javaScanning, setJavaScanning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sysInfo, setSysInfo] = useState<SystemPerformanceInfo | null>(null)

  // Manual Java selection
  const [selectedJavaPath, setSelectedJavaPath] = useState<string>('')

  // Cache Cleaner State
  const [cacheScan, setCacheScan] = useState<CacheScanResult | null>(null)
  const [isScanningCache, setIsScanningCache] = useState(false)
  const [isCleaningCache, setIsCleaningCache] = useState(false)

  // Low-End Potato PC Modal State
  const [lowEndModalOpen, setLowEndModalOpen] = useState(false)

  const requiredMajor = javaSelection?.requiredMajor ?? javaSelection?.requiredVersion

  // Prefer profile-saved path, then auto-selected runtime
  useEffect(() => {
    const preferred = activeProfile?.javaPath || javaSelection?.selectedRuntime?.javaPath || ''
    setSelectedJavaPath(preferred)
  }, [activeProfile?.id, activeProfile?.javaPath, javaSelection?.selectedRuntime?.javaPath])

  const handleSelectRuntime = (javaPath: string) => {
    setSelectedJavaPath(javaPath)
  }

  // Load JVM presets on mount
  useEffect(() => {
    launcherClient
      .getJvmPresets()
      .then((presets) => setJvmPresets(presets))
      .catch((e) => console.error('Failed to load JVM presets:', e))
  }, [])

  // Scan cache on mount and profile switch
  const targetScanDir = activeProfile?.gameDir || gameDir

  const handleScanCache = useCallback(async () => {
    setIsScanningCache(true)
    try {
      const res = await launcherClient.scanCache(targetScanDir)
      setCacheScan(res)
    } catch (err) {
      console.error('Scan cache error:', err)
    } finally {
      setIsScanningCache(false)
    }
  }, [targetScanDir])

  useEffect(() => {
    void handleScanCache()
  }, [handleScanCache])

  const refreshJava = useCallback(
    async (forceRefresh = false) => {
      if (!window.launcherApi || !activeProfile) return
      setJavaScanning(true)
      try {
        if (forceRefresh) {
          await window.launcherApi.scanJavaRuntimes(formData.customJavaScanDirs, true)
        }
        const res = await window.launcherApi.selectBestJavaRuntime(
          activeProfile.minecraftVersion,
          formData.customJavaScanDirs,
          {
            gameDir: activeProfile.gameDir || gameDir,
            preferredJavaPath: activeProfile.javaPath,
            forceRefresh,
          }
        )
        setJavaSelection(res)
      } catch (e) {
        console.error(e)
      } finally {
        setJavaScanning(false)
      }
    },
    [
      activeProfile?.minecraftVersion,
      activeProfile?.gameDir,
      activeProfile?.javaPath,
      formData.customJavaScanDirs,
      gameDir,
    ]
  )

  useEffect(() => {
    async function loadPerf() {
      if (!window.launcherApi?.getSystemPerformanceInfo) return
      try {
        const info = await window.launcherApi.getSystemPerformanceInfo()
        setSysInfo(info)
      } catch {
        /* ignore */
      }
    }
    void loadPerf()
  }, [gameDir])

  useEffect(() => {
    void refreshJava(false)
  }, [refreshJava])

  const handleChange = (key: keyof LauncherSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleAutoRecommendRam = () => {
    const totalRam = sysInfo?.totalRamGb || 8
    let recommendedMax = 4096

    if (totalRam <= 4) {
      recommendedMax = 2048
    } else if (totalRam <= 8) {
      recommendedMax = 4096
    } else if (totalRam <= 16) {
      recommendedMax = 6144
    } else {
      recommendedMax = 8192
    }

    setFormData((prev) => ({
      ...prev,
      defaultMaxMemoryMb: recommendedMax,
      defaultMinMemoryMb: Math.max(1024, Math.floor(recommendedMax / 2)),
    }))
    showToast(
      'success',
      `Đã tự động tối ưu mức RAM ${recommendedMax} MB cho hệ thống ${totalRam} GB RAM!`
    )
  }

  const handleCleanCache = async () => {
    setIsCleaningCache(true)
    try {
      const res = await launcherClient.cleanCache(targetScanDir)
      if (res.success) {
        const freedMb = (res.freedBytes / (1024 * 1024)).toFixed(1)
        showToast(
          'success',
          `Đã dọn dẹp thành công ${res.freedCount} tệp rác, giải phóng ${freedMb} MB ổ đĩa!`
        )
        void handleScanCache()
      } else {
        showToast('error', res.error || 'Dọn dẹp cache thất bại.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Có lỗi khi dọn dẹp.')
    } finally {
      setIsCleaningCache(false)
    }
  }

  const handleSave = async () => {
    // Save global settings
    await Promise.resolve(onSave(formData))

    // Persist selected Java path to the active profile
    if (activeProfile && selectedJavaPath && selectedJavaPath !== (activeProfile.javaPath ?? '')) {
      try {
        if (onSaveJavaPath) {
          await onSaveJavaPath(selectedJavaPath)
        } else {
          await window.launcherApi.updateProfile(activeProfile.id, { javaPath: selectedJavaPath })
        }
      } catch (e) {
        console.error('Failed to update profile javaPath:', e)
      }
    }

    setSaved(true)
    showToast('success', 'Đã lưu cấu hình cài đặt thành công!')
    setTimeout(() => setSaved(false), 2000)
  }

  const selectedPreset = jvmPresets.find((p) => p.id === (formData.jvmPreset || 'aikar'))
  const totalCacheMb = cacheScan?.totalSizeBytes
    ? (cacheScan.totalSizeBytes / (1024 * 1024)).toFixed(1)
    : '0.0'

  return (
    <div className="px-6 pt-2 pb-6 max-w-4xl mx-auto flex flex-col gap-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground/80">Cài đặt</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tối ưu hiệu năng, RAM và Java
          </p>
        </div>
        <Button onClick={handleSave} disabled={isWorking} variant="primary" className="gap-1.5 shadow-md">
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Đã lưu
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Lưu cài đặt
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4">
        {/* ── SECTION 0: Ultra Low-End Potato PC Quick Boost ─────────────── */}
        <div className="p-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-zinc-900/90 to-teal-950/40 shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Zap size={22} className="fill-current text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-emerald-200">
                  Tối ưu máy yếu
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shrink-0">
                  ⚡ Chống giật lag
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cài mod tăng tốc và giảm tải đồ họa cho máy 2-4GB RAM / Card onboard.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setLowEndModalOpen(true)}
            size="sm"
            variant="outline"
            className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400 transition-all shrink-0 shadow-sm"
          >
            <Sparkles size={14} className="text-emerald-400" />
            Mở bộ tinh chỉnh
          </Button>
        </div>

        {/* ── SECTION: UI Graphic & Effects Quality (Performance) ───────── */}
        <Card className="border-zinc-800/80 bg-zinc-900/85 shadow-md rounded-2xl cv-auto">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Palette className="h-5 w-5 text-primary" />
                Giao diện ứng dụng
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Mức độ hiệu ứng mờ kính và bóng đổ
              </p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              60 FPS
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'auto' as const,
                  name: 'Tự động',
                  badge: 'Khuyến nghị',
                  badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                  tagline: 'Theo máy của bạn',
                  detail: `Đang dùng: ${
                    sysInfo
                      ? sysInfo.isLowEnd || (sysInfo.totalRamGb != null && sysInfo.totalRamGb <= 6) || (sysInfo.cpuCores != null && sysInfo.cpuCores <= 4)
                        ? 'Máy yếu (Low)'
                        : sysInfo.isMidEnd || (sysInfo.totalRamGb != null && sysInfo.totalRamGb <= 12)
                          ? 'Cân bằng (Medium)'
                          : 'Đầy đủ (High)'
                      : 'Đang kiểm tra...'
                  }`,
                },
                {
                  id: 'low' as const,
                  name: 'Máy yếu',
                  badge: 'Siêu nhẹ',
                  badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  tagline: 'Tắt bóng & làm mờ',
                  detail: 'Mượt mà cho RAM ≤ 4GB',
                },
                {
                  id: 'medium' as const,
                  name: 'Cân bằng',
                  badge: 'Mượt & Đẹp',
                  badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                  tagline: 'Làm mờ nhẹ',
                  detail: 'Vừa mượt vừa đẹp mắt',
                },
                {
                  id: 'high' as const,
                  name: 'Đầy đủ hiệu ứng',
                  badge: 'Đẹp nhất',
                  badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                  tagline: 'Kính mờ & phát sáng',
                  detail: 'Dành cho máy mạnh',
                },
              ].map((opt) => {
                const isSelected = (formData.uiGraphicQuality || 'auto') === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      handleChange('uiGraphicQuality', opt.id)
                      const targetQuality =
                        opt.id === 'auto'
                          ? sysInfo?.isLowEnd || (sysInfo?.totalRamGb != null && sysInfo.totalRamGb <= 6) || (sysInfo?.cpuCores != null && sysInfo.cpuCores <= 4)
                            ? 'low'
                            : sysInfo?.isMidEnd || (sysInfo?.totalRamGb != null && sysInfo.totalRamGb <= 12)
                              ? 'medium'
                              : 'high'
                          : opt.id
                      document.documentElement.setAttribute('data-ui-quality', targetQuality)
                    }}
                    className={cn(
                      'p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-sm',
                      isSelected
                        ? 'border-primary/60 bg-zinc-900/95 ring-1 ring-primary/40'
                        : 'border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700'
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={cn('text-xs font-bold truncate', isSelected ? 'text-primary' : 'text-foreground')}>
                          {opt.name}
                        </span>
                        <div
                          className={cn(
                            'h-4 w-4 rounded-full flex items-center justify-center border text-[10px] shrink-0',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-zinc-700 bg-zinc-800'
                          )}
                        >
                          {isSelected && <Check size={10} strokeWidth={3} />}
                        </div>
                      </div>
                      <span className={cn('inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border', opt.badgeColor)}>
                        {opt.badge}
                      </span>
                      <p className="text-[11px] text-zinc-300 font-medium leading-tight pt-1">
                        {opt.tagline}
                      </p>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-tight pt-1 border-t border-zinc-800/60">
                      {opt.detail}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 1: JVM Optimizer Presets ───────────────────────────── */}
        <Card className="border-zinc-800/80 bg-zinc-900/85 shadow-md rounded-2xl cv-auto">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              Tối ưu hiệu năng game
            </CardTitle>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
              Tăng FPS
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {jvmPresets.map((preset) => {
                const isSelected = (formData.jvmPreset || 'aikar') === preset.id
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleChange('jvmPreset', preset.id)}
                    className={cn(
                      'p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 shadow-sm',
                      isSelected
                        ? 'border-primary/60 bg-zinc-900/95 ring-1 ring-primary/40'
                        : 'border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-xs font-bold truncate',
                              isSelected ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {preset.name}
                          </span>
                          {preset.recommended && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Khuyên dùng
                            </span>
                          )}
                          {preset.minJavaVersion > 8 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              Java {preset.minJavaVersion}+
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          {preset.tagline}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'h-4 w-4 rounded-full flex items-center justify-center border text-[10px] shrink-0 mt-0.5',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-zinc-700 bg-zinc-800'
                        )}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Collapsible View Preset Flags */}
            {selectedPreset && selectedPreset.flags.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowFlagsList(!showFlagsList)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                >
                  <Terminal size={13} />
                  <span>
                    {showFlagsList ? 'Ẩn thông số' : `Xem chi tiết ${selectedPreset.flags.length} thông số (${selectedPreset.name})`}
                  </span>
                  {showFlagsList ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showFlagsList && (
                  <div className="mt-2 p-3 rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-[11px] text-zinc-300 max-h-40 overflow-y-auto space-y-1">
                    {selectedPreset.flags.map((flag, idx) => (
                      <div key={idx} className="text-cyan-400/90">
                        {flag}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom Extra JVM Args Input */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Lệnh Java tùy chỉnh</span>
                <span className="text-[10px] text-muted-foreground">Không bắt buộc</span>
              </label>
              <Input
                value={formData.customJvmArgs || ''}
                onChange={(e) => handleChange('customJvmArgs', e.target.value)}
                placeholder="VD: -Dminecraft.debug=true"
                className="h-8 text-xs font-mono bg-zinc-900/90 border-zinc-800"
              />
            </div>

            {/* GPU Offload Checkbox */}
            <div
              onClick={() => handleChange('enableDedicatedGpu', !formData.enableDedicatedGpu)}
              className={cn(
                'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                formData.enableDedicatedGpu
                  ? 'bg-primary/10 border-primary/40 text-foreground'
                  : 'bg-zinc-900/80 border-zinc-800 text-muted-foreground hover:bg-zinc-900'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Monitor size={18} className={cn(formData.enableDedicatedGpu ? 'text-primary' : 'text-zinc-500')} />
                <div>
                  <p className="text-xs font-bold text-foreground">Dùng Card đồ họa rời (NVIDIA / AMD)</p>
                  <p className="text-[10px] text-zinc-400">Ưu tiên card rời để game mượt hơn nếu máy có 2 card màn hình</p>
                </div>
              </div>

              <div
                className={cn(
                  'h-4 w-4 rounded-md flex items-center justify-center border text-[10px]',
                  formData.enableDedicatedGpu
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-zinc-700 bg-zinc-800'
                )}
              >
                {formData.enableDedicatedGpu && <Check size={11} strokeWidth={3} />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 2: RAM Memory ──────────────────────────────────────── */}
        <Card className="border-zinc-800/80 bg-zinc-900/85 shadow-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Cpu className="h-5 w-5 text-primary" />
              Bộ nhớ RAM cho game
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoRecommendRam}
              className="h-7 px-2.5 text-xs bg-zinc-900 border-zinc-800 text-primary hover:bg-zinc-800 gap-1.5"
            >
              <Sparkles size={12} />
              Tự chọn mức hợp lý
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-300">
                  RAM tối đa cấp cho game
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-primary/15 border border-primary/30 rounded-lg text-primary">
                  {((formData.defaultMaxMemoryMb || 4096) / 1024).toFixed(1)} GB ({formData.defaultMaxMemoryMb} MB)
                </span>
              </div>
              <input
                type="range"
                min={1024}
                max={Math.max(8192, (sysInfo?.totalRamGb || 8) * 1024)}
                step={512}
                value={formData.defaultMaxMemoryMb}
                onChange={(e) =>
                  handleChange('defaultMaxMemoryMb', parseInt(e.target.value) || 1024)
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-zinc-800 accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>1 GB</span>
                <span>
                  RAM máy: {sysInfo?.totalRamGb || 8} GB
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 3: Java Runtime ────────────────────────────────────── */}
        <Card className="border-zinc-800/80 bg-zinc-900/85 shadow-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Layers className="h-5 w-5 text-primary" />
              Phiên bản Java
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={javaScanning || !activeProfile}
              onClick={() => void refreshJava(true)}
              className="h-7 px-2.5 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', javaScanning && 'animate-spin')} />
              Tìm Java trên máy
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Java đang dùng</p>
              <Select
                value={selectedJavaPath}
                onChange={(val) => handleSelectRuntime(String(val))}
                disabled={!javaSelection?.candidates || javaSelection.candidates.length === 0}
                placeholder="Chọn Java..."
                options={[
                  ...(javaSelection?.candidates ?? []).map((rt) => ({
                    value: rt.javaPath,
                    label: `Java ${rt.version} (Java ${rt.majorVersion}) — ${sourceLabel(rt.source)}`,
                  })),
                ]}
              />
            </div>

            {javaSelection?.warning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{javaSelection.warning}</span>
              </div>
            )}

            {!javaSelection?.found && javaSelection?.message && (
              <div className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{javaSelection.message}</span>
                </div>
                {javaSelection?.requiredVersion && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={javaScanning}
                    onClick={async () => {
                      if (!window.launcherApi || !javaSelection?.requiredVersion) return
                      setJavaScanning(true)
                      try {
                        const res = await window.launcherApi.autoInstallJava(javaSelection.requiredVersion)
                        if (res.success) {
                          await refreshJava(true)
                        } else {
                          alert(res.message)
                        }
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Cài đặt thất bại')
                      } finally {
                        setJavaScanning(false)
                      }
                    }}
                    className="self-start h-7 px-3 text-xs bg-primary text-primary-foreground font-semibold hover:bg-primary/90 rounded-lg mt-1"
                  >
                    Tải & Cài đặt Java {javaSelection.requiredVersion} tự động
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 4: Storage & Cache Cleaner ─────────────────────────── */}
        <Card className="border-zinc-800/80 bg-zinc-900/85 shadow-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <HardDrive className="h-5 w-5 text-primary" />
                Dọn rác & Bộ nhớ đệm
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Xóa file log cũ và dữ liệu tạm để giải phóng ổ cứng
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isScanningCache}
                onClick={handleScanCache}
                className="h-7 px-2.5 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 gap-1"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isScanningCache && 'animate-spin')} />
                Quét
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isCleaningCache || (cacheScan?.totalSizeBytes || 0) === 0}
                onClick={handleCleanCache}
                className="h-7 px-3 text-xs font-semibold gap-1.5 bg-rose-600 hover:bg-rose-500 text-white"
              >
                <Trash2 size={12} />
                Dọn dẹp ({totalCacheMb} MB)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cacheScan && cacheScan.items.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {cacheScan.items.map((item) => {
                  const sizeMb = (item.sizeBytes / (1024 * 1024)).toFixed(1)
                  return (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between gap-1.5"
                    >
                      <div>
                        <p className="text-xs font-bold text-foreground truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/80">
                        <span className="text-muted-foreground">{item.fileCount} tệp</span>
                        <span className="font-bold text-primary font-mono">{sizeMb} MB</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                {isScanningCache ? 'Đang quét...' : 'Không có tệp rác nào.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Low-End Potato PC Optimizer Modal ────────────────────────────── */}
      <LowEndOptimizerModal
        isOpen={lowEndModalOpen}
        onClose={() => setLowEndModalOpen(false)}
        gameDir={gameDir}
        activeProfile={activeProfile}
        onApplied={() => {
          handleChange('jvmPreset', 'ultra_low_end')
          void handleScanCache()
        }}
      />
    </div>
  )
}
