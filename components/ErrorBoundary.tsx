import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('Error caught by boundary:', error);
    console.error('Error info:', errorInfo);
    
    // Store error info for display
    this.setState({ errorInfo });
    
    // In production, you would send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
    
    // Log additional context
    console.error('Error occurred at:', new Date().toISOString());
    console.error('User agent:', navigator.userAgent);
    console.error('Current URL:', window.location.href);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    // Clear any problematic state from localStorage
    try {
      localStorage.removeItem('translationHistory');
      localStorage.removeItem('sharedReports');
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center max-w-2xl w-full">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-slate-700 mb-2">Something went wrong</h2>
            <p className="text-slate-600 mb-6">
              An unexpected error occurred. Please try reloading the page or resetting the application.
            </p>
            
            {isDevelopment && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-red-800 mb-2">Error Details (Development):</h3>
                <p className="text-red-700 text-sm mb-2">
                  <strong>Error:</strong> {this.state.error.message}
                </p>
                <p className="text-red-700 text-sm mb-2">
                  <strong>Stack:</strong> {this.state.error.stack}
                </p>
                {this.state.errorInfo && (
                  <details className="text-red-700 text-sm">
                    <summary className="cursor-pointer font-semibold">Component Stack</summary>
                    <pre className="mt-2 text-xs overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={this.handleReload}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Reload Page
              </button>
              <button 
                onClick={this.handleReset}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Reset Application
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-4">
              If the problem persists, please contact support with the error details above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



