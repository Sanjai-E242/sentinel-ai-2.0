import React from 'react';
import { CounterfactualAnalysis } from '@sentinel/shared';
import { ShieldCheck, Sparkles, AlertOctagon, HelpCircle, GitFork } from 'lucide-react';
import { useNavigation } from '../../stores/navigationContext';

interface CounterfactualComparisonProps {
  counterfactual?: CounterfactualAnalysis;
  className?: string;
}

export const CounterfactualComparison: React.FC<CounterfactualComparisonProps> = ({
  counterfactual,
  className = ''
}) => {
  const { setActiveTab } = useNavigation();

  if (!counterfactual) {
    return null;
  }

  const paths = [
    {
      title: 'EARLY PATH',
      tag: 'Pre-Emptive Block',
      icon: HelpCircle,
      data: counterfactual.early,
      borderClass: 'border-slate-200 dark:border-slate-800',
      bgClass: 'bg-surface-primary dark:bg-surface-primary',
      badgeClass: 'bg-slate-100 dark:bg-surface-800 text-slate-600 dark:text-slate-400'
    },
    {
      title: 'RECOMMENDED PATH',
      tag: 'Optimal Window',
      icon: Sparkles,
      data: counterfactual.recommended,
      isOptimal: true,
      borderClass: 'border-amber-300 dark:border-amber-700/80 ring-2 ring-amber-400/20 shadow-tactile',
      bgClass: 'bg-amber-50/30 dark:bg-amber-950/20',
      badgeClass: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold'
    },
    {
      title: 'LATE PATH',
      tag: 'Reactive Cleanup',
      icon: AlertOctagon,
      data: counterfactual.late,
      borderClass: 'border-slate-200 dark:border-slate-800',
      bgClass: 'bg-surface-primary dark:bg-surface-primary',
      badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Counterfactual Path Analysis</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">Deterministic Simulation</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluating trade-offs across premature disruption, optimal intervention, and delayed breach.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('simulations')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-all shadow-sm"
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Interactive Simulator ↗</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {paths.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className={`p-4 rounded-xl border ${item.borderClass} ${item.bgClass} flex flex-col justify-between transition-all`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${item.isOptimal ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold tracking-wide text-slate-800 dark:text-slate-200">
                      {item.title}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${item.badgeClass}`}>
                    {item.tag}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  {item.data.explanation}
                </p>

                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Risk Prevented:</span>
                    <span className={`font-semibold ${
                      item.data.estimatedRiskPrevented === 'HIGH' || item.data.estimatedRiskPrevented === 'MAXIMAL'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : item.data.estimatedRiskPrevented === 'MODERATE'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {item.data.estimatedRiskPrevented}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Intervention Cost:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.data.interventionCost}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Workflow Disruption:</span>
                    <span className={`font-semibold ${
                      item.data.workflowDisruption === 'LOW'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : item.data.workflowDisruption === 'MEDIUM'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {item.data.workflowDisruption}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Potential Impact:</span>
                    <span className={`font-semibold ${
                      item.data.potentialImpact === 'LOW'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400 font-bold'
                    }`}>
                      {item.data.potentialImpact}
                    </span>
                  </div>
                </div>
              </div>

              {item.isOptimal && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/80 dark:border-amber-800/40 text-[10px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Maximum safety gain with minimal friction</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {counterfactual.optimalRationale && (
        <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            <strong className="text-slate-900 dark:text-slate-100 font-semibold">Pareto-Optimal Conclusion:</strong> {counterfactual.optimalRationale}
          </span>
        </div>
      )}
    </div>
  );
};
