import { useState, useEffect } from 'react'
import {
  Box,
  Layers,
  List,
  PackageOpen,
  Settings,
  Zap,
  Play,
  Loader2,
  Square,
  User,
  Heart,
  ChevronDown,
  Settings2,
  Activity,
} from 'lucide-react'
import { useToast } from '../ui/Toast'
// Images now loaded directly from public/assets
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
import { SkinHead } from '../ui/SkinHead'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu'
import pkg from '../../../../package.json'

export type TabId = 'store' | 'profiles' | 'versions' | 'mods' | 'resourcepacks' | 'shaderpacks' | 'accounts' | 'settings' | 'tasks' | 'about'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  accountState: AccountState
  onAccountStateChange: (state: AccountState) => void
  activeProfile: LauncherProfile | null
  profiles: LauncherProfile[]
  onSetActiveProfile: (id: string) => void
  javaSelection: JavaRuntimeSelectionResult | null
  settings: LauncherSettings
  gameDir: string
  isWorking?: boolean
}

import { ModrinthIcon } from '../icons/ModrinthIcon'
const MENU_ITEMS = [
  { id: 'store', label: 'Cửa hàng', icon: ModrinthIcon },

  { id: 'profiles', label: 'Cấu hình game', icon: Layers },
  { id: 'versions', label: 'Phiên bản', icon: List },

  { id: 'mods', label: 'Mods', icon: Box },
  { id: 'resourcepacks', label: 'Resource Packs', icon: PackageOpen },
  { id: 'shaderpacks', label: 'Shader Packs', icon: Zap },

  { id: 'accounts', label: 'Tài khoản', icon: User },
  { id: 'tasks', label: 'Tiến trình', icon: Activity },

  { id: 'settings', label: 'Cài đặt', icon: Settings },
  { id: 'about', label: 'Giới thiệu', icon: Heart },
] as const;


export function Sidebar({
  activeTab,
  onTabChange,
  accountState,
  onAccountStateChange,
  activeProfile,
  profiles,
  onSetActiveProfile,
  javaSelection,
  settings,
  gameDir,
}: SidebarProps) {
  const { showToast } = useToast()

  const { state, isBusy, isStarting, isRunning, isFailed, startLaunch, cancelLaunch } = useLauncherJob()
  const { prepareState, progress: prepareProgress, isPreparing, startPrepare } = usePrepareGame(activeProfile, settings)
  const [shouldLaunchAfterPrepare, setShouldLaunchAfterPrepare] = useState(false)

  const accounts = accountState?.accounts || []
  const activeAccount = accounts.find(a => a.id === accountState?.activeAccountId)
  const displayUsername = activeAccount?.username || 'Player'
  const isVirtual = !activeAccount || activeAccount.type === 'local'
  const hasMicrosoftAccount = activeAccount?.type === 'microsoft'

  // Read custom skin from localStorage (shared with AccountsScreen)
  const getAccountAvatar = (accId: string, accType: string, accUsername: string): { url: string, isFullSkin: boolean } => {
    try {
      const saved = localStorage.getItem('letcutemc_skinMap')
      if (saved) {
        const skinMap = JSON.parse(saved)
        if (skinMap[accId]?.url) return { url: skinMap[accId].url, isFullSkin: true }
      }
    } catch { /* ignore */ }
    // Fallback: Microsoft uses minotar, local uses steve
    return {
      url: accType === 'microsoft'
        ? `https://minotar.net/helm/${accUsername}/64.png`
        : steveImg,
      isFullSkin: false
    }
  }

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

    await startLaunch({
      profileId: activeProfile.id,
      version: activeProfile.minecraftVersion,
      versionType: 'release',
      gameDir: activeProfile.gameDir || gameDir,
      resourcePath: activeProfile.mcRootDir || null,
      javaPath: javaSelection?.selectedRuntime?.javaPath ?? null,
      minMemoryMb: activeProfile.minMemoryMb || settings.defaultMinMemoryMb,
      maxMemoryMb: activeProfile.maxMemoryMb || settings.defaultMaxMemoryMb,
      serverAddress: undefined,
      auth,
    })
  }

  // Auto-launch when prepare succeeds
  useEffect(() => {
    if (shouldLaunchAfterPrepare && prepareState?.isReady && !isPreparing) {
      setShouldLaunchAfterPrepare(false)
      void triggerLaunch()
    }
  }, [shouldLaunchAfterPrepare, prepareState?.isReady, isPreparing])

  // Show error toast if launch fails
  useEffect(() => {
    if (isFailed && state?.error) {
      showToast('error', state.error)
    }
  }, [isFailed, state?.error, showToast])

  const handlePlay = async () => {

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
    <aside className="flex h-full w-64 shrink-0 flex-col bg-background/50 backdrop-blur-sm border-r border-border/30 shadow-[4px_0_24px_rgba(0,0,0,0.2)] z-20">
      {/* Logo */}
      <div className="px-5 py-5 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary shrink-0 overflow-hidden">
            <img src="./logo.png" alt="LetCuteMC Logo" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground leading-tight">
              LetCuteMC
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mt-0.5">
              Launcher <strong className="text-gray-600 text-[9px]">V</strong><strong className="text-gray-600 text-[7px]">{pkg.version} </strong>
            </p>
          </div>
        </div>
      </div>

      {/* Profile Selector */}
      <div className="px-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border/30 bg-background/50 backdrop-blur-sm p-2.5 transition-colors hover:bg-accent/40 hover:text-accent-foreground group">
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Cấu hình hiện tại</span>
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {activeProfile ? activeProfile.name : 'Chưa có cấu hình'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-[220px] border-zinc-800/80 bg-background/50 backdrop-blur-md">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Danh sách Cấu hình</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {profiles.length > 0 ? profiles.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => onSetActiveProfile(p.id)}
                className="flex items-center gap-2 py-2 cursor-pointer"
              >
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", activeProfile?.id === p.id ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-transparent")} />
                <span className="truncate flex-1 font-medium">{p.name}</span>
              </DropdownMenuItem>
            )) : (
              <div className="p-2 text-center text-xs text-muted-foreground">Không có cấu hình nào.</div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onTabChange('profiles')} className="text-primary focus:text-primary cursor-pointer">
              <Layers className="mr-2 h-4 w-4" />
              Quản lý Cấu hình
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
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
                className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent p-1.5 rounded-lg transition duration-150"
                title="Đổi tài khoản"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xs bg-zinc-800 border border-zinc-700 shadow-sm flex items-center justify-center">
                  {(() => {
                    const avatarData = activeAccount
                      ? getAccountAvatar(activeAccount.id, activeAccount.type, activeAccount.username)
                      : { url: './assets/steve.png', isFullSkin: false }

                    if (avatarData.isFullSkin) {
                      return <SkinHead skinUrl={avatarData.url} size={36} className="h-full w-full object-cover" />
                    }
                    return (
                      <img
                        src={avatarData.url}
                        alt={displayUsername}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = './assets/steve.png'
                        }}
                      />
                    )
                  })()}
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
            <DropdownMenuContent align="end" className="w-56 border-zinc-800/80 bg-background/50 backdrop-blur-md">
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
                          } catch (err) {
                            console.error(err)
                          }
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {(() => {
                        const avatarData = getAccountAvatar(acc.id, acc.type, acc.username)
                        if (avatarData.isFullSkin) {
                          return <SkinHead skinUrl={avatarData.url} size={20} className="h-5 w-5 rounded-sm mr-2 object-cover border border-border" />
                        }
                        return (
                          <img
                            src={avatarData.url}
                            className="h-5 w-5 rounded-sm mr-2 object-cover border border-border"
                          />
                        )
                      })()}
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
