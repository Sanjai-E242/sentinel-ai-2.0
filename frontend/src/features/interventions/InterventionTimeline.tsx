import React from 'react';
import { InterventionWindow, TrajectoryState } from '@sentinel/shared';
import { CheckCircle2, Sparkles, MapPin, Target } from 'lucide-react';

interface InterventionTimelineProps {
  currentStage?: TrajectoryState | string;
  interventionWindow?: InterventionWindow | string;
  currentRisk?: number;
  className?: string;
}

interface StageStep {
  id: string;
  label: string;
  sublabel: string;
  isOptimalPoint?: boolean;
  minRisk: number;
  maxRisk: number;
}

const TIMELINE_STAGES: StageStep[] = [
  { id: 'NORMAL', label: 'NORMAL', sublabel: 'Low risk & baseline exploratory actions', minRisk: 0, maxRisk: 30 },
  { id: 'WATCH', label: 'WATCH', sublabel: 'Minor novelty; passive telemetry elevated', minRisk: 31, maxRisk: 50 },
  { id: 'DRIFTING', label: 'DRIFTING', sublabel: 'Consistent divergence from task baseline', minRisk: 51, maxRisk: 65 },
  { id: 'OPTIMAL_WINDOW', label: 'OPTIMAL WINDOW', sublabel: 'Maximum reversibility & pre-breach window', isOptimalPoint: true, minRisk: 66, maxRisk: 75 },
  { id: 'ESCALATING', label: 'ESCALATING', sublabel: 'Sensitive access & high risk acceleration', minRisk: 76, maxRisk: 85 },
  { id: 'TOO_LATE', label: 'TOO LATE / CRITICAL', sublabel: 'Irreversible mutation or destructive action', minRisk: 86, maxRisk: 100 }
];

export const InterventionTimeline: React.FC<InterventionTimelineProps> = ({
  currentStage = 'NORMAL',
  interventionWindow = 'TOO_EARLY',
  currentRisk = 0,
  className = ''
}) => {
  // Resolve current active stage index
  const getCurrentIndex = (): number => {
    if (interventionWindow === 'TOO_LATE' || currentRisk >= 86) return 5;
    if (interventionWindow === 'OPTIMAL_WINDOW') return 3;
    if (currentStage === 'ESCALATING' || (currentRisk > 75 && currentRisk <= 85)) return 4;
    if (currentStage === 'DRIFTING' || (currentRisk > 50 && currentRisk <= 65)) return 2;
    if (currentStage === 'WATCH' || (currentRisk > 30 && currentRisk <= 50)) return 1;
    return 0; // NORMAL
  };

  const currentIndex = getCurrentIndex();

  return (
    <div className={`card-tactile p-6 bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              Sentinel Innovation
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Intervention Window Continuum
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Don't just detect risk. Intervene at the precise moment before irreversible harm occurs.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
            <span>Current Position</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Target className="w-3.5 h-3.5 text-amber-500" />
            <span>Recommended Window</span>
          </div>
        </div>
      </div>

      {/* Continuum Track */}
      <div className="mt-8 relative">
        {/* Connecting Progress Line */}
        <div className="absolute top-5 left-6 right-6 h-1 bg-slate-100 dark:bg-surface-800 rounded-full z-0" />
        <div
          className="absolute top-5 left-6 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full z-0 transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, (currentIndex / (TIMELINE_STAGES.length - 1)) * 100))}%` }}
        />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 relative z-10">
          {TIMELINE_STAGES.map((stage, idx) => {
            const isCurrent = idx === currentIndex;
            const isOptimal = stage.isOptimalPoint;
            const isPassed = idx < currentIndex;

            return (
              <div
                key={stage.id}
                className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 shadow-tactile-subtle'
                    : isOptimal
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40'
                    : 'bg-transparent border border-transparent'
                }`}
              >
                {/* Node Indicator */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-tactile ring-4 ring-indigo-100 dark:ring-indigo-900/50'
                      : isOptimal
                      ? 'bg-amber-500 text-white shadow-tactile ring-4 ring-amber-100 dark:ring-amber-900/40'
                      : isPassed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-surface-200 dark:bg-surface-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isOptimal ? (
                    <Sparkles className="w-4 h-4" />
                  ) : isCurrent ? (
                    <MapPin className="w-4 h-4" />
                  ) : isPassed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="text-[11px] font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Stage Badge & Label */}
                <div className="mt-3">
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={`text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-full ${
                        stage.id === 'OPTIMAL_WINDOW'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                          : stage.id === 'TOO_LATE'
                          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                          : 'bg-slate-100 dark:bg-surface-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
                    {stage.sublabel}
                  </p>
                </div>

                {/* Markers */}
                <div className="mt-2.5 flex flex-col items-center gap-1">
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                      <MapPin className="w-2.5 h-2.5" />
                      Active Position
                    </span>
                  )}
                  {isOptimal && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                      <Target className="w-2.5 h-2.5" />
                      Optimal Window
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
