import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading Sentinel control plane...',
  subtext,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      <div className="relative flex items-center justify-center w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-800" />
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{message}</p>
      {subtext && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtext}</p>}
    </div>
  );
};
