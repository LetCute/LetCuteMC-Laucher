import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  XCircle,
  Loader2,
  Trash2,
  Check,
  Ban
} from 'lucide-react'
import { useTaskManager } from '../hooks/useTaskManager'
import type { BackgroundTask } from '../../shared/types'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '@/components/ui/button'

export default function TasksScreen() {
  const { tasks, clearCompleted, cancelTask } = useTaskManager()

  return (
    <div className="px-6 pt-2 pb-6 h-full flex flex-col gap-6">
      <div className="flex flex-col gap-5 h-full min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground/80">Tiến trình hoạt động</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Quản lý các tác vụ nền đang chạy
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tasks.some(t => t.status === 'success' || t.status === 'cancelled' || t.status === 'error') && (
              <Button
                onClick={clearCompleted}
                variant="secondary"
                size="sm"
                className="h-9 px-3 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <Trash2 size={14} className="mr-1.5" />
                Dọn dẹp
              </Button>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto pr-1">
          {tasks.length === 0 ? (
            <EmptyState
              icon={<Activity size={32} />}
              title="Không có tiến trình nào"
              description="Các tác vụ tải xuống hoặc cài đặt sẽ hiển thị ở đây."
              showBorder={false}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onCancel={cancelTask} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, onCancel }: { task: BackgroundTask; onCancel: (id: string) => void }) {
  const isRunning = task.status === 'running'
  const isSuccess = task.status === 'success'
  const isError = task.status === 'error'
  const isCancelled = task.status === 'cancelled'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative overflow-hidden flex items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/85 hover:border-primary/40 transition-all duration-200 shadow-md"
    >
      {/* Background Progress Bar (if running) */}
      {isRunning && (
        <div
          className="absolute left-0 bottom-0 h-[2px] bg-primary transition-all duration-300"
          style={{ width: `${task.percent}%` }}
        />
      )}

      <div className="flex items-center gap-3.5 min-w-0 flex-1 relative z-10">
        <div className={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all duration-150',
          isRunning
            ? 'border-primary bg-primary text-primary-foreground'
            : isSuccess
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : isError
                ? 'border-red-500 bg-red-500 text-white'
                : isCancelled
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-border bg-background',
        ].join(' ')}>
          {isRunning && <Loader2 size={12} strokeWidth={3} className="animate-spin" />}
          {isSuccess && <Check size={12} strokeWidth={3} />}
          {isError && <XCircle size={12} strokeWidth={3} />}
          {isCancelled && <Ban size={12} strokeWidth={3} />}
        </div>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={[
              'text-sm font-bold truncate transition-colors',
              isRunning ? 'text-primary' : 'text-foreground'
            ].join(' ')} title={task.name}>
              {task.name}
            </span>
            {isRunning && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                {Math.round(task.percent)}%
              </span>
            )}
          </div>

          <div className={`text-xs ${isError ? 'text-red-400/90' : isCancelled ? 'text-amber-400/90' : 'text-muted-foreground'} line-clamp-1`}>
            {task.message}
          </div>
        </div>
      </div>

      {isRunning && (
        <Button
          onClick={() => onCancel(task.id)}
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0 relative z-10"
        >
          <Ban size={13} className="mr-1" />
          Hủy
        </Button>
      )}
    </motion.div>
  )
}
