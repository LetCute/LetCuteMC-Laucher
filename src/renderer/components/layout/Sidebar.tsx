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
  Square,
  User,
  Heart,
  ChevronDown,
  LogOut,
  Settings2,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import logoImg from '../../assets/logo.png'
import steveImg from '../../assets/steve.png'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu'

export type TabId = 'profiles' | 'versions' | 'mods' | 'resourcepacks' | 'shaderpacks' | 'accounts' | 'settings' | 'logs' | 'about'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  accountState: AccountState
  onAccountStateChange: (state: AccountState) => void
  activeProfile: LauncherProfile | null
  javaSelection: JavaRuntimeSelectionResult | null
  settings: LauncherSettings
  gameDir: string
  isWorking?: boolean
}

const MENU_ITEMS = [
  { id: 'profiles', label: 'Cấu hình game', icon: Layers },
  { id: 'versions', label: 'Phiên bản', icon: List },
  { id: 'accounts', label: 'Tài khoản', icon: User },
  { id: 'mods', label: 'Mods', icon: Box },
  { id: 'resourcepacks', label: 'Resource Packs', icon: PackageOpen },
  { id: 'shaderpacks', label: 'Shader Packs', icon: Zap },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
  { id: 'logs', label: 'Nhật ký', icon: TerminalSquare },
  { id: 'about', label: 'Giới thiệu', icon: Heart },
] as const

export function Sidebar({
  activeTab,
  onTabChange,
  accountState,
  onAccountStateChange,
  activeProfile,
  javaSelection,
  settings,
  gameDir,
}: SidebarProps) {
  const { state, isBusy, isStarting, isRunning, isFailed, startLaunch, cancelLaunch } = useLauncherJob()
  const { prepareState, progress: prepareProgress, isPreparing, startPrepare } = usePrepareGame(activeProfile, settings)
  const [shouldLaunchAfterPrepare, setShouldLaunchAfterPrepare] = useState(false)

  const accounts = accountState?.accounts || []
  const activeAccount = accounts.find(a => a.id === accountState?.activeAccountId)
  const isMicrosoft = activeAccount?.type === 'microsoft'
  const displayUsername = activeAccount?.username || 'Player'
  const isVirtual = !activeAccount || activeAccount.type === 'local'
  const hasMicrosoftAccount = activeAccount?.type === 'microsoft'

  const triggerLaunch = async () => {
    if (!activeProfile) return

    const auth: LaunchInput['auth'] = isVirtual
      ? {
        type: 'virtual',
        username: displayUsername,
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
                isActive && 'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground'
              )}
            >
              <Icon
                className={[
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground',
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
          {/* Account Info Header */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent/30 p-1.5 rounded-lg transition duration-150"
                title="Đổi tài khoản"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xs bg-zinc-800 border border-zinc-700 shadow-sm flex items-center justify-center">
                  <img
                    src={isMicrosoft && activeAccount
                      ? `https://minotar.net/helm/${activeAccount.username}/64.png`
                      : steveImg}
                    alt={displayUsername}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = steveImg
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-bold text-sidebar-foreground">
                      {displayUsername}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
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
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Tài khoản của bạn</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-48 overflow-y-auto">
                {accounts.map(acc => {
                  const isActive = acc.id === activeAccount?.id
                  return (
                    <DropdownMenuItem
                      key={acc.id}
                      onClick={async () => {
                        if (!isActive) {
                          try {
                            const updated = await window.launcherApi.selectAccount(acc.id)
                            onAccountStateChange(updated)
                          } catch(err) {
                            console.error(err)
                          }
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <img
                        src={acc.type === 'microsoft' ? `https://minotar.net/helm/${acc.username}/64.png` : steveImg}
                        className="h-5 w-5 rounded-sm mr-2 object-cover border border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{acc.username}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">{acc.type}</p>
                      </div>
                      {isActive && <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 ml-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                    </DropdownMenuItem>
                  )
                })}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTabChange('accounts')} className="cursor-pointer">
                <Settings2 className="h-4 w-4 mr-2" />
                <span className="text-xs">Quản lý tài khoản</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
