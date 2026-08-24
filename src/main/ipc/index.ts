import { registerAccountIpc } from './accountIpc'
import { registerProfileIpc } from './profileIpc'
import { registerLaunchIpc } from './launchIpc'
import { registerContentIpc } from './contentIpc'
import { registerModrinthIpc } from './modrinthIpc'
import { registerSystemIpc } from './systemIpc'
import { registerStatsIpc } from './statsIpc'

export function registerIpcHandlers(): void {
  registerAccountIpc()
  registerProfileIpc()
  registerLaunchIpc()
  registerContentIpc()
  registerModrinthIpc()
  registerSystemIpc()
  registerStatsIpc()
}

export { handleIpc, handleIpcSafe, createIpcThrottle } from './ipcHelper'
export * from './launchIpc'
