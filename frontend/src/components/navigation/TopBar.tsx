import React from 'react';
import { ModeSwitcher } from './ModeSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useHealth } from '../../hooks/useHealth';
import { usePersistence } from '../../hooks/usePersistence';
import { Shield, Radio, Menu, Database } from 'lucide-react';

interface TopBarProps {
  onToggleMobileNav?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileNav }) => {
  const { isOnline, latencyMs } = useHealth();
  const { provider, connected, details } = usePersistence();

  let persistenceLabel = 'Using local fallback';
  let persistenceColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';

  if (provider === 'supabase' && connected) {
    persistenceLabel = 'Connected';
    persistenceColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
  } else if (provider === 'supabase' && !connected) {
    persistenceLabel = 'Database unavailable';
    persistenceColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40';
  } else if (provider === 'memory') {
    persistenceLabel = 'In-Memory (Volatile)';
    persistenceColor = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-surface-primary/90 dark:bg-surface-primary/80 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center justify-between h-full gap-4">
        {/* Left: Mobile Nav Toggle + Brand */}
        <div className="flex items-center gap-3">
          {onToggleMobileNav && (
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-surface-200 dark:hover:bg-surface-800"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-tactile-subtle">
              <Shield className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  SENTINEL
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  2.0
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Runtime Control Layer for AI Agents
              </p>
            </div>
          </div>
        </div>

        {/* Center: Mode Switcher (Hidden on narrow screens, shown in header or body) */}
        <div className="hidden sm:flex items-center justify-center">
          <ModeSwitcher />
        </div>

        {/* Right: Runtime Health + Persistence Indicator + Theme Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Persistence status indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium border ${persistenceColor}`}
            title={details || persistenceLabel}
          >
            <Database className="w-3.5 h-3.5 opacity-80" />
            <span>{persistenceLabel}</span>
          </div>

          {/* Health indicator */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-pill text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
            }`}
            title={isOnline ? `Backend API active (${latencyMs}ms)` : 'Backend API disconnected'}
          >
            <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`} />
            <span className="hidden lg:inline">
              {isOnline ? 'API Connected' : 'API Offline'}
            </span>
            {isOnline && latencyMs !== undefined && (
              <span className="text-[10px] opacity-75 font-mono">
                {latencyMs}ms
              </span>
            )}
          </div>

          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
};
