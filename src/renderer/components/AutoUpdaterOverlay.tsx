import { useState, useEffect } from 'react'
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react'

export function AutoUpdaterOverlay() {
  const [updateState, setUpdateState] = useState<{
    visible: boolean;
    phase: 'checking' | 'available' | 'downloading' | 'ready' | 'error';
    message: string;
    progress: number;
    error?: string;
  }>({
    visible: false,
    phase: 'checking',
    message: '',
    progress: 0
  })

  useEffect(() => {
    if (!window.launcherApi) return;

    const unsubscribe = window.launcherApi.onUpdateStatus((status) => {
      switch (status.type) {
        case 'update-checking':
          // Optionally show checking status, but it might be too spammy if done on every startup
          // We will only show if it's available or downloading.
          break;
        case 'update-available':
          setUpdateState({ visible: true, phase: 'available', message: status.message, progress: 0 });
          break;
        case 'update-progress':
          setUpdateState({
            visible: true,
            phase: 'downloading',
            message: status.message,
            progress: status.data?.percent || 0
          });
          break;
        case 'update-downloaded':
          setUpdateState({ visible: true, phase: 'ready', message: status.message, progress: 100 });
          break;
        case 'update-error':
          setUpdateState({ visible: true, phase: 'error', message: status.message, progress: 0, error: status.data });
          break;
        case 'update-not-available':
          // Hide if no update
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  if (!updateState.visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          {updateState.phase === 'error' ? (
            <AlertCircle size={18} className="text-red-500" />
          ) : updateState.phase === 'ready' ? (
            <RefreshCw size={18} />
          ) : (
            <Download size={18} className={updateState.phase === 'downloading' ? 'animate-bounce' : ''} />
          )}
          <span>Cập nhật Launcher</span>
        </div>
        <button
          onClick={() => setUpdateState(s => ({ ...s, visible: false }))}
          className="text-zinc-500 hover:text-zinc-300"
        >
          <X size={16} />
        </button>
      </div>

      <div className="text-sm text-zinc-300">
        {updateState.message}
      </div>

      {updateState.phase === 'downloading' && (
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-cyan-500 transition-all duration-300 ease-out"
            style={{ width: `${updateState.progress}%` }}
          />
        </div>
      )}

      {updateState.phase === 'ready' && (
        <button
          onClick={() => window.launcherApi.quitAndInstallUpdate()}
          className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg transition-colors"
        >
          Khởi động lại ngay
        </button>
      )}
    </div>
  )
}
