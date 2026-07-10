import { useState, useEffect } from 'react';
import type { MinecraftVersionCatalog, MinecraftVersionItem } from '@/shared/types.ts';
import { Badge } from '../components/ui/Badge';
import { Download, FolderOpen, PlusCircle, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { launcherClient } from '../services/launcherClient';

interface VersionsScreenProps {
  catalog: MinecraftVersionCatalog | null;
  gameDir: string;
  onCreateProfile: (versionItem?: MinecraftVersionItem) => void;
  onRefresh?: () => void;
  isWorking?: boolean;
}

type TabKey = 'releases' | 'installed';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'releases', label: 'Chính thức (Vanilla)' },
  { key: 'installed', label: 'Đã cài / Thủ công' },
];



function SourceBadge({ source }: { source: MinecraftVersionItem['source'] }) {
  if (source === 'local') return <Badge variant="success">Cục bộ</Badge>;
  if (source === 'local_and_online') return <Badge variant="info">Cục bộ + Online</Badge>;
  return <Badge variant="default">Online</Badge>;
}

export function VersionsScreen({ catalog, gameDir: _gameDir, onCreateProfile, onRefresh, isWorking }: VersionsScreenProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('releases');
  const [displayedList, setDisplayedList] = useState<MinecraftVersionItem[]>([]);
  const [isTabLoading, setIsTabLoading] = useState(false);

  useEffect(() => {
    if (!catalog) return;
    setIsTabLoading(true);
    const timer = setTimeout(() => {
      if (activeTab === 'releases') {
        setDisplayedList(catalog.releases);
      } else {
        setDisplayedList(catalog.all.filter(v => v.isInstalled));
      }
      setIsTabLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab, catalog]);

  if (!catalog) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p>Đang tải danh sách phiên bản...</p>
        </div>
      </div>
    );
  }

  const installedCount = catalog.all.filter(v => v.isInstalled).length;

  return (
    <div className="flex flex-col h-full px-6 pt-2 pb-6 gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Phiên bản Minecraft</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chọn phiên bản để tạo profile (Vanilla hoặc loader thủ công).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onCreateProfile()}
            disabled={isWorking}
            variant="primary"
            size="sm"
            className="h-9 px-3"
            title="Tạo cấu hình mới từ phiên bản bất kỳ"
          >
            <PlusCircle size={14} className="mr-1.5" />
            Tạo cấu hình
          </Button>
          <Button
            onClick={() => onRefresh?.()}
            disabled={isWorking}
            variant="secondary"
            size="sm"
            className="h-9 px-3"
            title="Tải lại danh sách phiên bản đã cài"
          >
            <RefreshCw size={14} className="mr-1.5" />
            Tải lại
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border pb-3 flex-wrap">
        {TABS.map(tab => (
          <Button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            variant={activeTab === tab.key ? 'primary' : 'ghost'}
            className={
              activeTab === tab.key
                ? 'px-4 py-2 rounded-xl text-sm font-medium border h-9 border-primary'
                : 'px-4 py-2 rounded-xl text-sm font-medium border h-9 text-muted-foreground hover:text-foreground border-transparent'
            }
          >
            {tab.label}
            {tab.key === 'installed' && installedCount > 0 && (
              <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {installedCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isTabLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <p>Đang tải danh sách...</p>
            </div>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Không có phiên bản nào trong mục này.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayedList.map(v => (
                <div
                  key={v.id}
                  className="group flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/40 transition"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{v.name}</span>
                      {!v.isInstalled ? (
                        <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                          <Download size={10} />
                          Sẽ tải khi chạy
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <SourceBadge source={v.source} />
                      {v.isInstalled && <Badge variant="success">Đã cài đặt</Badge>}
                      {v.releaseTime && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.releaseTime).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {v.isInstalled && v.path && (
                      <Button
                        title="Mở thư mục"
                        onClick={() => launcherClient.openVersionFolder(v.path!)}
                        variant="secondary"
                        size="sm"
                      >
                        <FolderOpen size={14} />
                      </Button>
                    )}
                    <Button onClick={() => onCreateProfile(v)} variant="primary" size="sm">
                      <PlusCircle size={14} />
                      Tạo cấu hình
                    </Button>
                    {v.isInstalled && v.path && (
                      <Button
                        title="Xóa phiên bản"
                        onClick={async () => {
                          if (!confirm(`Xóa ${v.name}?`)) return;
                          await launcherClient.deleteVersion(v.path!);
                          onRefresh?.();
                        }}
                        variant="secondary"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VersionsScreen;
