import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Cpu,
  Square,
} from 'lucide-react'
import type {
  LauncherProfile,
  MinecraftScanResult,
  JavaRuntimeSelectionResult,
  LauncherSettings,
  AccountState,
  LaunchInput,
} from '@/shared/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/button'
import { useLauncherJob } from '../../hooks/useLauncherJob'
import { usePrepareGame } from '../../hooks/usePrepareGame'
import { useState, useEffect } from 'react'

interface LaunchPanelProps {
  activeProfile: LauncherProfile | null
  minecraftScan: MinecraftScanResult | null
  javaSelection: JavaRuntimeSelectionResult | null
  settings: LauncherSettings
  onEditProfile: () => void
  accountState: AccountState
  gameDir: string
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className="truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  )
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)))
}

export function LaunchPanel({
  activeProfile,
  javaSelection,
  settings,
  accountState,
  gameDir,
}: LaunchPanelProps) {
  const { state, isBusy, isStarting, isRunning, isFailed, startLaunch, cancelLaunch } = useLauncherJob()
  const { prepareState, progress: prepareProgress, isPreparing, startPrepare } = usePrepareGame(activeProfile, settings)
  const [shouldLaunchAfterPrepare, setShouldLaunchAfterPrepare] = useState(false)

  const accounts = accountState?.accounts || []
  const activeAccount = accounts.find(a => a.id === accountState?.activeAccountId)
  const isVirtual      = !activeAccount || activeAccount.type === 'local'
  const isMicrosoft    = activeAccount?.type === 'microsoft'
  const hasMicrosoftAccount = activeAccount?.type === 'microsoft'

  // Java installer state (local UI only)
  type JavaInstallState = 'idle' | 'installing' | 'success' | 'error'
  const [javaInstallState, setJavaInstallState]     = useState<JavaInstallState>('idle')
  const [javaInstallMessage, setJavaInstallMessage] = useState('')

  const handleInstallJava = async () => {
    if (!activeProfile || !javaSelection || !window.launcherApi) return
    setJavaInstallState('installing')
    setJavaInstallMessage('Đang tải Java...')
    try {
      const result = await window.launcherApi.autoInstallJava(javaSelection.requiredVersion)
      if (result.success) {
        setJavaInstallState('success')
        setJavaInstallMessage(result.message)
        setTimeout(() => window.launcherApi?.scanJavaRuntimes(settings.customJavaScanDirs), 1000)
      } else {
        setJavaInstallState('error')
        setJavaInstallMessage(result.message)
      }
    } catch (e) {
      setJavaInstallState('error')
      setJavaInstallMessage(e instanceof Error ? e.message : 'Lỗi không xác định')
    }
  }

  const triggerLaunch = async () => {
    if (!activeProfile) return

    const username = activeAccount?.username || 'Player'

    const auth: LaunchInput['auth'] = isVirtual
      ? {
          type: 'virtual',
          username,
          uuid: activeAccount?.uuid || '00000000-0000-0000-0000-000000000000',
          accessToken: 'offline-token-placeholder',
        }
      : {
          type: 'microsoft',
          username: activeAccount.username,
          uuid: activeAccount.uuid,
          accessToken: activeAccount.accessToken || '',
          expiresAt: activeAccount.expiresAt,
        }

    await startLaunch({
      profileId: activeProfile.id,
      version: activeProfile.minecraftVersion,
      versionType: 'release',
      gameDir: activeProfile.gameDir || gameDir,
      javaPath: javaSelection?.selectedRuntime?.javaPath ?? null,
      minMemoryMb: activeProfile.minMemoryMb || settings.defaultMinMemoryMb,
      maxMemoryMb: activeProfile.maxMemoryMb || settings.defaultMaxMemoryMb,
      serverAddress: undefined,
      auth,
      performance: {
        enableLaunchBoost: settings.enableLaunchBoost,
        launchBoostDurationMs: settings.launchBoostDurationMs,
        launchBoostPriority: settings.launchBoostPriority,
      },
    })
  }

  // Auto-launch when prepare succeeds
  useEffect(() => {
    if (shouldLaunchAfterPrepare && prepareState?.isReady && !isPreparing) {
      setShouldLaunchAfterPrepare(false)
      void triggerLaunch()
    }
  }, [shouldLaunchAfterPrepare, prepareState?.isReady, isPreparing])

  const handlePlay = async () => {
    if (!activeProfile || isBusy || isStarting || isPreparing) return

    if (prepareState?.isReady) {
      await triggerLaunch()
    } else {
      setShouldLaunchAfterPrepare(true)
      void startPrepare()
    }
  }

  // Progress from job state
  const jobProgress = state?.progress
  const percent     = clamp(jobProgress?.percent ?? 0)
  const showProgress = isBusy && percent > 0

  // Cancel is available when preparing/downloading/launching (not running)
  const canCancel = isBusy && !isRunning

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card h-full flex flex-col">
      {/* Hero Header */}
      <div
        className="border-b border-border p-6 shrink-0 relative overflow-hidden"
        style={{
          background: isVirtual
            ? 'radial-gradient(circle at top right, color-mix(in oklch, var(--warning) 8%, transparent), transparent 60%), var(--card)'
            : 'radial-gradient(circle at top right, color-mix(in oklch, var(--primary) 14%, transparent), transparent 60%), var(--card)',
        }}
      >
        {activeProfile ? (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge variant={isVirtual ? 'warn' : 'success'}>
                {isVirtual ? 'Local Offline' : 'Microsoft'}
              </Badge>
              <Badge variant="secondary">{activeProfile.minecraftVersion}</Badge>
            </div>
            <h3 className="truncate text-2xl font-black tracking-tight text-foreground" title={activeProfile.name}>
              {activeProfile.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isVirtual
                ? 'Local Offline — Chơi không cần đăng nhập Microsoft'
                : 'Microsoft Account — Trải nghiệm Premium đầy đủ'}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-foreground">Chưa chọn profile</h3>
            <p className="text-xs text-muted-foreground mt-1">Hãy chọn hoặc tạo một cấu hình game.</p>
          </>
        )}
      </div>

      {/* Info + Status */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeProfile ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Phiên bản" value={activeProfile.minecraftVersion} />
              <InfoRow
                label="RAM"
                value={`${activeProfile.minMemoryMb}M – ${activeProfile.maxMemoryMb}M`}
              />
              <InfoRow
                label="Java"
                value={
                  javaSelection?.found
                    ? `Java ${javaSelection.selectedRuntime?.majorVersion || ''}`
                    : 'Chưa có'
                }
              />
            </div>



            {/* Progress bar when busy */}
            {showProgress && jobProgress && (
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{jobProgress.title}</span>
                  <span className="text-muted-foreground">{percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate">{jobProgress.message}</p>
              </div>
            )}

            {/* Prepare Progress bar (background file downloading) */}
            {!isBusy && isPreparing && prepareProgress && (
              <div className="rounded-xl border border-border bg-primary/5 p-3.5 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">{prepareProgress.title}</span>
                  <span className="text-muted-foreground">{prepareProgress.percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${prepareProgress.percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate">{prepareProgress.message}</p>
              </div>
            )}

            {/* Ready to play status indicator */}
            {!isBusy && !isPreparing && false && ( // prepareState removed
              <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 px-3.5 text-xs text-primary animate-in fade-in duration-200">
                <CheckCircle2 size={14} className="shrink-0 text-primary" />
                <span className="font-semibold">Tất cả tệp game đã sẵn sàng (Ready to Play)</span>
              </div>
            )}

            {/* Error or result banners */}
            <div className="space-y-2.5 pt-2">
              {/* Java missing (Microsoft only) */}
              {isMicrosoft && javaSelection && !javaSelection.found && javaInstallState !== 'installing' && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/8 p-3.5 text-sm text-red-300">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
                  <div>
                    <p className="font-semibold">Java không tìm thấy</p>
                    <p className="text-xs mt-1 opacity-80">{javaSelection.message}</p>
                  </div>
                </div>
              )}

              {/* Java warning */}
              {isMicrosoft && javaSelection?.warning && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3.5 text-sm text-amber-300">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Cảnh báo Java</p>
                    <p className="text-xs mt-1 opacity-80">{javaSelection.warning}</p>
                  </div>
                </div>
              )}

              {/* Failed error */}
              {isFailed && state?.error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/8 p-3.5 text-sm text-red-300">
                  <XCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                  <div>
                    <p className="font-semibold">Khởi động thất bại</p>
                    <p className="text-xs mt-1 opacity-80">{state.error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Java install result */}
            {isMicrosoft && javaInstallState !== 'idle' && (
              <div
                className={[
                  'flex items-start gap-2.5 rounded-xl border p-3.5 text-sm animate-in fade-in',
                  javaInstallState === 'success'
                    ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-300'
                    : javaInstallState === 'installing'
                      ? 'border-border bg-muted/50 text-muted-foreground'
                      : 'border-red-500/25 bg-red-500/8 text-red-300',
                ].join(' ')}
              >
                {javaInstallState === 'installing' ? (
                  <Loader2 size={15} className="animate-spin mt-0.5 shrink-0" />
                ) : javaInstallState === 'success' ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={15} className="mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs leading-none">
                    {javaInstallState === 'installing'
                      ? 'Đang cài đặt Java Runtime...'
                      : javaInstallState === 'success'
                        ? 'Cài đặt Java thành công'
                        : 'Lỗi cài đặt Java'}
                  </p>
                  <p className="text-xs opacity-80 mt-1">{javaInstallMessage}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Cpu size={24} className="opacity-40 mb-2" />
            <p className="text-xs">Không có dữ liệu cấu hình game</p>
          </div>
        )}
      </div>

      {/* Footer: Action buttons */}
      <div className="border-t border-border p-6 shrink-0 bg-background/30 space-y-3">
        {activeProfile ? (
          <>
            {/* Java auto-install prompt */}
            {isMicrosoft && javaSelection && !javaSelection.found && javaInstallState !== 'installing' && (
              <Button
                onClick={handleInstallJava}
                variant="outline"
                className="w-full h-10"
              >
                <Download size={15} />
                <span>Thử lại cài Java</span>
              </Button>
            )}

            {/* Main PLAY / STATUS button */}
            {isVirtual ? (
              /* Offline / Local mode */
              <Button
                disabled={!activeProfile || isBusy || isStarting || isPreparing}
                onClick={handlePlay}
                variant={isFailed ? "danger" : "primary"}
                className="relative w-full h-14 rounded-xl font-bold text-base"
              >
                {showProgress && (
                  <span
                    className="pointer-events-none absolute left-0 top-0 h-full bg-primary-foreground/8 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                )}
                <span className="relative flex items-center gap-3">
                  {isBusy && !isRunning ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isPreparing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isRunning ? (
                    <CheckCircle2 size={20} />
                  ) : isFailed ? (
                    <XCircle size={20} />
                  ) : (
                    <Play size={20} className="fill-current" />
                  )}
                  <span>
                    {isRunning
                      ? 'ĐANG CHẠY'
                      : isFailed
                        ? 'THỬ LẠI'
                        : isBusy
                          ? 'ĐANG KHỞI ĐỘNG...'
                          : isPreparing
                            ? 'PREPARING...'
                            : 'CHƠI (OFFLINE)'}
                  </span>
                </span>
              </Button>
            ) : !hasMicrosoftAccount ? (
              /* Microsoft required, not logged in */
              <div className="space-y-2">
                <Button
                  disabled
                  variant="outline"
                  className="relative w-full h-14 rounded-xl font-bold text-base cursor-not-allowed bg-muted/30 text-muted-foreground border-dashed border-border"
                >
                  <span>LOGIN REQUIRED</span>
                </Button>
                <p className="text-xs text-center text-red-400/90 font-medium bg-red-500/8 border border-red-500/15 rounded-lg py-2">
                  Vào Cài đặt &gt; Tài khoản để đăng nhập Microsoft.
                </p>
              </div>
            ) : (
              /* Microsoft account active */
              <Button
                disabled={!activeProfile || isBusy || isStarting || isPreparing}
                onClick={handlePlay}
                variant={isFailed ? "danger" : "primary"}
                className="relative w-full h-14 rounded-xl font-bold text-base"
              >
                {showProgress && (
                  <span
                    className="pointer-events-none absolute left-0 top-0 h-full bg-primary-foreground/8 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                )}
                <span className="relative flex items-center gap-3">
                  {isBusy && !isRunning ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isPreparing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isRunning ? (
                    <CheckCircle2 size={20} />
                  ) : isFailed ? (
                    <XCircle size={20} />
                  ) : (
                    <Play size={20} className="fill-current" />
                  )}
                  <span>
                    {isRunning
                      ? 'ĐANG CHẠY'
                      : isFailed
                        ? 'THỬ LẠI'
                        : isBusy
                          ? 'ĐANG KHỞI ĐỘNG...'
                          : isPreparing
                            ? 'PREPARING...'
                            : 'CHƠI'}
                  </span>
                </span>
              </Button>
            )}

            {/* Repair Button */}
            {!isBusy && !isPreparing && (
              <Button
                onClick={() => void startPrepare(true)}
                variant="outline"
                className="w-full h-10 rounded-xl font-semibold text-xs border-dashed border-border"
              >
                <AlertTriangle size={14} className="text-amber-400" />
                <span>Sửa lỗi tệp tin (Repair)</span>
              </Button>
            )}

            {/* Cancel button */}
            {canCancel && (
              <Button
                onClick={() => void cancelLaunch()}
                variant="outline"
                className="w-full h-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <Square size={14} className="fill-current" />
                Hủy khởi động
              </Button>
            )}
          </>
        ) : (
          <Button
            disabled
            variant="outline"
            className="w-full h-14 rounded-xl font-bold text-base bg-muted text-muted-foreground cursor-not-allowed"
          >
            CHƯA CHỌN CẤU HÌNH
          </Button>
        )}
      </div>
    </section>
  )
}
