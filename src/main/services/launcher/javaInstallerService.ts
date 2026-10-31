import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import { URL } from 'url';
import { getLauncherDataDirectory } from '../system/storageService';
import { isWindows, JAVA_EXE, getPlatformOS, getPlatformArchiveExtension } from '../../utils/platform.js';

const execFileAsync = promisify(execFile);

interface JavaInstallProgress {
  stage: 'downloading' | 'extracting' | 'configuring' | 'completed';
  percent: number;
  message: string;
}

const activeInstalls = new Map<number, Promise<{ success: boolean; javaPath: string; message: string }>>();

function getJavaDownloadInfo(version: number) {
  const osPart = getPlatformOS();
  const ext = getPlatformArchiveExtension();
  
  const urls: Record<number, Record<string, string>> = {
    25: {
      windows: 'https://api.adoptium.net/v3/binary/latest/25/ga/windows/x64/jdk/hotspot/normal/eclipse',
      mac: 'https://api.adoptium.net/v3/binary/latest/25/ga/mac/x64/jdk/hotspot/normal/eclipse',
      linux: 'https://api.adoptium.net/v3/binary/latest/25/ga/linux/x64/jdk/hotspot/normal/eclipse'
    },
    21: {
      windows: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_windows_hotspot_21.0.1_12.zip',
      mac: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_mac_hotspot_21.0.1_12.tar.gz',
      linux: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_linux_hotspot_21.0.1_12.tar.gz'
    },
    17: {
      windows: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.8%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.8_7.zip',
      mac: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.8%2B7/OpenJDK17U-jdk_x64_mac_hotspot_17.0.8_7.tar.gz',
      linux: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.8%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.8_7.tar.gz'
    },
    16: {
      windows: 'https://github.com/adoptium/temurin16-binaries/releases/download/jdk-16.0.2%2B7/OpenJDK16U-jdk_x64_windows_hotspot_16.0.2_7.zip',
      mac: 'https://github.com/adoptium/temurin16-binaries/releases/download/jdk-16.0.2%2B7/OpenJDK16U-jdk_x64_mac_hotspot_16.0.2_7.tar.gz',
      linux: 'https://github.com/adoptium/temurin16-binaries/releases/download/jdk-16.0.2%2B7/OpenJDK16U-jdk_x64_linux_hotspot_16.0.2_7.tar.gz'
    },
    11: {
      windows: 'https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.21%2B9/OpenJDK11U-jdk_x64_windows_hotspot_11.0.21_9.zip',
      mac: 'https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.21%2B9/OpenJDK11U-jdk_x64_mac_hotspot_11.0.21_9.tar.gz',
      linux: 'https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.21%2B9/OpenJDK11U-jdk_x64_linux_hotspot_11.0.21_9.tar.gz'
    },
    8: {
      windows: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u382-b05/OpenJDK8U-jdk_x64_windows_hotspot_8u382b05.zip',
      mac: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u382-b05/OpenJDK8U-jdk_x64_mac_hotspot_8u382b05.tar.gz',
      linux: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u382-b05/OpenJDK8U-jdk_x64_linux_hotspot_8u382b05.tar.gz'
    }
  };
  
  const url = urls[version]?.[osPart] || `https://api.adoptium.net/v3/binary/latest/${version}/ga/${osPart}/x64/jdk/hotspot/normal/eclipse`;
  return { url, filename: `java-${version}.${ext}` };
}

function downloadFile(url: string, destination: string, maxRedirects = 10): Promise<void> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Quá nhiều chuyển hướng khi tải file'));
      return;
    }

    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') { reject(new Error('Chỉ chấp nhận tải xuống Java qua kết nối HTTPS bảo mật.')); return; }

    const request = https.get(url, {
      timeout: 45000,
      headers: {
        'User-Agent': 'LetCuteMC-Launcher',
        'Accept': '*/*'
      }
    }, (response) => {
      const statusCode = response.statusCode || 0;

      // Handle 301, 302, 303, 307, 308 redirects
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        const redirectLocation = response.headers.location;
        if (redirectLocation) {
          const resolvedUrl = new URL(redirectLocation, url).toString(); if (!resolvedUrl.startsWith('https://')) { response.resume(); reject(new Error('Từ chối chuyển hướng không an toàn (bắt buộc HTTPS).')); return; }
          response.resume(); // drain response stream
          downloadFile(resolvedUrl, destination, maxRedirects - 1).then(resolve).catch(reject);
          return;
        }
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${statusCode} khi tải file từ ${url}`));
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);

      file.on('finish', () => {
        file.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      file.on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Hết thời gian tải (Timeout)'));
    });

    request.on('error', (err) => {
      fs.unlink(destination, () => {});
      reject(err);
    });
  });
}

async function calculateFileSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex').toLowerCase();
}

async function fetchExpectedSha256(url: string): Promise<string | null> {
  try {
    const checksumUrl = `${url}.sha256.txt`;
    const res = await fetch(checksumUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.trim().match(/^([a-fA-F0-9]{64})/);
    const hash = match?.[1];
    return hash ? hash.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Extract zip or tar file
 */
async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  try {
    if (archivePath.endsWith('.tar.gz')) {
      await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir], {
        timeout: 60000
      });
    } else {
      // Try Windows tar first (Windows 10+)
      await execFileAsync('tar', ['-xf', archivePath, '-C', destDir], {
        timeout: 60000
      });
    }
  } catch {
    // Fallback: try 7z if available
    try {
      await execFileAsync('7z', ['x', archivePath, `-o${destDir}`, '-y'], {
        timeout: 60000
      });
    } catch {
      throw new Error('Không thể giải nén. Vui lòng cài 7-Zip hoặc sử dụng hệ điều hành có sẵn tar (Windows 10+, Linux, macOS)');
    }
  }
}

/**
 * Auto-install Java to local directory
 */
export async function autoInstallJava(
  javaVersion: number,
  installDir: string,
  onProgress?: (progress: JavaInstallProgress) => void
): Promise<{ success: boolean; javaPath: string; message: string }> {
  if (activeInstalls.has(javaVersion)) {
    return activeInstalls.get(javaVersion)!;
  }

  const installPromise = (async () => {
    const versionInfo = getJavaDownloadInfo(javaVersion);
    
    if (!versionInfo) {
      return {
        success: false,
        javaPath: '',
        message: `Java ${javaVersion} không được hỗ trợ tự động cài đặt. Hỗ trợ: 8, 11, 16, 17, 21, 25`
      };
    }

    try {
      // Create install directory
      await fsPromises.mkdir(installDir, { recursive: true });

      const tempArchivePath = path.join(installDir, versionInfo.filename);
      const extractDir = path.join(installDir, `java-${javaVersion}`);

      // Download
      onProgress?.({
        stage: 'downloading',
        percent: 10,
        message: `Đang tải Java ${javaVersion} (~ 150MB)...`
      });

      await downloadFile(versionInfo.url, tempArchivePath);

      onProgress?.({
        stage: 'downloading',
        percent: 45,
        message: 'Đang kiểm tra tính toàn vẹn (SHA-256)...',
      });
      const expectedSha256 = await fetchExpectedSha256(versionInfo.url);
      if (expectedSha256) {
        const actualSha256 = await calculateFileSha256(tempArchivePath);
        if (actualSha256 !== expectedSha256) {
          await fsPromises.unlink(tempArchivePath).catch(() => {});
          throw new Error('Xác thực tính toàn vẹn Java thất bại: mã băm SHA-256 không khớp.');
        }
      }

      const archiveStats = await fsPromises.stat(tempArchivePath);
      if (!archiveStats.isFile() || archiveStats.size < 5 * 1024 * 1024) {
        throw new Error('Gói cài đặt Java tải về không hợp lệ hoặc kích thước quá nhỏ (< 5MB).');
      }

      onProgress?.({
        stage: 'downloading',
        percent: 50,
        message: `Tải xong. Đang giải nén...`
      });

      // Extract
      onProgress?.({
        stage: 'extracting',
        percent: 60,
        message: `Đang giải nén Java...`
      });

      await fsPromises.mkdir(extractDir, { recursive: true });
      await extractArchive(tempArchivePath, extractDir);

      onProgress?.({
        stage: 'extracting',
        percent: 80,
        message: `Hoàn tất giải nén. Tìm kiếm ${JAVA_EXE}...`
      });

      // Find java executable in extracted folder
      const searchJava = async (dir: string, depth = 0): Promise<string> => {
        if (depth > 5) return '';
        try {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name === JAVA_EXE) {
              return path.join(dir, entry.name);
            }
            if (entry.isDirectory()) {
              const found = await searchJava(path.join(dir, entry.name), depth + 1);
              if (found) return found;
            }
          }
        } catch {
          // ignore
        }
        return '';
      };

      const javaPath = await searchJava(extractDir);

      // Cleanup temp archive
      try {
        await fsPromises.unlink(tempArchivePath);
      } catch {
        // ignore cleanup errors
      }

      if (!javaPath) {
        return {
          success: false,
          javaPath: '',
          message: `Cài đặt Java thành công nhưng không tìm thấy ${JAVA_EXE}`
        };
      }

      // Set execute permission on Mac/Linux
      if (!isWindows) {
        try {
          await fsPromises.chmod(javaPath, 0o755);
        } catch (e) {
          console.warn('Could not chmod java executable', e);
        }
      }

      onProgress?.({
        stage: 'configuring',
        percent: 95,
        message: `Java ${javaVersion} được cài đặt tại: ${javaPath}`
      });

      onProgress?.({
        stage: 'completed',
        percent: 100,
        message: `Cài đặt Java ${javaVersion} thành công!`
      });

      return {
        success: true,
        javaPath,
        message: `Java ${javaVersion} đã được cài đặt tại: ${javaPath}`
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Lỗi không xác định';
      return {
        success: false,
        javaPath: '',
        message: `Lỗi cài đặt Java: ${errMsg}`
      };
    }
  })();

  activeInstalls.set(javaVersion, installPromise);
  try {
    return await installPromise;
  } finally {
    activeInstalls.delete(javaVersion);
  }
}

/**
 * Get default installation directory
 */
export function getDefaultJavaInstallDir(): string {
  return path.join(getLauncherDataDirectory(), 'java');
}
