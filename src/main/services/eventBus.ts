import { EventEmitter } from 'node:events'
import type { LauncherProfile } from '../../shared/types'

export interface GameLaunchPayload {
  jobId: string
  profileId: string
  profileName: string
  versionId: string
  gameDir?: string
}

export interface GameStartedPayload extends GameLaunchPayload {
  pid?: number
}

export interface GameExitedPayload extends GameLaunchPayload {
  code: number | null
  durationMs?: number
}

export interface GameCrashedPayload extends GameLaunchPayload {
  error: string
  exitCode?: number | null
}

export interface AppEventMap {
  'game:launching': (payload: GameLaunchPayload) => void
  'game:started': (payload: GameStartedPayload) => void
  'game:exited': (payload: GameExitedPayload) => void
  'game:crashed': (payload: GameCrashedPayload) => void
  'profile:updated': (profile: LauncherProfile) => void
  'profile:deleted': (profileId: string) => void
}

/**
 * Typed Event Bus for decoupling domain services.
 * ponytail: Node EventEmitter, replace with distributed bus if multi-process.
 */
class AppEventBus extends EventEmitter {
  override emit<E extends keyof AppEventMap>(event: E, ...args: Parameters<AppEventMap[E]>): boolean {
    return super.emit(event, ...args)
  }

  override on<E extends keyof AppEventMap>(event: E, listener: AppEventMap[E]): this {
    return super.on(event, listener as (...args: any[]) => void)
  }

  override once<E extends keyof AppEventMap>(event: E, listener: AppEventMap[E]): this {
    return super.once(event, listener as (...args: any[]) => void)
  }

  override off<E extends keyof AppEventMap>(event: E, listener: AppEventMap[E]): this {
    return super.off(event, listener as (...args: any[]) => void)
  }
}

export const eventBus = new AppEventBus()
