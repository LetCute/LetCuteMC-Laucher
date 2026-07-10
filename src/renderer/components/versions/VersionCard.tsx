import { FolderOpen, Play } from 'lucide-react';
import type { LocalMinecraftVersion } from '@/shared/types.ts'
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface VersionCardProps {
  version: LocalMinecraftVersion;
  onUse: (version: LocalMinecraftVersion) => void;
  onInstall: (versionId: string) => void;
  onOpenFolder: (path: string) => void;
}

export const VersionCard = ({ version, onUse, onOpenFolder }: VersionCardProps) => {
  const isIncomplete = !version.hasJar || !version.hasJson;
  const displayType = version.type.charAt(0).toUpperCase() + version.type.slice(1);

  return (
    <Card className="flex items-center justify-between p-4 group">
      <div className="flex-1 flex items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            {version.name}
            {isIncomplete && (
              <span className="text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Chưa đủ tệp
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="default">{displayType}</Badge>
            <Badge variant="success">Đã cài đặt</Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-2 font-mono truncate max-w-sm" title={version.path}>
            {version.path}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onOpenFolder(version.path)}
          className="size-8 p-0 rounded-lg inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
          title="Mở thư mục"
        >
          <FolderOpen size={16} />
        </button>
        <button
          onClick={() => onUse(version)}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_20%,transparent)] h-8 px-3 text-xs rounded-lg"
        >
          <Play size={14} className="mr-1.5" /> Dùng
        </button>
      </div>
    </Card>
  );
};
