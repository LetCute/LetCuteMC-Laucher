import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

interface UpdaterScreenProps {
  onComplete: () => void;
}

export function UpdaterScreen({ onComplete }: UpdaterScreenProps) {
  const [phase, setPhase] = useState<'checking' | 'downloading' | 'ready' | 'error'>('checking');
  const [message, setMessage] = useState('Đang kiểm tra cập nhật...');
  const [progress, setProgress] = useState(0);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  
  const hasFinishedRef = useRef(false);

  // Helper to safely complete the splash screen
  const completeAndProceed = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    
    // Slight delay so user can read "Bạn đang dùng phiên bản mới nhất" or error message
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  useEffect(() => {
    if (!window.launcherApi) {
      completeAndProceed();
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const unsubscribe = window.launcherApi.onUpdateStatus((status) => {
      if (hasFinishedRef.current && phase !== 'downloading') return;

      switch (status.type) {
        case 'update-checking':
          setPhase('checking');
          setMessage(status.message);
          break;
        case 'update-available':
          clearTimeout(timeoutId);
          setPhase('downloading');
          setMessage(status.message);
          setProgress(0);
          break;
        case 'update-progress':
          clearTimeout(timeoutId);
          setPhase('downloading');
          setMessage(status.message);
          setProgress(status.data?.percent || 0);
          break;
        case 'update-downloaded':
          clearTimeout(timeoutId);
          setPhase('ready');
          setMessage(status.message);
          setProgress(100);
          hasFinishedRef.current = true; // Block completeAndProceed, we are quitting
          // Wait 2 seconds before quitting so user can see it's done
          setTimeout(() => {
            window.launcherApi.quitAndInstallUpdate();
          }, 2000);
          break;
        case 'update-error':
          clearTimeout(timeoutId);
          setPhase('error');
          setMessage(status.message);
          setErrorInfo(status.data?.toString() || 'Lỗi mạng hoặc không thể kết nối tới máy chủ cập nhật.');
          completeAndProceed();
          break;
        case 'update-not-available':
          clearTimeout(timeoutId);
          setPhase('checking');
          setMessage(status.message);
          completeAndProceed();
          break;
      }
    });

    // Fire the update check
    window.launcherApi.checkForUpdates().catch((err) => {
      console.error('Check for updates failed to invoke', err);
      setPhase('error');
      setMessage('Không thể kiểm tra cập nhật');
      completeAndProceed();
    });

    // Fallback timeout in case the network hangs (15 seconds)
    timeoutId = setTimeout(() => {
      if (!hasFinishedRef.current && phase === 'checking') {
        setPhase('error');
        setMessage('Kết nối quá lâu. Đang bỏ qua cập nhật...');
        completeAndProceed();
      }
    }, 15000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#1c2127] text-white font-sans relative">
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 py-10 bg-zinc-900/80 border border-zinc-800/80 shadow-2xl rounded-2xl backdrop-blur-md">
        <img src="./logo.png" alt="LetCuteMC" className="w-24 h-24 mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse" />
        
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500 mb-2">
          LetCuteMC Launcher
        </h1>
        
        <div className="h-12 flex items-center justify-center mb-4">
          {phase === 'checking' && (
            <div className="flex items-center gap-2 text-primary">
              <RefreshCw className="animate-spin" size={18} />
              <span className="font-medium text-sm">{message}</span>
            </div>
          )}
          
          {phase === 'downloading' && (
            <div className="flex items-center gap-2 text-primary">
              <Download className="animate-bounce" size={18} />
              <span className="font-medium text-sm">{message}</span>
            </div>
          )}

          {phase === 'ready' && (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={18} />
              <span className="font-medium text-sm">{message}</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="font-medium text-sm">{message}</span>
            </div>
          )}
        </div>

        {/* Progress bar area */}
        <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden relative">
          {(phase === 'downloading' || phase === 'ready') ? (
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          ) : phase === 'checking' ? (
            <div className="absolute top-0 left-0 h-full w-1/3 bg-primary/50 rounded-full animate-[progress_1.5s_ease-in-out_infinite] shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          ) : phase === 'error' ? (
            <div className="absolute top-0 left-0 h-full w-full bg-red-500/50" />
          ) : null}
        </div>

        {phase === 'error' && errorInfo && (
          <p className="mt-4 text-xs text-zinc-500 text-center line-clamp-2">
            {errorInfo}
          </p>
        )}
      </div>

      <style>{`
        @keyframes progress {
          0% { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
