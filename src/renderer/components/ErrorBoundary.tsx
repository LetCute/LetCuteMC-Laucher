import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  resetKey?: unknown;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught UI error:', error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-zinc-800/80 bg-zinc-900/85 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={15} className="text-zinc-400 shrink-0" />
              <span className="truncate">
                {this.props.fallbackMessage || 'Thành phần gặp sự cố.'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="h-7 px-2.5 text-xs font-semibold gap-1 bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 shrink-0 shadow-none"
            >
              <RefreshCw size={11} className="text-primary" />
              Thử lại
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[220px] p-6 text-center border border-zinc-800/80 bg-zinc-900/85 rounded-md shadow-md gap-3.5">
          <div className="h-9 w-9 rounded-md bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
            <AlertCircle size={18} className="text-zinc-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-200">
              Đã xảy ra sự cố giao diện
            </h3>
            <p className="text-xs text-muted-foreground max-w-[420px] leading-relaxed">
              {this.props.fallbackMessage || 'Một thành phần trên giao diện gặp sự cố không mong muốn.'}
            </p>
          </div>
          {this.state.error && (
            <div className="w-full max-w-md bg-zinc-950/60 border border-zinc-800/80 p-2.5 rounded text-left overflow-auto max-h-32">
              <p className="text-[11px] font-mono text-zinc-400 break-words leading-snug">
                {this.state.error.message}
              </p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="h-8 px-3 text-xs font-semibold gap-1.5 bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 shadow-none mt-1"
          >
            <RefreshCw size={13} className="text-primary" />
            Thử lại
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

