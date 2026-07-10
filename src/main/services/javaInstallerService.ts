import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';

const execFileAsync = promisify(execFile);

interface JavaInstallProgress {
  stage: 'downloading' | 'extracting' | 'configuring' | 'completed';
  percent: number;
  message: string;
}

// Temurin (Eclipse Adoptium) is the most reliable free JDK
const JAVA_VERSIONS: Record<number, { url: string; filename: string }> = {
  17: {
    url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.8%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.8_7.zip',
    filename: 'java-17.zip'
  },
  21: {
    url: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_windows_hotspot_21.0.1_12.zip',
    filename: 'java-21.zip'
  },
  8: {
    url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u382-b05/OpenJDK8U-jdk_x64_windows_hotspot_8u382b05.zip',
    filename: 'java-8.zip'
  }
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https.get(url, { timeout: 30000 }, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          downloadFile(redirectUrl, destination).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

/**
 * Extract zip file (requires 7-Zip or built-in Windows tar)
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  try {
    // Try Windows tar first (Windows 10+)
    await execFileAsync('tar', ['-xf', zipPath, '-C', destDir], {
      timeout: 60000
    });
  } catch {
    // Fallback: try 7z if available
    try {
      await execFileAsync('7z', ['x', zipPath, `-o${destDir}`, '-y'], {
        timeout: 60000
      });
    } catch {
      throw new Error('Không thể giải nén. Vui lòng cài 7-Zip hoặc sử dụng Windows 10+');
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
  const versionInfo = JAVA_VERSIONS[javaVersion];
  
  if (!versionInfo) {
    return {
      success: false,
      javaPath: '',
      message: `Java ${javaVersion} không được hỗ trợ tự động cài đặt. Hỗ trợ: 8, 17, 21`
    };
  }

  try {
    // Create install directory
    await fsPromises.mkdir(installDir, { recursive: true });

    const tempZipPath = path.join(installDir, versionInfo.filename);
    const extractDir = path.join(installDir, `java-${javaVersion}`);

    // Download
    onProgress?.({
      stage: 'downloading',
      percent: 10,
      message: `Đang tải Java ${javaVersion} (~ 150MB)...`
    });

    await downloadFile(versionInfo.url, tempZipPath);

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
    await extractZip(tempZipPath, extractDir);

    onProgress?.({
      stage: 'extracting',
      percent: 80,
      message: `Hoàn tất giải nén. Tìm kiếm java.exe...`
    });

    // Find java.exe in extracted folder
    const possiblePaths = [
      path.join(extractDir, 'jdk-17.0.8+7', 'bin', 'java.exe'),
      path.join(extractDir, 'jdk-17.0.8+7', 'bin', 'java.exe'),
      path.join(extractDir, 'jdk-21.0.1+12', 'bin', 'java.exe'),
      path.join(extractDir, 'jdk8u382-b05', 'bin', 'java.exe'),
    ];

    let javaPath = '';
    for (const p of possiblePaths) {
      if (await pathExists(p)) {
        javaPath = p;
        break;
      }
    }

    // If not found, search recursively
    if (!javaPath) {
      const searchJava = async (dir: string, depth = 0): Promise<string> => {
        if (depth > 3) return '';
        try {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name === 'java.exe') {
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

      javaPath = await searchJava(extractDir);
    }

    // Cleanup temp zip
    try {
      await fsPromises.unlink(tempZipPath);
    } catch {
      // ignore cleanup errors
    }

    if (!javaPath) {
      return {
        success: false,
        javaPath: '',
        message: 'Cài đặt Java thành công nhưng không tìm thấy java.exe'
      };
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
}

/**
 * Get default installation directory
 */
export function getDefaultJavaInstallDir(): string {
  const appDataDir = process.env.APPDATA || process.env.HOME || '';
  return path.join(appDataDir, 'LetCuteMC', 'java');
}
