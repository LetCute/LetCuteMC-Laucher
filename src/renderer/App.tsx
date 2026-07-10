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
import { LogsScreen } from './screens/LogsScreen';
import { ProfileModal } from './components/profiles/ProfileModal';
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

function App() {
  // ── Core state ───────────────────────────────────────────────────────────
  const [gameDir, setGameDir] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabId>('profiles');
  const [accountState, setAccountState] = useState<AccountState>({
    mode: 'local',
    microsoftAccount: null,
    localAccount: {
      username: 'Player',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
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
    enableLaunchBoost: true,
    launchBoostDurationMs: 45000,
    launchBoostPriority: 'high',
    enableAutoPrepareGame: true,
    downloadConcurrency: 8,
    manifestCacheTtlMs: 21600000,
    fastLaunchMode: true,
    enableOptimizedJvmArgs: true,
    performanceMode: 'auto',
  });

  const [versionCatalog, setVersionCatalog] = useState<MinecraftVersionCatalog | null>(null);
  const [javaSelection, setJavaSelection] = useState<JavaRuntimeSelectionResult | null>(null);

  const [isLoadingAppData, setIsLoadingAppData] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
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
  const { prepareState, isPreparing } = usePrepareGame(activeProfile, settings);
  const isWorking = isBusy || isPreparing || isStarting;

  const handleLaunchProfileDirectly = async (profileId: string) => {
    const target = profiles.find(p => p.id === profileId)
    if (!target) return

    const isVirtual = accountState.mode === 'local'
    const username = isVirtual
      ? accountState.localAccount.username || 'Player'
      : accountState.microsoftAccount?.username ?? 'Player'

    await startLaunch({
      profileId: target.id,
      version: target.minecraftVersion,
      versionType: 'release',
      gameDir: target.gameDir || gameDir,
      javaPath: javaSelection?.selectedRuntime?.javaPath ?? null,
      minMemoryMb: target.minMemoryMb || settings.defaultMinMemoryMb,
      maxMemoryMb: target.maxMemoryMb || settings.defaultMaxMemoryMb,
      serverAddress: undefined,
      auth: isVirtual
        ? { type: 'virtual', username, uuid: '00000000-0000-0000-0000-000000000000', accessToken: 'offline-token-placeholder' }
        : {
            type: 'microsoft',
            username,
            uuid: accountState.microsoftAccount!.uuid,
            accessToken: accountState.microsoftAccount!.accessToken,
            expiresAt: accountState.microsoftAccount!.expiresAt,
          },
      performance: {
        enableLaunchBoost: settings.enableLaunchBoost,
        launchBoostDurationMs: settings.launchBoostDurationMs,
        launchBoostPriority: settings.launchBoostPriority,
      },
    })
  }

  // ── App Initialization ────────────────────────────────────────────────────
  const initializeAppData = async () => {
    setIsLoadingAppData(true);
    setAppError(null);
    try {
      const dirResult = await launcherClient.detectMinecraftDirectory();
      if (!dirResult.found || !dirResult.path) {
        setAppError('Không tìm thấy thư mục .minecraft. Hãy cài Minecraft trước.');
        return;
      }

      const resolvedGameDir = dirResult.path;
      setGameDir(resolvedGameDir);

      const [loadedSettings, profileStore, catalog, initialAccountState] = await Promise.all([
        launcherClient.getSettings(),
        launcherClient.getProfiles(),
        launcherClient.getMinecraftVersionCatalog(resolvedGameDir),
        launcherClient.getAccountState(),
      ]);

      setSettings(loadedSettings);
      setProfiles(profileStore.profiles);
      setActiveProfileId(profileStore.activeProfileId);
      setVersionCatalog(catalog);
      setAccountState(initialAccountState);

      await launcherClient.scanJavaRuntimes(loadedSettings.customJavaScanDirs);
    } catch (err) {
      console.error(err);
      setAppError(err instanceof Error ? err.message : 'Không thể tải dữ liệu launcher.');
    } finally {
      setIsLoadingAppData(false);
    }
  };

  useEffect(() => {
    initializeAppData();
  }, []);

  // ── Java selection (updates when active profile or settings changes) ───────
  useEffect(() => {
    async function updateJavaSelection() {
      if (!activeProfile) {
        setJavaSelection(null);
        return;
      }
      try {
        const res = await launcherClient.selectBestJavaRuntime(
          activeProfile.minecraftVersion,
          settings.customJavaScanDirs
        );
        setJavaSelection(res);
      } catch (e) {
        console.error(e);
      }
    }
    updateJavaSelection();
  }, [activeProfile?.id, activeProfile?.minecraftVersion, settings.customJavaScanDirs]);



  // ── Profile Actions ───────────────────────────────────────────────────────
  const handleSetActiveProfile = async (id: string) => {
    try {
      const ok = await launcherClient.setActiveProfile(id);
      if (ok) setActiveProfileId(id);
    } catch (e) {
      console.error('Set active profile error:', e);
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
      alert(e instanceof Error ? e.message : 'Lỗi khi lưu profile');
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

  // ── Loading / Error screens ───────────────────────────────────────────────
  if (isLoadingAppData) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground font-sans">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
        <p className="text-sm text-muted-foreground">Đang tải cấu hình launcher...</p>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground font-sans p-6 text-center">
        <h2 className="text-xl font-bold text-destructive mb-2">Không thể tải dữ liệu launcher.</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">{appError}</p>
        <button
          onClick={initializeAppData}
          className="px-6 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_15%,transparent)]"
        >
          Thử lại
        </button>
      </div>
    );
  }

  // tabInfo removed (unused)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground font-sans">
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accountState={accountState}
        activeProfile={activeProfile}
        javaSelection={javaSelection}
        settings={settings}
        gameDir={gameDir}
        isWorking={isWorking}
      />

      <main className="flex min-w-0 flex-1 flex-col">
       <TopBar />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'profiles' && (
            <ProfilesScreen
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSetActive={handleSetActiveProfile}
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
              <ModsScreen gameDir={gameDir} />
            </div>
          )}
          {(activeTab === 'resourcepacks' || contentVisited.resourcepacks) && (
            <div className={activeTab === 'resourcepacks' ? 'h-full' : 'hidden'}>
              <ResourcePacksScreen gameDir={gameDir} />
            </div>
          )}
          {(activeTab === 'shaderpacks' || contentVisited.shaderpacks) && (
            <div className={activeTab === 'shaderpacks' ? 'h-full' : 'hidden'}>
              <ShaderPacksScreen gameDir={gameDir} />
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
              accountState={accountState}
              gameDir={gameDir}
              onAccountStateChange={setAccountState}
              appendLog={() => {/* logs now managed by useLauncherJob */}}
              isWorking={isWorking}
            />
          )}

          {activeTab === 'logs' && (
            <LogsScreen
              logs={launchJobState?.logs ?? []}
              onClear={clearLaunchLogs}
              onCopy={() => {/* copy handled inside LogsScreen */}}
              onExport={() => {/* export handled inside LogsScreen */}}
            />
          )}
        </div>
      </main>
      </div>

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
  );
}

export default App;
