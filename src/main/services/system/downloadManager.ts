import path from 'node:path'
import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { LauncherLogLevel } from '../../../shared/types'
import { getUrlCandidates } from './mirrorService'
import { initGlobalHttpDispatcher } from './httpAgent'

export interface DownloadTask {
  id: string
  url: string
  destinationPath: string
  sha1?: string
  size?: number
  label: string
}

export interface DownloadProgress {
  taskId: string
  label: string
  current: number
  total: number
  percent: number
}

// ponytail: stream-based hash — avoids loading entire file into RAM
async function streamSha1(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha1')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

async function fileHashMatches(filePath: string, expectedSha1: string | undefined): Promise<boolean> {
  if (!expectedSha1) return true
  try {
    const hash = await streamSha1(filePath)
    return hash.toLowerCase() === expectedSha1.toLowerCase()
  } catch {
    return false
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function downloadTasks(
  tasks: DownloadTask[],
  options: {
    concurrency: number
    signal?: AbortSignal
    onProgress?: (progress: DownloadProgress) => void
    onLog?: (level: LauncherLogLevel, message: string) => void
  }
): Promise<void> {
  initGlobalHttpDispatcher()

  const limit = Math.max(1, Math.min(options.concurrency, 16))
  const activeTasks = new Set<Promise<void>>()
  const queue = [...tasks]
  
  let completed = 0
  const totalTasks = tasks.length

  options.onLog?.('info', `Bắt đầu tải ${totalTasks} tệp tin bằng ${limit} kết nối song song...`)

  const executeTask = async (task: DownloadTask) => {
    if (options.signal?.aborted) {
      throw new Error('Download aborted')
    }

    const destDir = path.dirname(task.destinationPath)
    await fs.mkdir(destDir, { recursive: true })

    // If file already exists and hash matches, skip
    if (await pathExists(task.destinationPath)) {
      const ok = await fileHashMatches(task.destinationPath, task.sha1)
      if (ok) {
        completed++
        options.onProgress?.({
          taskId: task.id,
          label: task.label,
          current: completed,
          total: totalTasks,
          percent: Math.round((completed / totalTasks) * 100),
        })
        return
      }
    }

    const tmpPath = `${task.destinationPath}.tmp`
    const urlCandidates = getUrlCandidates(task.url)
    let success = false
    let lastError: any = null

    // Try candidates (Official primary -> High speed mirror fallback)
    for (let candidateIdx = 0; candidateIdx < urlCandidates.length && !success; candidateIdx++) {
      if (options.signal?.aborted) {
        throw new Error('Download aborted')
      }

      const currentUrl = urlCandidates[candidateIdx]
      if (!currentUrl) continue
      let retries = 2

      while (retries >= 0 && !success) {
        if (options.signal?.aborted) {
          throw new Error('Download aborted')
        }

        try {
          const controller = new AbortController()
          const abortListener = () => controller.abort()
          options.signal?.addEventListener('abort', abortListener, { once: true })
          const timeoutId = setTimeout(() => controller.abort(), 20000)
          
          let response: Response
          try {
            response = await fetch(currentUrl, { signal: controller.signal })
          } finally {
            clearTimeout(timeoutId)
            options.signal?.removeEventListener('abort', abortListener)
          }

          if (!response.ok) throw new Error(`HTTP status ${response.status}`)
          
          // ponytail: stream to disk — avoids buffering entire file in RAM
          if (!response.body) throw new Error('Response body is null')
          await pipeline(
            Readable.fromWeb(response.body as any),
            createWriteStream(tmpPath)
          )

          // Validate hash if expected
          if (task.sha1) {
            const matches = await fileHashMatches(tmpPath, task.sha1)
            if (!matches) {
              throw new Error(`Hash mismatch for downloaded file ${task.label}`)
            }
          }

          // Rename tmp to actual
          if (await pathExists(task.destinationPath)) {
            await fs.unlink(task.destinationPath)
          }
          await fs.rename(tmpPath, task.destinationPath)
          success = true
        } catch (err) {
          if (options.signal?.aborted) {
            if (await pathExists(tmpPath)) {
              await fs.unlink(tmpPath).catch(() => {})
            }
            throw new Error('Download aborted')
          }
          lastError = err
          retries--
          if (await pathExists(tmpPath)) {
            await fs.unlink(tmpPath).catch(() => {})
          }
        }
      }
    }

    if (!success) {
      options.onLog?.('error', `Tải thất bại tệp ${task.label}: ${lastError?.message || 'Lỗi không rõ'}`)
      throw lastError || new Error(`Failed to download ${task.label}`)
    }

    completed++
    options.onProgress?.({
      taskId: task.id,
      label: task.label,
      current: completed,
      total: totalTasks,
      percent: Math.round((completed / totalTasks) * 100),
    })
  }

  while (queue.length > 0 || activeTasks.size > 0) {
    if (options.signal?.aborted) {
      throw new Error('Download aborted')
    }

    while (activeTasks.size < limit && queue.length > 0) {
      const nextTask = queue.shift()!
      const p = executeTask(nextTask).then(() => {
        activeTasks.delete(p)
      }).catch((err) => {
        activeTasks.delete(p)
        throw err
      })
      activeTasks.add(p)
    }
    if (activeTasks.size > 0) await Promise.race(activeTasks)
  }

  options.onLog?.('success', `Đã tải hoàn tất ${totalTasks} tệp tin.`)
}

