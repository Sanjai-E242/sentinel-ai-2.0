import React, { useEffect, useState } from 'react';
import { Cpu, Shield } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ConnectionStatusData {
  sentinelCore: string;
  externalAgent: string;
  gemini: 'LIVE' | 'DEMO' | 'DISCONNECTED';
  demoMode?: boolean;
  geminiMode?: boolean;
}

export const AgentConnectionStatus: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className = ''
}) => {
  const [status, setStatus] = useState<ConnectionStatusData>({
    sentinelCore: 'CONNECTED',
    externalAgent: 'CONNECTED',
    gemini: 'DEMO'
  });

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await apiClient.get<ConnectionStatusData>('/v1/system/agent-connection');
        if (isMounted && data) {
          setStatus(data);
        }
      } catch {
        // Fallback to default state
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getGeminiBadgeClass = () => {
    switch (status.gemini) {
      case 'LIVE':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
        };
      case 'DEMO':
        return {
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          dot: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
        };
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          dot: 'bg-slate-500'
        };
    }
  };

  const geminiColors = getGeminiBadgeClass();

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 text-xs backdrop-blur-sm ${className}`}>
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Gemini:</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${geminiColors.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${geminiColors.dot}`} />
            {status.gemini}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-800 dark:text-slate-200">
            AI AGENT CONNECTION
          </span>
        </div>
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Runtime Governance Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        {/* Sentinel Core */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-50 dark:bg-surface-850 border border-slate-200/50 dark:border-slate-800/80">
          <div>
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Sentinel Core</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{status.sentinelCore}</div>
          </div>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        {/* External Agent */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-50 dark:bg-surface-850 border border-slate-200/50 dark:border-slate-800/80">
          <div>
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">External Agent</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{status.externalAgent}</div>
          </div>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </div>

        {/* Gemini Model */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-50 dark:bg-surface-850 border border-slate-200/50 dark:border-slate-800/80">
          <div>
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Google Gemini</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {status.gemini}
            </div>
          </div>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${geminiColors.dot}`} />
        </div>
      </div>
    </div>
  );
};
