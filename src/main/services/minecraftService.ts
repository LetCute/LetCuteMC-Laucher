import path from 'node:path';
import fs from 'node:fs/promises';
import { Version, launch as xmclLaunch, type ResolvedVersion } from '@xmcl/core';
import type {
  LaunchInput,
  LaunchResult,
  LauncherLogLevel,
  LauncherProgress,
  MinecraftVersionType,
  LauncherProfile,
  AuthSession,
} from '../../shared/types';
import { selectBestJavaRuntime } from './javaScannerService.js';
import { getSettings } from './settingsService.js';
import { generateOfflineUuid } from './accountService.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

  /** Map version types (kept for compatibility, XMCL uses ResolvedVersion directly) */
function resolveLauncherCoreVersionType(
  versionType: MinecraftVersionType
): 'release' | 'snapshot' | 'old_beta' | 'old_alpha' {
  switch (versionType) {
    case 'release': return 'release';
    case 'snapshot': return 'snapshot';
    case 'old_beta': return 'old_beta';
    case 'old_alpha': return 'old_alpha';
    case 'unknown':
    default: return 'release';
  }
}

/**
 * Validate auth before real launch.
 * - Virtual profile: allowed with offline auth (random UUID + virtualUsername).
 * - Microsoft profile: requires a real MSA session.
 */
function validateRealLaunchAuth(
  auth: AuthSession | null | undefined
): string | null {
  if (!auth) {
    return 'Bạn cần thông tin tài khoản để chơi.';
  }

  if (auth.type === 'virtual') {
    if (!auth.username) {
      return 'Tên người chơi Local không được rỗng.';
    }
    return null;
  }

  if (auth.type !== 'microsoft') {
    return 'Phiên đăng nhập không hợp lệ.';
  }

  if (!auth.username || !auth.uuid || !auth.accessToken) {
    return 'Phiên Microsoft auth bị thiếu thông tin.';
  }

  return null;
}



/** Basic structural validation for a launch input (not auth-related). */
function validateLaunchInput(input: LaunchInput): string | null {
  if (!input.profileId) return 'Thiếu profile ID.';
  if (!input.version) return 'Chưa chọn Minecraft version.';
  if (!input.gameDir) return 'Chưa có thư mục .minecraft.';
  if (input.minMemoryMb < 512) return 'RAM tối thiểu phải từ 512 MB.';
  if (input.maxMemoryMb < input.minMemoryMb) return 'RAM max phải lớn hơn hoặc bằng RAM min.';
  return null;
}

// ─── Test Profile Config (Virtual / Local) ────────────────────────────────────



// ─── Real Launch ──────────────────────────────────────────────────────────────

export async function launchMinecraft(
  input: LaunchInput,
  profile: LauncherProfile,
  onLog?: (level: LauncherLogLevel, message: string) => void,
  onProgress?: (progress: Partial<LauncherProgress>) => void,
  onExit?: (code: number) => void
): Promise<LaunchResult> {
  const log = (level: LauncherLogLevel, msg: string) => {
    onLog?.(level, msg);
    console.log(`[${level.toUpperCase()}] ${msg}`);
  };

  try {
    // ── Guard: validate structural input ─────────────────────────────────
    const inputError = validateLaunchInput(input);
    if (inputError) {
      log('error', inputError);
      return { ok: false, status: 'failed', message: inputError };
    }

    // ── Guard: validate auth ──────────────────────────────────────────────
    const authError = validateRealLaunchAuth(input.auth);
    if (authError) {
      log('error', authError);
      onProgress?.({
        stage: 'failed',
        title: 'Launch Blocked',
        message: authError,
        percent: 100,
      });
      return { ok: false, status: 'failed', message: authError };
    }

    const effectiveAuth: AuthSession = input.auth!;
    if (effectiveAuth && effectiveAuth.type === 'virtual') {
      effectiveAuth.uuid = generateOfflineUuid(effectiveAuth.username);
    }

    log('info', `Người chơi: ${effectiveAuth.username} (${effectiveAuth.type === 'virtual' ? 'Local Test Offline' : 'Microsoft'})`);
    log('info', `UUID: ${effectiveAuth.uuid}`);
    log('info', `Thư mục game: ${input.gameDir}`);
    log('info', `Phiên bản Minecraft: ${input.version}`);

    // ── Java detection ────────────────────────────────────────────────────
    log('info', 'Đang tìm Java runtime...');
    const settings = await getSettings();
    const scanDirs = [...settings.customJavaScanDirs];

    const javaSelection = await selectBestJavaRuntime(input.version, scanDirs, {
      gameDir: input.gameDir,
      preferredJavaPath: input.javaPath,
    });

    if (!javaSelection.found || !javaSelection.selectedRuntime) {
      log('error', javaSelection.message);
      onProgress?.({
        stage: 'failed',
        title: 'Java Runtime thiếu',
        message: javaSelection.message,
        percent: 100,
      });
      return { ok: false, status: 'failed', message: javaSelection.message };
    }

    if (javaSelection.warning) {
      log('warn', javaSelection.warning);
    }

    log('success', `Dùng Java ${javaSelection.selectedRuntime.majorVersion}: ${javaSelection.selectedRuntime.javaPath}`);

    // ── Version install check ─────────────────────────────────────────────
    // Version JSON có thể nằm ở gameDir (modpack) hoặc mcRoot (Forge/NeoForge/Fabric/Quilt)
    const mcRoot = settings.minecraftDirectory;
    const versionDirInGameDir = path.join(input.gameDir, 'versions', input.version);
    const versionJsonInGameDir = path.join(versionDirInGameDir, `${input.version}.json`);
    const versionDirInMcRoot = path.join(mcRoot, 'versions', input.version);
    const versionJsonInMcRoot = path.join(versionDirInMcRoot, `${input.version}.json`);

    const existsInGameDir = await pathExists(versionJsonInGameDir);
    const existsInMcRoot = await pathExists(versionJsonInMcRoot);
    const isInstalled = existsInGameDir || existsInMcRoot;
    // Dùng gameDir nếu version JSON ở đó, ngược lại dùng mcRoot
    const versionParseRoot = existsInGameDir ? input.gameDir : mcRoot;

    if (!isInstalled) {
      log('info', `Phiên bản ${input.version} chưa được cài. Sẽ tải vào .minecraft...`);
      onProgress?.({
        stage: 'checking_minecraft',
        title: 'Tải xuống phiên bản',
        message: `Đang tải ${input.version} vào .minecraft...`,
        percent: 10,
      });
    } else {
      log('info', 'Phiên bản đã cài. Đang kiểm tra thư viện...');
      onProgress?.({
        stage: 'checking_minecraft',
        title: 'Chuẩn bị khởi động',
        message: 'Đang kiểm tra thư viện game...',
        percent: 85,
      });
    }

    // XMCL: resolve version (auto inheritance, guarantees downloads.client)
    const resolved: ResolvedVersion = await Version.parse(versionParseRoot, input.version);

    // XMCL launch (auto inheritance, no downloads.client crash)
    log('info', 'Đang mở Minecraft...');
    onProgress?.({
      stage: 'launching',
      title: 'Khởi động Minecraft',
      message: 'Đang mở Minecraft...',
      percent: 100,
    });

    const child = await xmclLaunch({
      gamePath: input.gameDir,
      javaPath: javaSelection.selectedRuntime.javaPath,
      version: resolved,
      accessToken: effectiveAuth.accessToken,
      gameProfile: { name: effectiveAuth.username, id: effectiveAuth.uuid },
      minMemory: input.minMemoryMb,
      maxMemory: input.maxMemoryMb,
      server: input.serverAddress ? { ip: input.serverAddress } : undefined,
    });

    child.on('exit', (code) => {
      if (code !== 0) log('error', `Minecraft thoát với mã: ${code}`);
      else log('success', 'Minecraft kết thúc bình thường.');
      onExit?.(code ?? 0);
    });

    log('success', 'Minecraft đã khởi động thành công!');
    onProgress?.({
      stage: 'running',
      title: 'Minecraft đang chạy',
      message: 'Minecraft đã được khởi động.',
      percent: 100,
    });

    return { ok: true, status: 'running', message: 'Minecraft process started successfully.' };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error during launch';
    log('error', errMsg);
    return { ok: false, status: 'failed', message: errMsg };
  }
}
