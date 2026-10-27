import { BrowserWindow } from 'electron'
import type { BackgroundTask } from '../../../shared/types.js'

export class TaskManagerService {
  private tasks: Map<string, BackgroundTask> = new Map()
  private cancelCallbacks: Map<string, () => Promise<void> | void> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()

  private emitTasks() {
    const tasksArray = Array.from(this.tasks.values()).sort((a, b) => {
      // Sort: newest first
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    
    // Send to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('tasks:on-update', { type: 'tasks-updated', tasks: tasksArray })
    }
  }

  public getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }

  public createTask(name: string, taskType?: 'install-modpack' | 'install-mod'): string {
    const id = Math.random().toString(36).substring(2, 15)
    const now = new Date().toISOString()
    const controller = new AbortController()
    this.abortControllers.set(id, controller)
    this.tasks.set(id, {
      id,
      name,
      status: 'running',
      percent: 0,
      message: 'Khởi tạo tác vụ...',
      createdAt: now,
      updatedAt: now,
      taskType
    })
    this.emitTasks()
    return id
  }

  public registerCancelCallback(id: string, callback: () => Promise<void> | void) {
    this.cancelCallbacks.set(id, callback)
  }

  public getAbortSignal(id: string): AbortSignal | undefined {
    return this.abortControllers.get(id)?.signal
  }

  public isCancelled(id: string): boolean {
    const task = this.tasks.get(id)
    return !task || task.status === 'cancelled' || !!this.abortControllers.get(id)?.signal.aborted
  }

  public async cancelTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id)
    if (!task || task.status !== 'running') return false

    // Trigger AbortController
    const controller = this.abortControllers.get(id)
    if (controller) {
      controller.abort()
    }

    // Trigger rollback callback if registered
    const cb = this.cancelCallbacks.get(id)
    if (cb) {
      try {
        await cb()
      } catch (err) {
        console.error(`[taskManagerService] Error running cancel callback for task ${id}:`, err)
      }
      this.cancelCallbacks.delete(id)
    }

    task.status = 'cancelled'
    task.message = 'Đã hủy tác vụ (Đã hoàn tác các thay đổi)'
    task.updatedAt = new Date().toISOString()
    this.emitTasks()
    return true
  }

  public updateTaskProgress(id: string, percent: number, message: string) {
    const task = this.tasks.get(id)
    if (!task || task.status !== 'running') return
    task.percent = Math.min(100, Math.max(0, percent))
    task.message = message
    task.updatedAt = new Date().toISOString()
    this.emitTasks()
  }

  public completeTask(id: string, message: string = 'Hoàn tất', result?: any) {
    const task = this.tasks.get(id)
    if (!task || task.status !== 'running') return
    task.status = 'success'
    task.percent = 100
    task.message = message
    task.updatedAt = new Date().toISOString()
    if (result) task.result = result
    this.cancelCallbacks.delete(id)
    this.abortControllers.delete(id)
    this.emitTasks()
    
    // Notify specifically about completion
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('tasks:on-update', { type: 'task-completed', task })
    }
  }

  public failTask(id: string, errorMessage: string) {
    const task = this.tasks.get(id)
    if (!task || task.status !== 'running') return
    task.status = 'error'
    task.message = errorMessage
    task.updatedAt = new Date().toISOString()
    this.cancelCallbacks.delete(id)
    this.abortControllers.delete(id)
    this.emitTasks()
  }
  
  public clearCompletedTasks() {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'success' || task.status === 'cancelled' || task.status === 'error') {
        this.tasks.delete(id)
        this.cancelCallbacks.delete(id)
        this.abortControllers.delete(id)
      }
    }
    this.emitTasks()
  }
}

export const taskManagerService = new TaskManagerService()

