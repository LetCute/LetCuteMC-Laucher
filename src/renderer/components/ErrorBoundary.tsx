import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px] p-6 text-center bg-card rounded-md border border-destructive/20 shadow-sm gap-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">
              Đã xảy ra lỗi giao diện
            </h2>
            <p className="text-sm text-muted-foreground max-w-[400px]">
              {this.props.fallbackMessage || 'Một thành phần trên giao diện gặp sự cố không mong muốn.'}
            </p>
          </div>
          {this.state.error && (
            <div className="w-full max-w-md bg-destructive/5 border border-destructive/10 p-3 rounded-md text-left overflow-auto max-h-32">
              <p className="text-xs font-mono text-destructive/80 break-words">
                {this.state.error.message}
              </p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2"
          >
            <RefreshCw size={14} className="mr-2" />
            Thử lại
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
