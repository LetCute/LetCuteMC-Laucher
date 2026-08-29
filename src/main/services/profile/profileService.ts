import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  LauncherProfile,
  ProfilesStore,
  CreateProfileInput,
  UpdateProfileInput,
} from '../../../shared/types';
import {
  getProfilesFilePath,
  getLauncherDataDirectory,
  getDefaultMinecraftDirectory,
  ensureLauncherDataDirectory,
  readJsonFile,
  writeJsonFile,
  ensureGameDirectoryStructure,
  pathExists,
} from '../system/storageService.js';
import { recommendPerformance } from '../system/performanceTunerService.js';

const DEFAULT_STORE: ProfilesStore = {
  activeProfileId: null,
  profiles: [],
};

function validateInput(input: Partial<CreateProfileInput>, isNew: boolean): string[] {
  const errors: string[] = [];
  if (isNew) {
    if (!input.name?.trim()) errors.push('Tên profile không được để trống');
    if (!input.minecraftVersion?.trim()) errors.push('Phiên bản Minecraft không được để trống');
  }
  if (input.minMemoryMb !== undefined && input.minMemoryMb < 512) {
    errors.push('RAM tối thiểu phải >= 512 MB');
  }
  if (
    input.maxMemoryMb !== undefined &&
    input.minMemoryMb !== undefined &&
    input.maxMemoryMb < input.minMemoryMb
  ) {
    errors.push('RAM tối đa phải >= RAM tối thiểu');
  }
  return errors;
}

/** Normalize legacy profile (strip loader tokens from name) */
function normalizeProfile(raw: any): LauncherProfile {
  const minecraftVersion = raw.minecraftVersion ?? raw.version ?? '1.21.1';
  const name = String(raw.name ?? 'Vanilla Profile').trim();

  return {
    id: raw.id ?? crypto.randomUUID(),
    name,
    minecraftVersion,
    gameDir: raw.gameDir ?? '',
    mcRootDir: raw.mcRootDir ?? null,
    minMemoryMb: Number(raw.minMemoryMb ?? 2048),
    maxMemoryMb: Number(raw.maxMemoryMb ?? 4096),
    javaPath: raw.javaPath ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Auto-discover profile directories under .minecraft/profiles/ and register any missing profiles.
 */
async function discoverDiskProfiles(existingProfiles: LauncherProfile[]): Promise<LauncherProfile[]> {
  const discovered: LauncherProfile[] = [];
  try {
    const defaultMcDir = getDefaultMinecraftDirectory();
    const profilesBaseDir = path.join(defaultMcDir, 'profiles');
    if (!(await pathExists(profilesBaseDir))) return discovered;

    const entries = await fs.readdir(profilesBaseDir, { withFileTypes: true });
    const rec = recommendPerformance();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderName = entry.name;
      const folderPath = path.join(profilesBaseDir, folderName);

      // Check if already registered by path or name
      const alreadyExists = existingProfiles.some(
        p => (p.gameDir && path.resolve(p.gameDir) === path.resolve(folderPath)) ||
             p.name.trim().toLowerCase() === folderName.trim().toLowerCase()
      );
      if (alreadyExists) continue;

      // Determine best minecraftVersion from versions/ subfolder
      let detectedVersion = '1.21.1';
      const versionsDir = path.join(folderPath, 'versions');
      if (await pathExists(versionsDir)) {
        try {
          const versionEntries = await fs.readdir(versionsDir, { withFileTypes: true });
          const versionFolders = versionEntries.filter(e => e.isDirectory()).map(e => e.name);
          if (versionFolders.length > 0) {
            // Prefer version with loader if present, or first found
            const loaderVer = versionFolders.find(v => v.includes('fabric') || v.includes('forge') || v.includes('neoforge') || v.includes('quilt'));
            detectedVersion = loaderVer || versionFolders[0];
          }
        } catch {
          // ignore
        }
      }

      const now = new Date().toISOString();
      const newProfile: LauncherProfile = {
        id: crypto.randomUUID(),
        name: folderName,
        minecraftVersion: detectedVersion,
        gameDir: folderPath,
        mcRootDir: defaultMcDir,
        minMemoryMb: rec.recommendedMinRam,
        maxMemoryMb: rec.recommendedMaxRam,
        javaPath: null,
        createdAt: now,
        updatedAt: now,
      };

      discovered.push(newProfile);
    }
  } catch (err) {
    console.warn('[profileService] Error scanning profiles directory on disk:', err);
  }

  return discovered;
}

export async function getProfiles(): Promise<ProfilesStore> {
  const filePath = getProfilesFilePath();
  const raw = await readJsonFile<any>(filePath, { ...DEFAULT_STORE });

  // Migrate legacy profiles
  const migratedProfiles: LauncherProfile[] = (raw.profiles ?? []).map(normalizeProfile);

  // Auto-discover profile folders in .minecraft/profiles/
  const discovered = await discoverDiskProfiles(migratedProfiles);
  if (discovered.length > 0) {
    migratedProfiles.push(...discovered);
  }

  let activeProfileId = raw.activeProfileId ?? null;
  if (!activeProfileId && migratedProfiles.length > 0) {
    activeProfileId = migratedProfiles[0].id;
  } else if (activeProfileId && !migratedProfiles.some(p => p.id === activeProfileId)) {
    activeProfileId = migratedProfiles.length > 0 ? migratedProfiles[0].id : null;
  }

  let store: ProfilesStore = {
    activeProfileId,
    profiles: migratedProfiles,
  };

  // Persist cleaned/synchronized store if changes happened
  if (JSON.stringify(raw) !== JSON.stringify(store)) {
    await writeJsonFile(filePath, store);
  }

  return store;
}

/** Create a new vanilla profile, persist it, and return it */
export async function createProfile(
  input: CreateProfileInput
): Promise<LauncherProfile> {
  const errors = validateInput(input, true);
  if (errors.length) throw new Error('Dữ liệu không hợp lệ: ' + errors.join('; '));

  await ensureLauncherDataDirectory();
  const store = await getProfiles();

  if (store.profiles.some(p => p.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
    throw new Error('Tên cấu hình đã tồn tại, vui lòng chọn tên khác');
  }

  const now = new Date().toISOString();
  const rec = recommendPerformance();

  const { getDefaultMinecraftDirectory, getLauncherDataDirectory } = await import('../system/storageService.js');

  let finalGameDir = input.gameDir || '';
  if (finalGameDir.trim() === '') {
    // Dùng chung thư mục gốc
    finalGameDir = getLauncherDataDirectory();
  }

  const profile: LauncherProfile = {
    id: crypto.randomUUID(),
    name: input.name,
    minecraftVersion: input.minecraftVersion,
    gameDir: finalGameDir,
    mcRootDir: input.mcRootDir ?? null,
    minMemoryMb: input.minMemoryMb ?? rec.recommendedMinRam,
    maxMemoryMb: input.maxMemoryMb ?? rec.recommendedMaxRam,
    javaPath: input.javaPath ?? null,
    createdAt: now,
    updatedAt: now,
  };

  // Ensure game directory structure is created and launcher_profiles.json is valid/created
  await ensureGameDirectoryStructure(profile.gameDir);

  store.profiles.push(profile);
  await writeJsonFile(getProfilesFilePath(), store);
  return profile;
}

/** Update an existing profile and persist */
export async function updateProfile(
  profileId: string,
  input: UpdateProfileInput
): Promise<LauncherProfile> {
  await ensureLauncherDataDirectory();
  const store = await getProfiles();
  const index = store.profiles.findIndex(p => p.id === profileId);
  if (index === -1) throw new Error('Profile không tìm thấy');

  const errors = validateInput(input, false);
  if (errors.length) throw new Error('Dữ liệu không hợp lệ: ' + errors.join('; '));

  if (input.name) {
    const isDuplicate = store.profiles.some(p => p.name.trim().toLowerCase() === input.name!.trim().toLowerCase() && p.id !== profileId);
    if (isDuplicate) throw new Error('Tên cấu hình đã tồn tại, vui lòng chọn tên khác');
  }

  const existing = store.profiles[index];
  let finalGameDir = input.gameDir !== undefined ? input.gameDir : existing.gameDir;
  if (!finalGameDir || finalGameDir.trim() === '') {
    finalGameDir = getLauncherDataDirectory();
  }

  const updated: LauncherProfile = {
    ...existing,
    ...input,
    gameDir: finalGameDir,
    updatedAt: new Date().toISOString(),
  };

  // Ensure game directory structure is created and launcher_profiles.json is valid/created
  if (updated.gameDir) {
    await ensureGameDirectoryStructure(updated.gameDir);
  }

  store.profiles[index] = updated;
  await writeJsonFile(getProfilesFilePath(), store);
  return updated;
}

/** Delete a profile and persist */
export async function deleteProfile(profileId: string): Promise<boolean> {
  await ensureLauncherDataDirectory();
  const store = await getProfiles();
  const index = store.profiles.findIndex(p => p.id === profileId);
  if (index === -1) return false;

  const profile = store.profiles[index];
  const { getLauncherDataDirectory } = await import('../system/storageService.js');
  const rootDir = getLauncherDataDirectory();

  if (profile.gameDir && profile.gameDir.toLowerCase() !== rootDir.toLowerCase()) {
    const isProfilesDir = profile.gameDir.toLowerCase().includes(`${path.sep}profiles${path.sep}`) || profile.gameDir.toLowerCase().includes('/profiles/');
    if (isProfilesDir) {
      const fs = await import('node:fs/promises');
      await fs.rm(profile.gameDir, { recursive: true, force: true }).catch((err) => {
        console.error('Lỗi khi xóa thư mục cấu hình:', err);
      });
    }
  }

  store.profiles.splice(index, 1);
  if (store.activeProfileId === profileId) store.activeProfileId = null;
  await writeJsonFile(getProfilesFilePath(), store);
  return true;
}

export async function setActiveProfile(profileId: string): Promise<boolean> {
  await ensureLauncherDataDirectory();
  const store = await getProfiles();
  if (!store.profiles.some(p => p.id === profileId)) return false;
  store.activeProfileId = profileId;
  await writeJsonFile(getProfilesFilePath(), store);
  return true;
}

