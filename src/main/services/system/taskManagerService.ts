import { BrowserWindow } from 'electron'
import type { BackgroundTask, BackgroundTaskStatus } from '../../../shared/types.js'

export class TaskManagerService {
  private tasks: Map<string, BackgroundTask> = new Map()

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

  public updateTaskProgress(id: string, percent: number, message: string) {
    const task = this.tasks.get(id)
    if (!task) return
    task.percent = Math.min(100, Math.max(0, percent))
    task.message = message
    task.updatedAt = new Date().toISOString()
    this.emitTasks()
  }

  public completeTask(id: string, message: string = 'Hoàn tất', result?: any) {
    const task = this.tasks.get(id)
    if (!task) return
    task.status = 'success'
    task.percent = 100
    task.message = message
    task.updatedAt = new Date().toISOString()
    if (result) task.result = result
    this.emitTasks()
    
    // Notify specifically about completion
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('tasks:on-update', { type: 'task-completed', task })
    }
  }

  public failTask(id: string, errorMessage: string) {
    const task = this.tasks.get(id)
    if (!task) return
    task.status = 'error'
    task.message = errorMessage
    task.updatedAt = new Date().toISOString()
    this.emitTasks()
  }
  
  public clearCompletedTasks() {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'success' || task.status === 'cancelled') {
        this.tasks.delete(id)
      }
    }
    this.emitTasks()
  }
}

export const taskManagerService = new TaskManagerService()

