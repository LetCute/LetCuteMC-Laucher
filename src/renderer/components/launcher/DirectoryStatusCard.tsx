import { FolderCheck, FolderX, RefreshCw, Search, FolderOpen } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/button'

interface DirectoryStatusCardProps {
  currentPath: string
  status: 'found' | 'missing'
  onAutoDetect: () => void
  onChooseFolder: () => void
  onRescan: () => void
}

export function DirectoryStatusCard({
  currentPath,
  status,
  onAutoDetect,
  onChooseFolder,
  onRescan
}: DirectoryStatusCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {status === 'found' ? (
            <FolderCheck className="h-4.5 w-4.5 text-emerald-400" />
          ) : (
            <FolderX className="h-4.5 w-4.5 text-amber-400" />
          )}
          <h3 className="text-sm font-semibold text-foreground">Thư mục Minecraft</h3>
        </div>
        <Badge variant={status === 'found' ? 'success' : 'warning'}>
          {status === 'found' ? 'Tìm thấy' : 'Chưa thấy'}
        </Badge>
      </div>

      {/* Path display */}
      <div className="rounded-xl border border-border bg-background/50 px-3.5 py-2.5 mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Đường dẫn hiện tại
        </p>
        <p className="break-all text-xs font-mono text-foreground">
          {currentPath || 'Chưa thiết lập'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onAutoDetect}
            variant="outline"
            size="sm"
          >
            <Search className="h-3.5 w-3.5" />
            Tự động tìm
          </Button>
          <Button
            onClick={onChooseFolder}
            variant="outline"
            size="sm"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Chọn thư mục
          </Button>
        </div>
        <Button
          onClick={onRescan}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Quét lại
        </Button>
      </div>
    </section>
  )
}
