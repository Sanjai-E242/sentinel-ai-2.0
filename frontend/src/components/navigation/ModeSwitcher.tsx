import React from 'react';
import { useMode } from '../../hooks/useMode';
import { Sparkles, Terminal } from 'lucide-react';

export const ModeSwitcher: React.FC = () => {
  const { mode, setMode } = useMode();

  return (
    <div
      role="group"
      aria-label="View Mode Switcher"
      className="inline-flex items-center p-1 rounded-pill bg-surface-200/80 dark:bg-surface-800 border border-slate-200 dark:border-slate-700/60 shadow-inner"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'simple'}
        onClick={() => setMode('simple')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-pill transition-all duration-200 ${
          mode === 'simple'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-tactile-subtle'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>Simple Mode</span>
        <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
          Default
        </span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === 'expert'}
        onClick={() => setMode('expert')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-pill transition-all duration-200 ${
          mode === 'expert'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-tactile-subtle'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Terminal className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
        <span>Expert Mode</span>
      </button>
    </div>
  );
};
