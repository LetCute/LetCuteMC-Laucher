/**
 * IPC router barrel file - delegates to modularized domain IPCs
 * This file is kept for backward compatibility with main.ts import path.
 */
export { registerIpcHandlers, handleIpc, handleIpcSafe, createIpcThrottle } from './ipc/index'
export { setLauncherProgress, appendLauncherLog, setLaunchStatus } from './ipc/launchIpc'
