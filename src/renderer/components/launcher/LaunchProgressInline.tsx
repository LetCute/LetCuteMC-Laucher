import type { LauncherProgress } from '@/shared/types';

interface LaunchProgressInlineProps {
  progress: LauncherProgress;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '—';
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function LaunchProgressInline({ progress }: LaunchProgressInlineProps) {
  const percent = clampPercent(progress.percent);
  const shouldShowDetails =
    progress.stage !== 'idle' &&
    progress.stage !== 'completed' &&
    progress.stage !== 'failed';

  if (!shouldShowDetails) return null;

  return (
    <div className="mt-6 rounded-md border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-200">
            {progress.title}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {progress.message}
          </p>
        </div>

        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
          {percent}%
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {progress.stage === 'downloading_java' && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Downloaded
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {formatBytes(progress.currentBytes)}
            </p>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Total
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {formatBytes(progress.totalBytes)}
            </p>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Speed
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {formatSpeed(progress.speedBytesPerSecond)}
            </p>
          </div>
        </div>
      )}

      {(progress.stage === 'extracting_java' || progress.stage === 'verifying_java') && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Stage</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {progress.stage === 'extracting_java' ? 'Extracting' : 'Verifying'}
            </p>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {progress.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
