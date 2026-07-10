import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ProcessPriority = 'normal' | 'above_normal' | 'high'

export interface PriorityResult {
  ok: boolean
  message: string
}

function mapPriority(priority: ProcessPriority): string {
  if (priority === 'high') return 'High'
  if (priority === 'above_normal') return 'AboveNormal'
  return 'Normal'
}

function assertValidPid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid process pid: ${pid}`)
  }
}

export async function setProcessPriority(
  pid: number,
  priority: ProcessPriority
): Promise<PriorityResult> {
  try {
    assertValidPid(pid)

    if (process.platform !== 'win32') {
      return {
        ok: false,
        message: 'Process priority boost is only supported on Windows.'
      }
    }

    const priorityClass = mapPriority(priority)

    const script = [
      '$ErrorActionPreference = "Stop";',
      `$process = Get-Process -Id ${pid};`,
      `$process.PriorityClass = "${priorityClass}";`
    ].join(' ')

    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ],
      {
        timeout: 5000,
        windowsHide: true
      }
    )

    return {
      ok: true,
      message: `Set process ${pid} priority to ${priorityClass}.`
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : 'Failed to set process priority.'
    }
  }
}

export async function restoreProcessPriority(pid: number): Promise<PriorityResult> {
  return setProcessPriority(pid, 'normal')
}

export async function applyTemporaryLaunchBoost(input: {
  pid: number
  priority: Exclude<ProcessPriority, 'normal'>
  durationMs: number
  onLog?: (level: 'info' | 'success' | 'warn' | 'error', message: string) => void
}): Promise<void> {
  const durationMs = Math.max(5000, Math.min(input.durationMs, 120000))

  const boostResult = await setProcessPriority(input.pid, input.priority)

  if (!boostResult.ok) {
    input.onLog?.('warn', `Launch Boost failed: ${boostResult.message}`)
    return
  }

  input.onLog?.(
    'success',
    `Launch Boost enabled: Minecraft process ${input.pid} set to ${input.priority}.`
  )

  setTimeout(() => {
    void restoreProcessPriority(input.pid).then((restoreResult) => {
      if (restoreResult.ok) {
        input.onLog?.(
          'info',
          `Launch Boost finished: Minecraft process ${input.pid} restored to normal.`
        )
        return
      }

      input.onLog?.(
        'warn',
        `Could not restore Minecraft priority: ${restoreResult.message}`
      )
    })
  }, durationMs)
}
