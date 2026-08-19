import { useState, useEffect, useCallback } from 'react'
import type {
  LauncherSettings,
  LauncherProfile,
  AccountState,
  SystemPerformanceInfo,
  AutoPerformanceRecommendation,
  JavaRuntimeSelectionResult,
  DetectedJavaRuntime,
} from '@/shared/types.ts'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { CheckCircle2, AlertTriangle, Save, ShieldAlert, Sparkles, Cpu, RefreshCw, MessageSquare } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/Select'
import { Input } from '@/components/ui/Input'

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
  accountState: _accountState,
  gameDir,
  onAccountStateChange: _onAccountStateChange,
  appendLog: _appendLog,
  isWorking,
}: SettingsScreenProps) => {
  const [formData, setFormData] = useState<LauncherSettings>({
    ...settings,
    performanceMode: settings.performanceMode ?? 'auto',
  })
  const [javaSelection, setJavaSelection] = useState<JavaRuntimeSelectionResult | null>(null)
  const [javaScanning, setJavaScanning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sysInfo, setSysInfo] = useState<SystemPerformanceInfo | null>(null)
  const [recommendation, setRecommendation] = useState<AutoPerformanceRecommendation | null>(null)

  // Manual Java selection
  const [selectedJavaPath, setSelectedJavaPath] = useState<string>('')

  const isAuto = (formData.performanceMode ?? 'auto') === 'auto'
  const requiredMajor = javaSelection?.requiredMajor ?? javaSelection?.requiredVersion

  // Prefer profile-saved path, then auto-selected runtime
  useEffect(() => {
    const preferred = activeProfile?.javaPath || javaSelection?.selectedRuntime?.javaPath || ''
    setSelectedJavaPath(preferred)
  }, [activeProfile?.id, activeProfile?.javaPath, javaSelection?.selectedRuntime?.javaPath])

  const handleSelectRuntime = (javaPath: string) => {
    setSelectedJavaPath(javaPath)
  }

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
        const eff = await window.launcherApi.getEffectivePerformanceSettings()
        setRecommendation(eff.recommendation)
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
    setFormData(prev => ({ ...prev, [key]: value }))
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
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="px-6 pt-2 pb-6 max-w-4xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground/80">Cài đặt</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Thiết lập các cấu hình launcher</p>
        </div>
        <Button onClick={handleSave} disabled={isWorking} variant="primary">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Java Runtime</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={javaScanning || !activeProfile}
              onClick={() => void refreshJava(true)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${javaScanning ? 'animate-spin' : ''}`} />
              Quét lại Java
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Chọn Java Runtime */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Chọn Java Runtime</p>
                <Select
                  value={selectedJavaPath}
                  onChange={(val) => handleSelectRuntime(String(val))}
                  disabled={!javaSelection?.candidates || javaSelection.candidates.length === 0}
                  placeholder="Chọn một runtime..."
                  options={[
                    ...(javaSelection?.candidates ?? []).map((rt) => ({
                      value: rt.javaPath,
                      label: `Java ${rt.version} (major ${rt.majorVersion}) — ${sourceLabel(rt.source)}`,
                    })),
                  ]}
                />
              </div>



              {javaSelection?.candidates && javaSelection.candidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Runtimes phát hiện ({javaSelection.candidates.length})
                  </p>
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {javaSelection.candidates.map((rt) => {
                      const actual = rt.majorVersion
                      const req = requiredMajor
                      const ok = req != null && actual === req
                      return (
                        <div
                          key={rt.id || rt.javaPath}
                          className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">
                              Java {rt.version}
                            </span>
                            <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>
                              {ok
                                ? 'Compatible'
                                : req != null
                                  ? `Required: Java ${req}`
                                  : 'Detected'}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            Major: {actual}
                            {rt.vendor ? ` · ${rt.vendor}` : ''}
                            {rt.architecture ? ` · ${rt.architecture}` : ''}
                            {` · ${sourceLabel(rt.source)}`}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground break-all">
                            {rt.javaPath}
                          </p>
                          {!ok && req != null && actual !== req && (
                            <p className="text-amber-200/90">
                              {actual > req
                                ? 'Không đúng phiên bản khuyến nghị (mới hơn)'
                                : 'Không đúng phiên bản khuyến nghị (cũ hơn)'}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {javaSelection?.warning && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{javaSelection.warning}</span>
                </div>
              )}

              {!javaSelection?.found && javaSelection?.message && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{javaSelection.message}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-amber-400" />
              Bộ nhớ (RAM)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-semibold text-foreground">Dung lượng cấp phát</label>
                  <span className="text-xs font-mono px-2 py-1 bg-accent/20 rounded text-primary">
                    {formData.defaultMaxMemoryMb} MB
                  </span>
                </div>
                <input
                  type="range"
                  min={1024}
                  max={Math.max(8192, (sysInfo?.totalRamGb || 8) * 1024)}
                  step={512}
                  value={formData.defaultMaxMemoryMb}
                  onChange={(e) => handleChange('defaultMaxMemoryMb', parseInt(e.target.value) || 1024)}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-primary/30 accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>1024 MB</span>
                  <span>{Math.max(8192, (sysInfo?.totalRamGb || 8) * 1024)} MB</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
