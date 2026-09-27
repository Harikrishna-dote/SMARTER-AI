import { Component, type ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/primitives';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('UI crashed:', error, errorInfo.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <GlassCard strong className="w-full max-w-md p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-coral/15 text-coral">
              <RefreshCcw size={22} />
            </div>
            <h1 className="font-display text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <Button className="mt-4" onClick={this.handleReload} rightIcon={<RefreshCcw size={16} />}>
              Reload app
            </Button>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}
