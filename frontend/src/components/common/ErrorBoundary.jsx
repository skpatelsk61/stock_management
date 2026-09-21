import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Global Error Boundary] Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center font-sans select-none">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
              Something went wrong
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              An unexpected application error occurred. We have logged the error details. Please try reloading the system.
            </p>
            {this.state.error && (
              <pre className="text-[10px] font-mono text-left bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-rose-600 dark:text-rose-400 overflow-x-auto max-h-40 mb-6">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 uppercase tracking-widest cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
