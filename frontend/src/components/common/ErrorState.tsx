import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Connection Alert',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`card-tactile p-8 text-center flex flex-col items-center justify-center border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-950 dark:text-rose-200">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-rose-800/80 dark:text-rose-300/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-pill bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-tactile-subtle"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
};
