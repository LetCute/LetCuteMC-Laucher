import { useState, useEffect } from 'react'
import type { BackgroundTask } from '../../shared/types'

export function useTaskManager() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([])

  useEffect(() => {
    let mounted = true

    // Fetch initial tasks
    window.launcherApi.getAllTasks().then((initialTasks) => {
      if (mounted) {
        setTasks(initialTasks)
      }
    })

    // Subscribe to updates
    const unsubscribe = window.launcherApi.onTasksUpdate((event) => {
      if (mounted && event.type === 'tasks-updated') {
        setTasks(event.tasks)
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const clearCompleted = async () => {
    await window.launcherApi.clearCompletedTasks()
    const newTasks = await window.launcherApi.getAllTasks()
    setTasks(newTasks)
  }

  const cancelTask = async (taskId: string) => {
    return await window.launcherApi.cancelTask(taskId)
  }

  const activeTaskCount = tasks.filter(t => t.status === 'running').length

  return {
    tasks,
    activeTaskCount,
    cancelTask,
    clearCompleted
  }
}
