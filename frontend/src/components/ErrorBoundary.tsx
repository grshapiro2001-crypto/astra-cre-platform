import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary — catches render crashes so the app never shows
 * a blank white page. Instead users see a friendly recovery screen with
 * options to retry or navigate home.
 *
 * Class component is required because React does not support error
 * boundaries as function components (useErrorBoundary does not exist).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log to console for debugging
    console.error('[ErrorBoundary] Caught render crash:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h1 className="text-xl font-display font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while rendering this page.
                Your data is safe — try refreshing or navigating back.
              </p>
            </div>

            {/* Error details (collapsed by default) */}
            {this.state.error && (
              <details className="text-left bg-muted/50 rounded-xl p-4 text-xs">
                <summary className="text-muted-foreground cursor-pointer font-medium">
                  Error details
                </summary>
                <pre className="mt-2 text-destructive whitespace-pre-wrap break-words overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-1 text-muted-foreground whitespace-pre-wrap break-words overflow-auto max-h-32">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
