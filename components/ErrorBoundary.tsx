import React, { ErrorInfo, ReactNode } from 'react';
import { ExclamationIcon } from './Icons';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-grow flex items-center justify-center p-4">
            <div className="flex flex-col items-center justify-center h-full max-w-2xl text-center text-red-400 p-6 bg-gray-900 rounded-lg border border-red-800 shadow-2xl">
            <ExclamationIcon className="h-12 w-12 mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Something Went Wrong</h1>
            <p className="text-gray-300 mb-4">A critical error occurred in the application, which may be caused by a rendering issue or an invalid graph state during animation.</p>
            <p className="text-sm font-mono bg-red-900/50 p-4 rounded-md mt-2 text-left w-full overflow-auto">
                {this.state.error?.toString()}
            </p>
            <button
                onClick={this.handleRecover}
                className="mt-6 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-sm font-semibold transition-colors"
            >
                Try to Recover
            </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;