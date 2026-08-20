import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar';
import type { TabId } from './components/layout/Sidebar';

import { ProfilesScreen } from './screens/ProfilesScreen';
import { VersionsScreen } from './screens/VersionsScreen';
import { ModsScreen } from './screens/ModsScreen';
import { ResourcePacksScreen } from './screens/ResourcePacksScreen';
import { ShaderPacksScreen } from './screens/ShaderPacksScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import TasksScreen from './screens/TasksScreen';
import { AboutScreen } from './screens/AboutScreen';
import { StoreScreen } from './screens/StoreScreen';
import { ProfileModal } from './components/profiles/ProfileModal';
import { UpdaterScreen } from './screens/UpdaterScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/ui/Toast';
import { launcherClient } from './services/launcherClient';
import { useLauncherJob } from './hooks/useLauncherJob';
import { usePrepareGame } from './hooks/usePrepareGame';

import type {
  LauncherProfile,
  LauncherSettings,
  JavaRuntimeSelectionResult,
  MinecraftVersionCatalog,
  CreateProfileInput,
  MinecraftVersionItem,
  AccountState,
} from '../shared/types';

// ── Bootstrap phases ────────────────────────────────────────────────────────
type BootstrapPhase =
  | 'idle'
  | 'detecting'
  | 'loading-critical'
  | 'loading-heavy'
  | 'ready'
  | 'error';

interface BootstrapProgress {
  phase: BootstrapPhase;
  message: string;
}

function App() {
  const { showToast } = useToast()

  // ── Core state ───────────────────────────────────────────────────────────
  const [appPhase, setAppPhase] = useState<'updater' | 'client'>('updater');
  const [gameDir, setGameDir] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabId>('profiles');
  const [accountState, setAccountState] = useState<AccountState>({
    activeAccountId: null,
    accounts: []
  });
  const [profiles, setProfiles] = useState<LauncherProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LauncherProfile | null>(null);
  const [preselectedVersion, setPreselectedVersion] = useState<MinecraftVersionItem | null>(null);

  const [settings, setSettings] = useState<LauncherSettings>({
    minecraftDirectory: '',
    customJavaScanDirs: [],
    defaultMinMemoryMb: 2048,
    defaultMaxMemoryMb: 4096,
    checkJavaOnStartup: true,
    checkVersionsOnStartup: true,
    autoCloseLauncherAfterStart: true,
    enableAutoPrepareGame: true,
    downloadConcurrency: 8,
    manifestCacheTtlMs: 21600000,
    fastLaunchMode: true,
    enableOptimizedJvmArgs: true,
    performanceMode: 'auto',
    enableDiscordRpc: false,
  });

  const [versionCatalog, setVersionCatalog] = useState<MinecraftVersionCatalog | null>(null);
  const [javaSelection, setJavaSelection] = useState<JavaRuntimeSelectionResult | null>(null);

  const [bootstrap, setBootstrap] = useState<BootstrapProgress>({
    phase: 'idle',
    message: 'Đang khởi động...',
  });
  const [appError, setAppError] = useState<string | null>(null);
  const [criticalReady, setCriticalReady] = useState(false);
  const [contentVisited, setContentVisited] = useState({
    mods: false,
    resourcepacks: false,
    shaderpacks: false,
  });

  useEffect(() => {
    if ((activeTab as string) === 'mods' || (activeTab as string) === 'resourcepacks' || (activeTab as string) === 'shaderpacks') {
      const key = activeTab as 'mods' | 'resourcepacks' | 'shaderpacks'
      setContentVisited(prev => (prev[key] ? prev : { ...prev, [key]: true }))
    }
  }, [activeTab]);

  // ── Launch job state (Worker Thread based, no polling) ─────────────────
  const { state: launchJobState, clearLogs: clearLaunchLogs, startLaunch, isBusy, isStarting } = useLauncherJob();

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null;
  const { isPreparing } = usePrepareGame(activeProfile, settings);
  const isBootstrapping = bootstrap.phase !== 'ready' && bootstrap.phase !== 'error';
  const isWorking = isBusy || isPreparing || isStarting || isBootstrapping;

  const handleLaunchProfileDirectly = async (profileId: string) => {
    if (isBootstrapping) return
    const target = profiles.find(p => p.id === profileId)
    if (!target) return

    const activeAccount = accountState.accounts.find(a => a.id === accountState.activeAccountId)
    const isVirtual = !activeAccount || activeAccount.type === 'local'
    const username = activeAccount?.username || 'Player'

    await startLaunch({
      profileId: target.id,
      version: target.minecraftVersion,
      versionType: 'release',
      gameDir: target.gameDir || gameDir,
      // Với profile modpack có gameDir riêng: dùng mcRootDir để XMCL tìm libraries/versions đúng chỗ
      resourcePath: target.mcRootDir || null,
      javaPath: javaSelection?.selectedRuntime?.javaPath ?? null,
      minMemoryMb: target.minMemoryMb || settings.defaultMinMemoryMb,
      maxMemoryMb: target.maxMemoryMb || settings.defaultMaxMemoryMb,
      serverAddress: undefined,
      auth: isVirtual
        ? { type: 'virtual', username, uuid: activeAccount?.uuid || '00000000-0000-0000-0000-000000000000', accessToken: 'offline-token-placeholder' }
        : {
          type: 'microsoft',
          username,
          uuid: activeAccount.uuid,
          accessToken: activeAccount.accessToken || '',
          expiresAt: activeAccount.expiresAt,
        },
    })
  }

  // ── Progressive bootstrap: shell first, heavy later ───────────────────────
  const initializeAppData = async () => {
    setAppError(null);
    setCriticalReady(false);
    setBootstrap({ phase: 'detecting', message: 'Đang kiểm tra Minecraft...' });

    try {
      // Wait briefly if main IPC still registering (deferred load)
      for (let i = 0; i < 40; i++) {
        if (window.launcherApi) break
        await new Promise(r => setTimeout(r, 25))
      }

      const dirResult = await launcherClient.detectMinecraftDirectory();
      if (!dirResult.found || !dirResult.path) {
        setAppError('Không tìm thấy thư mục .minecraft. Hãy cài Minecraft trước.');
        setBootstrap({ phase: 'error', message: 'Lỗi thư mục game' });
        return;
      }

      const resolvedGameDir = dirResult.path;
      setGameDir(resolvedGameDir);

      // Phase 1 — critical local data only (disk, no network)
      setBootstrap({ phase: 'loading-critical', message: 'Đang tải cài đặt...' });
      const [loadedSettings, profileStore, initialAccountState] = await Promise.all([
        launcherClient.getSettings(),
        launcherClient.getProfiles(),
        launcherClient.getAccountState(),
      ]);

      setSettings(loadedSettings);
      setProfiles(profileStore.profiles);
      setActiveProfileId(profileStore.activeProfileId);
      setAccountState(initialAccountState);
      setCriticalReady(true);
      setBootstrap({ phase: 'loading-heavy', message: 'Đang tải phiên bản...' });

      // Phase 2 — heavy: version catalog (network) + java scan (disk walk)
      // Yield a frame so shell paints before heavy work
      await new Promise(r => requestAnimationFrame(() => r(undefined)));

      const [catalog] = await Promise.all([
        launcherClient.getMinecraftVersionCatalog(resolvedGameDir).catch((e) => {
          console.error('Version catalog failed:', e);
          return null;
        }),
        launcherClient.scanJavaRuntimes(loadedSettings.customJavaScanDirs).catch((e) => {
          console.error('Java scan failed:', e);
          return null;
        }),
      ]);

      if (catalog) setVersionCatalog(catalog);
      setBootstrap({ phase: 'ready', message: 'Sẵn sàng' });
    } catch (err) {
      console.error(err);
      setAppError(err instanceof Error ? err.message : 'Không thể tải dữ liệu launcher.');
      setBootstrap({ phase: 'error', message: 'Lỗi khởi động' });
    }
  };

  useEffect(() => {
    if (appPhase === 'client') {
      void initializeAppData();
    }
  }, [appPhase]);

  useEffect(() => {
    // Listen for task completion to reload app data
    const unsubscribe = window.launcherApi.onTasksUpdate(async (event) => {
      if (event.type === 'task-completed') {
        const { task } = event;
        if (task.taskType === 'install-modpack' && task.result?.profileId) {
          // A modpack was just installed, reload profiles
          await initializeAppData();
          await handleSetActiveProfile(task.result.profileId);
          setActiveTab('mods');
        } else if (task.taskType === 'install-mod') {
          // Optionally, reload mods list or store installations if needed
          // For now, doing nothing is fine as StoreScreen can reload its own state
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // ── Java selection (after critical ready + profile known) ─────────────────
  useEffect(() => {
    async function updateJavaSelection() {
      if (!criticalReady || !activeProfile) {
        setJavaSelection(null);
        return;
      }
      try {
        const res = await launcherClient.selectBestJavaRuntime(
          activeProfile.minecraftVersion,
          settings.customJavaScanDirs,
          {
            gameDir: activeProfile.gameDir || gameDir,
            preferredJavaPath: activeProfile.javaPath,
          }
        );
        setJavaSelection(res);
      } catch (e) {
        console.error(e);
      }
    }
    void updateJavaSelection();
  }, [
    criticalReady,
    activeProfile?.id,
    activeProfile?.minecraftVersion,
    activeProfile?.gameDir,
    activeProfile?.javaPath,
    settings.customJavaScanDirs,
    gameDir,
  ]);



  // ── Discord RPC Updates ──────────────────────────────────────────────────
  useEffect(() => {
    if (settings.enableDiscordRpc && window.launcherApi && launchJobState?.status !== 'running' && launchJobState?.status !== 'launching') {
      let details = 'Đang ở sảnh chờ'
      let state = 'Chuẩn bị vào game...'
      
      switch (activeTab) {
        case 'store': details = 'Đang khám phá Cửa hàng'; state = 'Tìm kiếm mods & modpacks'; break;
        case 'profiles': details = 'Đang quản lý Profile'; state = 'Sẵn sàng khởi động'; break;
        case 'versions': details = 'Đang quản lý Phiên bản'; state = 'Tải phiên bản Minecraft'; break;
        case 'mods': details = 'Đang quản lý Mods'; state = 'Tuỳ biến Mods'; break;
        case 'resourcepacks': details = 'Đang xem Resource Packs'; state = 'Thay đổi giao diện'; break;
        case 'shaderpacks': details = 'Đang xem Shader Packs'; state = 'Thay đổi đồ hoạ'; break;
        case 'settings': details = 'Đang cài đặt Launcher'; state = 'Tinh chỉnh hệ thống'; break;
        case 'accounts': details = 'Đang xem thư viện Skin'; state = 'Quản lý tài khoản'; break;
        case 'tasks': details = 'Đang xem Tiến trình'; state = 'Theo dõi tác vụ chạy ngầm'; break;
        case 'about': details = 'Đang xem thông tin'; state = 'LetCuteMC Launcher'; break;
      }

      window.launcherApi.setDiscordActivity(details, state).catch(console.error)
    }
  }, [activeTab, settings.enableDiscordRpc, launchJobState?.status])

  // ── Profile Actions ───────────────────────────────────────────────────────
  const handleSetActiveProfile = async (id: string) => {
    try {
      const ok = await launcherClient.setActiveProfile(id);
      if (ok) {
        setActiveProfileId(id);
      } else {
        alert('Failed to set active profile in backend');
      }
    } catch (e) {
      console.error('Set active profile error:', e);
      alert('Error: ' + e);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình này không?')) return;
    try {
      const ok = await launcherClient.deleteProfile(id);
      if (ok) {
        setProfiles(prev => prev.filter(p => p.id !== id));
        if (activeProfileId === id) setActiveProfileId(null);
      }
    } catch (e) {
      console.error('Delete profile error:', e);
    }
  };

  const handleSaveProfile = async (profileData: CreateProfileInput) => {
    try {
      if (editingProfile) {
        const updated = await launcherClient.updateProfile(editingProfile.id, profileData);
        setProfiles(prev => prev.map(p => (p.id === editingProfile.id ? updated : p)));
      } else {
        const created = await launcherClient.createProfile(profileData);
        setProfiles(prev => [...prev, created]);
        if (profiles.length === 0) {
          setActiveProfileId(created.id);
          await launcherClient.setActiveProfile(created.id);
        }
      }
      setIsProfileModalOpen(false);
      setEditingProfile(null);
      setPreselectedVersion(null);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Lỗi khi lưu profile');
    }
  };

  const openCreateProfile = (versionItem?: MinecraftVersionItem) => {
    setEditingProfile(null);
    setPreselectedVersion(versionItem ?? null);
    setIsProfileModalOpen(true);
  };

  const openEditProfile = (profile?: LauncherProfile) => {
    const target = profile ?? activeProfile;
    if (!target) return;
    setEditingProfile(target);
    setPreselectedVersion(null);
    setIsProfileModalOpen(true);
  };

  // Hard error only when critical path failed before shell usable
  if (appError && !criticalReady) {
    return (
      <ToastProvider>
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground font-sans p-6 text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">Không thể tải dữ liệu launcher.</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">{appError}</p>
          <button
            onClick={() => void initializeAppData()}
            className="px-6 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_15%,transparent)]"
          >
            Thử lại
          </button>
        </div>
      </ToastProvider>
    );
  }

  if (appPhase === 'updater') {
    return <UpdaterScreen onComplete={() => setAppPhase('client')} />;
  }

  return (
    <ToastProvider>
      <div
        className="flex h-screen w-screen flex-col overflow-hidden bg-[#1c2127] text-foreground font-sans relative"
      >

        {/* Content container - must have z-index to stay above the overlay */}
        <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
          {!criticalReady ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-[#1c2127]">
              <img src="./logo.png" alt="LetCuteMC" className="w-32 h-32 animate-pulse" />
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm font-medium">{bootstrap.message}</span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                accountState={accountState}
                onAccountStateChange={setAccountState}
                activeProfile={activeProfile}
                profiles={profiles}
                onSetActiveProfile={handleSetActiveProfile}
                javaSelection={javaSelection}
                settings={settings}
                gameDir={gameDir}
                isWorking={isWorking}
              />

              <main className="flex min-w-0 flex-1 flex-col">
                <TopBar />

                {isBootstrapping && (
                  <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-4 py-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>{bootstrap.message}</span>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ErrorBoundary fallbackMessage="Màn hình này đang gặp sự cố. Vui lòng thử lại.">
                    {activeTab === 'store' && (
                      <StoreScreen
                        gameDir={activeProfile?.gameDir || gameDir}
                        profiles={profiles}
                        activeProfileId={activeProfileId}
                        onInstallSuccess={async (newProfileId) => {
                          await initializeAppData();
                          await handleSetActiveProfile(newProfileId);
                          setActiveTab('mods');
                        }}
                      />
                    )}

                    {activeTab === 'profiles' && (
                      <ProfilesScreen
                        profiles={profiles}
                        activeProfileId={activeProfileId}
                        onSetActive={handleSetActiveProfile}
                        onCreateProfile={() => openCreateProfile()}
                        onEdit={openEditProfile}
                        onDelete={handleDeleteProfile}
                        onLaunchProfile={handleLaunchProfileDirectly}
                        isWorking={isWorking}
                      />
                    )}

                    {activeTab === 'versions' && (
                      <VersionsScreen
                        catalog={versionCatalog}
                        gameDir={gameDir}
                        onCreateProfile={(versionItem) => openCreateProfile(versionItem)}
                        onRefresh={async () => {
                          if (!gameDir) return
                          const catalog = await launcherClient.getMinecraftVersionCatalog(gameDir)
                          setVersionCatalog(catalog)
                        }}
                        isWorking={isWorking}
                      />
                    )}

                    {/* Keep mounted after first open — avoid re-scan every tab switch */}
                    {(activeTab === 'mods' || contentVisited.mods) && (
                      <div className={activeTab === 'mods' ? 'h-full' : 'hidden'}>
                        <ModsScreen gameDir={activeProfile?.gameDir || gameDir} profileName={activeProfile?.name} />
                      </div>
                    )}

                    {(activeTab === 'resourcepacks' || contentVisited.resourcepacks) && (
                      <div className={activeTab === 'resourcepacks' ? 'h-full' : 'hidden'}>
                        <ResourcePacksScreen gameDir={activeProfile?.gameDir || gameDir} profileName={activeProfile?.name} />
                      </div>
                    )}

                    {(activeTab === 'shaderpacks' || contentVisited.shaderpacks) && (
                      <div className={activeTab === 'shaderpacks' ? 'h-full' : 'hidden'}>
                        <ShaderPacksScreen gameDir={activeProfile?.gameDir || gameDir} profileName={activeProfile?.name} />
                      </div>
                    )}

                    {activeTab === 'settings' && (
                      <SettingsScreen
                        settings={settings}
                        activeProfile={activeProfile}
                        onSave={async (s) => {
                          const updated = await launcherClient.updateSettings(s);
                          setSettings(updated);
                        }}
                        onSaveJavaPath={async (javaPath) => {
                          if (!activeProfile) return;
                          const updated = await launcherClient.updateProfile(activeProfile.id, { javaPath });
                          setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                        }}
                        accountState={accountState}
                        gameDir={gameDir}
                        onAccountStateChange={setAccountState}
                        appendLog={() => {/* logs now managed by useLauncherJob */ }}
                        isWorking={isWorking}
                      />
                    )}

                    {activeTab === 'accounts' && (
                      <AccountsScreen
                        accountState={accountState}
                        onAccountStateChange={setAccountState}
                        appendLog={() => { }}
                        isWorking={isWorking}
                      />
                    )}

                    {activeTab === 'tasks' && (
                      <TasksScreen />
                    )}

                    {activeTab === 'about' && (
                      <AboutScreen />
                    )}
                  </ErrorBoundary>
                </div>
              </main>
            </div>
          )}

          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => {
              setIsProfileModalOpen(false);
              setEditingProfile(null);
              setPreselectedVersion(null);
            }}
            onSave={handleSaveProfile}
            profile={editingProfile}
            versionCatalog={versionCatalog}
            preselectedVersion={preselectedVersion}
            defaultGameDir={gameDir}
          />
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;
