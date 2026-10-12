import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('[Sentinel UI Error Boundary caught an error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="card-tactile p-6 my-4 border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-rose-900 dark:text-rose-200">
                {this.props.fallbackTitle || 'A component encountered an error'}
              </h3>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300/80">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
              <button
                onClick={this.handleReset}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Component
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
