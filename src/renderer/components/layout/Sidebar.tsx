import { useState, useEffect, useRef } from 'react'
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
  Globe,
  Camera,
  ScrollText,
  BarChart3,
  ArrowLeft,
  ChevronRight,
  Gamepad2,
} from 'lucide-react'
import { useToast } from '../ui/Toast'
// Images now loaded directly from public/assets
import type {
  LauncherProfile,
  JavaRuntimeSelectionResult,
  LauncherSettings,
  AccountState
} from '@/shared/types'
import { useLauncherJob } from '../../hooks/useLauncherJob'
import { usePrepareGame } from '../../hooks/usePrepareGame'
import { buildLaunchAuthSession } from '../../../shared/auth'
import { useAccounts } from '../../hooks/useAccounts'
import { cn, formatVersionDisplay } from '@/lib/utils'
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

export type TabId = 'store' | 'profiles' | 'versions' | 'worlds' | 'mods' | 'resourcepacks' | 'shaderpacks' | 'screenshots' | 'logs' | 'stats' | 'accounts' | 'settings' | 'tasks' | 'about'

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

const GAME_MANAGEMENT_ITEMS = [
  { id: 'profiles', label: 'Cấu hình game', icon: Layers },
  { id: 'versions', label: 'Phiên bản', icon: List },
  { id: 'worlds', label: 'Thế giới', icon: Globe },
  { id: 'mods', label: 'Mods', icon: Box },
  { id: 'resourcepacks', label: 'Resource Packs', icon: PackageOpen },
  { id: 'shaderpacks', label: 'Shader Packs', icon: Zap },
  { id: 'screenshots', label: 'Ảnh chụp', icon: Camera },
  { id: 'logs', label: 'Nhật ký', icon: ScrollText },
] as const

const MAIN_ITEMS = [
  { id: 'store', label: 'Cửa hàng', icon: ModrinthIcon },
  { id: 'stats', label: 'Thống kê', icon: BarChart3 },
  { id: 'accounts', label: 'Tài khoản', icon: User },
  { id: 'tasks', label: 'Tiến trình', icon: Activity },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
  { id: 'about', label: 'Giới thiệu', icon: Heart },
] as const

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

  const isGameTab = GAME_MANAGEMENT_ITEMS.some((item) => item.id === activeTab)
  const [navView, setNavView] = useState<'main' | 'game'>(isGameTab ? 'game' : 'main')

  useEffect(() => {
    if (isGameTab) {
      setNavView('game')
    }
  }, [activeTab, isGameTab])

  const {
    accounts,
    activeAccount,
    displayUsername,
    isVirtual,
    hasMicrosoftAccount,
    getAccountAvatar,
    selectAccount,
  } = useAccounts({
    initialState: accountState,
    onStateChange: onAccountStateChange,
  })

  const triggerLaunch = async () => {
    if (!activeProfile) return

    const auth = buildLaunchAuthSession(activeAccount, isVirtual, displayUsername)

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

  // Show error toast if launch fails (only once per error)
  const lastShownLaunchErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (isFailed && state?.error) {
      if (lastShownLaunchErrorRef.current !== state.error) {
        lastShownLaunchErrorRef.current = state.error
        showToast('error', state.error, { title: state.progress?.title || 'Lỗi khởi động game' })
      }
    } else if (!isFailed) {
      lastShownLaunchErrorRef.current = null
    }
  }, [isFailed, state?.error, state?.progress?.title, showToast])

  // Show error toast if prepare fails
  const lastShownPrepareErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (prepareProgress?.status === 'failed' && prepareProgress.message) {
      setShouldLaunchAfterPrepare(false)
      if (lastShownPrepareErrorRef.current !== prepareProgress.message) {
        lastShownPrepareErrorRef.current = prepareProgress.message
        showToast('error', prepareProgress.message, { title: prepareProgress.title || 'Lỗi chuẩn bị game' })
      }
    } else if (prepareProgress?.status !== 'failed') {
      lastShownPrepareErrorRef.current = null
    }
  }, [prepareProgress?.status, prepareProgress?.message, prepareProgress?.title, showToast])

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
    <aside className="sidebar-panel flex h-full w-64 shrink-0 flex-col border-r border-zinc-800/80 shadow-[4px_0_24px_rgba(0,0,0,0.3)] z-20">
      {/* Logo */}
      <div className="px-5 py-5 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/15 text-primary shrink-0 overflow-hidden">
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
            <div className="flex w-full cursor-pointer items-center justify-between rounded-md border border-zinc-800/80 bg-zinc-900/85 p-2.5 transition-all hover:bg-zinc-900 hover:border-primary/40 hover:text-accent-foreground group shadow-sm">
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Cấu hình hiện tại</span>
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {activeProfile ? activeProfile.name : 'Chưa có cấu hình'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-[220px] dropdown-panel rounded-md p-1.5 z-50">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Danh sách Cấu hình</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {profiles.length > 0 ? profiles.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => onSetActiveProfile(p.id)}
                onClick={() => onSetActiveProfile(p.id)}
                className="flex items-center gap-2 py-2 cursor-pointer"
              >
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", activeProfile?.id === p.id ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-transparent")} />
                <span className={cn("truncate flex-1 font-medium", activeProfile?.id === p.id ? "text-primary font-bold" : "text-foreground")}>{p.name}</span>
              </DropdownMenuItem>
            )) : (
              <div className="p-2 text-center text-xs text-muted-foreground">Không có cấu hình nào.</div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onTabChange('profiles')} onClick={() => onTabChange('profiles')} className="text-primary focus:text-primary cursor-pointer">
              <Layers className="mr-2 h-4 w-4" />
              Quản lý Cấu hình
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation (2-Level Sliding Structure) */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {navView === 'game' ? (
          <div className="space-y-1">
            {/* Back Button */}
            <Button
              onClick={() => setNavView('main')}
              variant="sidebar"
              className="group relative flex w-full items-center gap-2.5 mb-2 bg-zinc-900/90 border border-zinc-800 hover:border-primary/40 text-primary font-bold text-xs rounded-md h-9 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span>Quay lại Menu chính</span>
            </Button>

            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1">
              Tài nguyên & Cấu hình
            </div>

            {GAME_MANAGEMENT_ITEMS.map((item) => {
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
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span>{item.label}</span>
                </Button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Store Button */}
            <Button
              onClick={() => onTabChange('store')}
              variant="sidebar"
              className={cn(
                'group relative flex w-full items-center gap-3 transition-all duration-150',
                activeTab === 'store' && 'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground'
              )}
            >
              <ModrinthIcon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  activeTab === 'store' ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'
                )}
              />
              <span>Cửa hàng</span>
            </Button>

            {/* Game Management Sub-Menu Slider Trigger */}
            <Button
              onClick={() => {
                setNavView('game')
                if (!isGameTab) {
                  onTabChange('profiles')
                }
              }}
              variant="sidebar"
              className={cn(
                'group relative flex w-full items-center justify-between gap-3 transition-all duration-150',
                isGameTab
                  ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Gamepad2
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isGameTab ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'
                  )}
                  strokeWidth={isGameTab ? 2.5 : 2}
                />
                <span className="truncate font-semibold">Quản lý Game</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold group-hover:bg-zinc-800 group-hover:text-zinc-200">
                  8 mục
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
              </div>
            </Button>

            {/* Accounts, Tasks, Settings, About */}
            {MAIN_ITEMS.filter((item) => item.id !== 'store').map((item) => {
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
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground'
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span>{item.label}</span>
                </Button>
              )
            })}

            {/* Discord Button */}
            <Button
              onClick={() => window.launcherApi.openExternal('https://discord.gg/rRZujVzPRx')}
              variant="sidebar"
              className="group relative flex w-full items-center gap-3 transition-all duration-150 text-[#5865F2] hover:bg-[#5865F2]/10 hover:text-[#5865F2]"
            >
              <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span className="font-semibold tracking-wide">Discord Server</span>
            </Button>
          </div>
        )}
      </nav>

      {/* Unified Play & Account Card */}
      <div className="">
        <div className="rounded-md  p-3 space-y-3">
          {/* Account Info Header */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent p-1.5 rounded-md transition duration-150"
                title="Đổi tài khoản"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xs bg-zinc-800 border border-zinc-700 shadow-sm flex items-center justify-center">
                  {(() => {
                    const avatarData = activeAccount
                      ? getAccountAvatar(activeAccount)
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
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={`${activeProfile.name} (${formatVersionDisplay(activeProfile.minecraftVersion)})`}>
                      {activeProfile.name} ({formatVersionDisplay(activeProfile.minecraftVersion)})
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Chưa chọn cấu hình</p>
                  )}
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              avoidCollisions={false}
              className="w-56 dropdown-panel rounded-md p-1.5 z-50"
            >
              <DropdownMenuLabel>Tài khoản của bạn</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-48 overflow-y-auto">
                {accounts.map(acc => {
                  const isActive = acc.id === activeAccount?.id
                  return (
                    <DropdownMenuItem
                      key={acc.id}
                      onClick={() => {
                        if (!isActive) {
                          void selectAccount(acc.id)
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {(() => {
                        const avatarData = getAccountAvatar(acc)
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
                  className="w-full h-10 rounded-md font-bold text-xs"
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
                  className="w-full h-10 rounded-md font-bold text-xs bg-muted text-muted-foreground border border-dashed border-border cursor-not-allowed select-none"
                >
                  CẦN ĐĂNG NHẬP
                </Button>
              ) : (
                <Button
                  disabled={isBusy || isStarting || isPreparing}
                  onClick={handlePlay}
                  variant={isFailed ? "danger" : "primary"}
                  className="w-full h-10 rounded-md font-bold text-xs"
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
              className="w-full h-10 rounded-md font-bold text-xs bg-muted text-muted-foreground cursor-not-allowed select-none"
            >
              CHƯA CHỌN CẤU HÌNH
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
