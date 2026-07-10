import { useCallback, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { launcherClient } from '../../services/launcherClient'

type DropZoneProps = {
  accept: string[] // extensions without dot, e.g. ['jar']
  onDropFiles: (paths: string[]) => void | Promise<void>
  children: ReactNode
  className?: string
  label?: string
}

function matches(name: string, accept: string[]): boolean {
  const lower = name.toLowerCase()
  return accept.some((ext) => lower.endsWith(`.${ext.toLowerCase()}`))
}

/** Full-area drag-drop. Works with or without existing items. */
export function DropZone({ accept, onDropFiles, children, className, label }: DropZoneProps) {
  const [active, setActive] = useState(false)
  const depth = useRef(0)

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    depth.current += 1
    setActive(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setActive(false)
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      depth.current = 0
      setActive(false)
      const files = Array.from(e.dataTransfer.files)
      const paths = files
        .filter((f) => matches(f.name, accept))
        .map((f) => launcherClient.getPathForFile(f))
        .filter((p): p is string => Boolean(p))
      if (paths.length) void onDropFiles(paths)
    },
    [accept, onDropFiles],
  )

  return (
    <div
      className={cn('relative min-h-0 flex-1 flex flex-col', className)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
      {active && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8" />
            <p className="text-sm font-semibold">{label ?? `Thả file .${accept.join(' / .')}`}</p>
          </div>
        </div>
      )}
    </div>
  )
}
