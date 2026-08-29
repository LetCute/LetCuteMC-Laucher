import { selectBestJavaRuntime, resolveRequiredJavaMajor } from './javaScannerService'
import { autoInstallJava, getDefaultJavaInstallDir } from './javaInstallerService'
import type { JavaRuntimeSelectionResult } from '../../../shared/types'

export interface EnsureJavaOptions {
  mcVersion: string
  customJavaPath?: string | null
  installDir?: string
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void
}

export interface EnsureJavaResult {
  javaPath: string
  majorVersion: number
  selection: JavaRuntimeSelectionResult
}

/**
 * Resolves or auto-installs appropriate Java runtime for given MC version.
 */
export async function ensureJavaRuntime(options: EnsureJavaOptions): Promise<EnsureJavaResult> {
  const { mcVersion, customJavaPath, installDir = getDefaultJavaInstallDir(), log } = options

  const scanDirs = customJavaPath ? [customJavaPath] : []
  let selection = await selectBestJavaRuntime(mcVersion, scanDirs, {
    preferredJavaPath: customJavaPath,
  })

  if (!selection.selectedRuntime) {
    const requiredMajor = selection.requiredMajor ?? (await resolveRequiredJavaMajor(mcVersion))
    log?.('warn', `Thiếu Java ${requiredMajor}. Đang tự động tải và cài đặt...`)

    const installResult = await autoInstallJava(requiredMajor, installDir)
    if (!installResult.success || !installResult.javaPath) {
      throw new Error(installResult.message || `Tự động cài đặt Java ${requiredMajor} thất bại.`)
    }

    log?.('info', `Cài đặt Java ${requiredMajor} thành công tại: ${installResult.javaPath}`)
    selection = await selectBestJavaRuntime(mcVersion, [installResult.javaPath], {
      preferredJavaPath: installResult.javaPath,
      forceRefresh: true,
    })
  }

  const runtime = selection.selectedRuntime
  const javaPath = runtime?.javaPath
  if (!runtime || !javaPath) {
    throw new Error(selection.message || 'Không tìm thấy môi trường Java phù hợp để chạy Minecraft.')
  }

  return {
    javaPath,
    majorVersion: runtime.majorVersion,
    selection,
  }
}
