import { Minus, X } from 'lucide-react'
import { launcherClient } from '../../services/launcherClient'

/** Frameless chrome. maximizable=false → min + close only. */
export function TopBar() {
  return (
    <div
      className="h-9 flex items-center justify-between bg-background select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex-1"></div>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          type="button"
          onClick={() => void launcherClient.minimizeWindow()}
          className="h-9 w-11 flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => void launcherClient.closeWindow()}
          className="h-9 w-11 flex items-center justify-center hover:bg-red-600 text-muted-foreground hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
