import { useState, useEffect } from 'react'
import {
  Box,
  Layers,
  List,
  PackageOpen,
  Settings,
  TerminalSquare,
  Zap,
  Play,
  Loader2,
  Square
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import logoImg from '../../assets/avatarv2-modified.png'
import type {
  LauncherProfile,
  JavaRuntimeSelectionResult,
  LauncherSettings,
  AccountState,
  LaunchInput
} from '@/shared/types'
import { useLauncherJob } from '../../hooks/useLauncherJob'
import { usePrepareGame } from '../../hooks/usePrepareGame'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'

export type TabId = 'profiles' | 'versions' | 'mods' | 'resourcepacks' | 'shaderpacks' | 'settings' | 'logs'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  accountState: AccountState
  activeProfile: LauncherProfile | null
  javaSelection: JavaRuntimeSelectionResult | null
  settings: LauncherSettings
  gameDir: string
  isWorking?: boolean
}

const MENU_ITEMS = [
  { id: 'profiles', label: 'Cấu hình game', icon: Layers },
  { id: 'versions', label: 'Phiên bản', icon: List },
  { id: 'mods', label: 'Mods', icon: Box },
  { id: 'resourcepacks', label: 'Resource Packs', icon: PackageOpen },
  { id: 'shaderpacks', label: 'Shader Packs', icon: Zap },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
  { id: 'logs', label: 'Nhật ký', icon: TerminalSquare },
] as const

export function Sidebar({
  activeTab,
  onTabChange,
  accountState,
  activeProfile,
  javaSelection,
  settings,
  gameDir,
  isWorking
}: SidebarProps) {
  const { state, isBusy, isStarting, isRunning, isFailed, startLaunch, cancelLaunch } = useLauncherJob()
  const { prepareState, progress: prepareProgress, isPreparing, startPrepare } = usePrepareGame(activeProfile, settings)
  const [shouldLaunchAfterPrepare, setShouldLaunchAfterPrepare] = useState(false)

  const isMicrosoft = accountState.mode === 'microsoft' && accountState.microsoftAccount
  const displayUsername = isMicrosoft
    ? accountState.microsoftAccount!.username
    : accountState.localAccount.username

  const isVirtual = accountState.mode === 'local'
  const hasMicrosoftAccount = accountState.microsoftAccount !== null
  const avatarChar = displayUsername.charAt(0).toUpperCase()

  const triggerLaunch = async () => {
    if (!activeProfile) return

    const username = isVirtual
      ? accountState.localAccount.username || 'Player'
      : accountState.microsoftAccount!.username

    const auth: LaunchInput['auth'] = isVirtual
      ? {
        type: 'virtual',
        username,
        uuid: '00000000-0000-0000-0000-000000000000',
        accessToken: 'offline-token-placeholder',
      }
      : {
        type: 'microsoft',
        username: accountState.microsoftAccount!.username,
        uuid: accountState.microsoftAccount!.uuid,
        accessToken: accountState.microsoftAccount!.accessToken,
        expiresAt: accountState.microsoftAccount!.expiresAt,
      }

    console.log('[Sidebar] startLaunch with profile', activeProfile.id)
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
    console.log('[Sidebar] handlePlay clicked', { activeProfile: activeProfile?.id, isBusy, isStarting, isPreparing })
    if (!activeProfile || isBusy || isStarting || isPreparing) return

    if (prepareState?.isReady) {
      await triggerLaunch()
    } else {
      setShouldLaunchAfterPrepare(true)
      void startPrepare()
    }
  }

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
  const jobProgress = state?.progress
  const percent = clamp(jobProgress?.percent ?? 0)
  const showProgress = isBusy && percent > 0
  const canCancel = isBusy && !isRunning

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col  bg-zinc-950/90">
      {/* Logo */}
      <div className="px-5 py-5 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary shrink-0 overflow-hidden">
            <img src={logoImg} alt="LetCuteMC Logo" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground leading-tight">
              LetCuteMC
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mt-0.5">
              Launcher
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <Button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              variant="sidebar"
              className={cn(
                'group relative flex w-full items-center gap-3 transition-all duration-150',
                isActive && 'bg-sidebar-accent text-primary hover:bg-sidebar-accent hover:text-primary'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={[
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
                ].join(' ')}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{item.label}</span>
            </Button>
          )
        })}
      </nav>

      {/* Unified Play & Account Card */}
      <div className="">
        <div className="rounded-xl  p-3 space-y-3">
          {/* Account Info Header (clickable to settings tab) */}
          <div
            onClick={() => onTabChange('settings')}
            className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent/30 p-1.5 rounded-lg transition duration-150"
            title="Quản lý tài khoản"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm">
              {avatarChar || 'P'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-bold text-sidebar-foreground">
                  {displayUsername}
                </span>
                {isMicrosoft ? (
                  <Badge variant="success" className="text-[8px] px-1 py-0 h-3.5 shrink-0">Microsoft</Badge>
                ) : (
                  <Badge variant="warning" className="text-[8px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">Local</Badge>
                )}
              </div>
              {activeProfile ? (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={`${activeProfile.name} (${activeProfile.minecraftVersion})`}>
                  {activeProfile.name} ({activeProfile.minecraftVersion})
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-0.5">Chưa chọn cấu hình</p>
              )}
            </div>
          </div>

          {/* Selected Profile and Play Controls */}
          {activeProfile ? (
            <div className="space-y-2.5">
              {/* Play Button */}
              {isVirtual ? (
                <Button
                  disabled={isBusy || isStarting || isPreparing}
                  onClick={handlePlay}
                  variant={isFailed ? "danger" : "primary"}
                  className="w-full h-10 rounded-xl font-bold text-xs"
                >
                  {isBusy && !isRunning ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isPreparing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} className="fill-current" />
                  )}
                  <span>
                    {isRunning
                      ? 'ĐANG CHẠY'
                      : isFailed
                        ? 'THỬ LẠI'
                        : isBusy
                          ? 'KHỞI ĐỘNG...'
                          : isPreparing
                            ? 'ĐANG TẢI...'
                            : 'CHƠI (OFFLINE)'}
                  </span>
                </Button>
              ) : !hasMicrosoftAccount ? (
                <Button
                  disabled
                  variant="outline"
                  className="w-full h-10 rounded-xl font-bold text-xs bg-muted text-muted-foreground border border-dashed border-border cursor-not-allowed select-none"
                >
                  CẦN ĐĂNG NHẬP
                </Button>
              ) : (
                <Button
                  disabled={isBusy || isStarting || isPreparing}
                  onClick={handlePlay}
                  variant={isFailed ? "danger" : "primary"}
                  className="w-full h-10 rounded-xl font-bold text-xs"
                >
                  {isBusy && !isRunning ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isPreparing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} className="fill-current" />
                  )}
                  <span>
                    {isRunning
                      ? 'ĐANG CHẠY'
                      : isFailed
                        ? 'THỬ LẠI'
                        : isBusy
                          ? 'KHỞI ĐỘNG...'
                          : isPreparing
                            ? 'ĐANG TẢI...'
                            : 'CHƠI'}
                  </span>
                </Button>
              )}

              {/* Cancel Button */}
              {canCancel && (
                <Button
                  onClick={() => void cancelLaunch()}
                  variant="outline"
                  size="sm"
                  className="w-full h-8 border-sidebar-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <Square size={11} className="fill-current" />
                  Hủy khởi động
                </Button>
              )}

              {/* Progress Bar overlay */}
              {(showProgress || (isPreparing && prepareProgress)) && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span className="truncate">{showProgress ? (jobProgress?.title || 'Đang tải...') : (prepareProgress?.title || 'Đang chuẩn bị...')}</span>
                    <span>{showProgress ? percent : (prepareProgress?.percent ?? 0)}%</span>
                  </div>
                  <div className="h-1 w-full bg-sidebar-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${showProgress ? percent : (prepareProgress?.percent ?? 0)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              disabled
              variant="outline"
              className="w-full h-10 rounded-xl font-bold text-xs bg-muted text-muted-foreground cursor-not-allowed select-none"
            >
              CHƯA CHỌN CẤU HÌNH
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
