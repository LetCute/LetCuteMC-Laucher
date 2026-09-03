import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

/**
 * Resolves the absolute path to a worker file located in the dist-electron workers directory.
 * Works seamlessly across development, ASAR packaging, and obfuscation.
 */
export function getWorkerFilePath(workerName: string): string {
  if (app && app.isPackaged) {
    return path.join(app.getAppPath(), 'dist-electron', 'main', 'workers', workerName)
  }

  // Development / unpacked runtime candidates
  const candidate1 = path.join(__dirname, '..', 'workers', workerName)
  if (fs.existsSync(candidate1)) {
    return candidate1
  }

  const candidate2 = path.join(__dirname, '..', '..', 'workers', workerName)
  if (fs.existsSync(candidate2)) {
    return candidate2
  }

  return candidate1
}
