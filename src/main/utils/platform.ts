import os from 'node:os'
import path from 'node:path'

export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'
export const isMac = process.platform === 'darwin'

export const JAVA_EXE = isWindows ? 'java.exe' : 'java'

export function getPlatformOS(): 'windows' | 'mac' | 'linux' {
  if (isWindows) return 'windows'
  if (isMac) return 'mac'
  return 'linux'
}

export function getPlatformArchiveExtension(): 'zip' | 'tar.gz' {
  return isWindows ? 'zip' : 'tar.gz'
}

/**
 * Đường dẫn mặc định của .minecraft theo hệ điều hành (Windows, Linux, macOS)
 */
export function getDefaultMinecraftDirectory(): string {
  if (isWindows) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron')
      return path.join(app.getPath('appData'), '.minecraft')
    } catch {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft')
    }
  }
  if (isMac) {
    return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft')
  }
  return path.join(os.homedir(), '.minecraft')
}

/**
 * Thư mục dữ liệu cấu hình launcher: ~/.letcutemc hoặc %APPDATA%/.letcutemc
 */
export function getDefaultLauncherDataDirectory(): string {
  const base = isWindows
    ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : os.homedir()
  return path.join(base, '.letcutemc')
}

/**
 * Biến môi trường GPU theo nền tảng:
 * - Windows: SHIM_MCCOMPAT (NVIDIA Optimus)
 * - Linux: DRI_PRIME (Mesa/AMD/Intel PRIME) và __NV_PRIME_RENDER_OFFLOAD (NVIDIA Proprietary)
 */
export function getDedicatedGpuEnvironment(enable = true): Record<string, string> {
  if (!enable) return {}

  if (isWindows) {
    return {
      SHIM_MCCOMPAT: '1',
    }
  }

  if (isLinux) {
    return {
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only',
      DRI_PRIME: '1',
    }
  }

  return {}
}

/**
 * Các thư mục quét Java tiêu chuẩn phân chia rõ ràng theo từng hệ điều hành
 */
export function getPlatformJavaCandidateRoots(): string[] {
  const roots: string[] = []

  if (isLinux) {
    roots.push(
      '/usr/lib/jvm',
      '/usr/lib64/jvm',
      '/usr/java',
      '/opt/java',
      '/opt/jdk',
      path.join(os.homedir(), '.sdkman/candidates/java'),
      path.join(os.homedir(), '.jenv/versions'),
      path.join(os.homedir(), '.asdf/installs/java'),
      path.join(os.homedir(), '.local/share/jvm')
    )
  } else if (isMac) {
    roots.push(
      '/Library/Java/JavaVirtualMachines',
      path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'),
      path.join(os.homedir(), '.sdkman/candidates/java')
    )
  } else if (isWindows) {
    const pf = process.env.ProgramFiles || 'C:\\Program Files'
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')

    roots.push(
      path.join(pf, 'Java'),
      path.join(pf, 'Eclipse Adoptium'),
      path.join(pf, 'Semeru'),
      path.join(pf, 'Zulu'),
      path.join(pf, 'BellSoft'),
      path.join(pf, 'Microsoft'),
      path.join(pf, 'Amazon Corretto'),
      path.join(pf86, 'Java'),
      path.join(localAppData, 'Programs', 'Eclipse Adoptium')
    )
  }

  return roots
}

/**
 * Kiểm tra tên tệp thực thi Java hợp lệ (chống RCE / binary injection)
 */
export function isValidJavaExecutableName(filePath: string): boolean {
  const base = path.basename(filePath.trim()).toLowerCase()
  return isWindows ? base === 'java.exe' || base === 'javaw.exe' : base === 'java'
}
