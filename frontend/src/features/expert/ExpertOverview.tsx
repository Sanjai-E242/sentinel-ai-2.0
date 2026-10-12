import React from 'react';
import { MetricCard } from '../../components/common/MetricCard';
import { DecisionBadge } from '../../components/common/DecisionBadge';
import { Activity, Gauge, GitBranch, Crosshair, Lock } from 'lucide-react';
import { InterventionWindowStage } from '@sentinel/shared';
import { useNavigation } from '../../stores/navigationContext';
import { AgentConnectionStatus } from '../../components/common/AgentConnectionStatus';

const INTERVENTION_STAGES: { stage: InterventionWindowStage; label: string; active?: boolean; optimal?: boolean }[] = [
  { stage: 'TOO_EARLY', label: '1. Too Early' },
  { stage: 'MONITOR', label: '2. Monitor' },
  { stage: 'WARNING', label: '3. Warning' },
  { stage: 'OPTIMAL_INTERVENTION_WINDOW', label: '4. Optimal Window', active: true, optimal: true },
  { stage: 'CONFIRM', label: '5. Confirm' },
  { stage: 'TOO_LATE', label: '6. Too Late' }
];

export const ExpertOverview: React.FC = () => {
  const { setActiveTab } = useNavigation();

  return (
    <div className="space-y-6">
      {/* AI Agent Connection Indicator */}
      <AgentConnectionStatus />

      {/* Top Banner: Technical Telemetry */}
      <div className="card-tactile p-6 bg-surface-primary dark:bg-surface-primary border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">
                Sentinel Runtime Control Plane // Expert View
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              Active Intervention Intelligence Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Observing real-time behavioral vectors, trajectory deviations, and irreversible transition boundaries.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('interventions')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-tactile-subtle hover:bg-slate-800 dark:hover:bg-white transition-all cursor-pointer"
            >
              Open Interventions Console →
            </button>
            <div className="px-3 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-xs font-mono text-slate-600 dark:text-slate-300">
              Active Model: <span className="text-blue-600 dark:text-blue-400 font-semibold">Gemini 1.5 Pro</span>
            </div>
          </div>
        </div>

        {/* Central Innovation: The Intervention Window Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-orange-500" />
              Intervention Window Assessment
            </span>
            <span className="text-xs font-mono text-orange-600 dark:text-orange-400 font-semibold">
              Current Vector: OPTIMAL_INTERVENTION_WINDOW
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {INTERVENTION_STAGES.map((s) => (
              <div
                key={s.stage}
                className={`p-2.5 rounded-xl text-center border text-xs font-medium transition-all ${
                  s.active
                    ? 'bg-orange-500 text-white border-orange-600 shadow-md font-bold'
                    : 'bg-surface-100 dark:bg-surface-800/60 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800'
                }`}
              >
                <div>{s.label}</div>
                {s.optimal && (
                  <div className="text-[10px] uppercase font-bold tracking-tight opacity-90 mt-0.5">
                    Sweet Spot
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 px-1">
            <span>Too Early = Workflow Disruption</span>
            <span className="text-orange-600 dark:text-orange-400 font-medium">Optimal = Prevent Harm</span>
            <span>Too Late = Irreversible Damage</span>
          </div>
        </div>
      </div>

      {/* Technical Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Overall Risk Score"
          value="72 / 100"
          subtitle="Tier: High Risk"
          icon={<Gauge className="w-4 h-4 text-amber-500" />}
          hint="Composite multi-engine evaluation"
        />
        <MetricCard
          title="Trajectory Deviation"
          value="81%"
          subtitle="Baseline drift: Severe"
          icon={<GitBranch className="w-4 h-4 text-orange-500" />}
          hint="Behavior divergence from known priors"
        />
        <MetricCard
          title="Risk Acceleration"
          value="+4.2 dR/dt"
          subtitle="Velocity: Exponential"
          icon={<Activity className="w-4 h-4 text-rose-500" />}
          hint="Rate of score climb per step"
        />
        <MetricCard
          title="Scope Constraint"
          value="Violated"
          subtitle="Attempted resource expansion"
          icon={<Lock className="w-4 h-4 text-red-500" />}
          hint="Target: staging-vpc/containers"
        />
      </div>

      {/* Technical Audit Event Stream */}
      <div className="card-tactile p-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Runtime Action Interception Stream
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Low-level event classification, scope checks, and Sentinel enforcement records
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Stream Buffer: 3 active events</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DecisionBadge decision="CONFIRM" />
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                  EXECUTE :: docker_delete_container
                </span>
                <span className="text-slate-400 font-mono text-[11px]">[seq: 142]</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Agent: <span className="font-mono text-slate-700 dark:text-slate-300">agent-cloud-opt</span> | Target: <span className="font-mono text-amber-600 dark:text-amber-400">/prod/containers/web-lb</span> (Irreversible: true)
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="font-mono font-bold text-orange-600 dark:text-orange-400">Risk: 86/100</div>
                <div className="text-[11px] text-slate-400">Intervention: CONFIRM</div>
              </div>
            </div>
          </div>

          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DecisionBadge decision="MONITOR" />
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                  READ :: fetch_financial_metrics
                </span>
                <span className="text-slate-400 font-mono text-[11px]">[seq: 141]</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Agent: <span className="font-mono text-slate-700 dark:text-slate-300">agent-fin-analyst</span> | Target: <span className="font-mono text-sky-600 dark:text-sky-400">/reports/q3-summary</span> (Irreversible: false)
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="font-mono font-bold text-sky-600 dark:text-sky-400">Risk: 34/100</div>
                <div className="text-[11px] text-slate-400">Intervention: MONITOR</div>
              </div>
            </div>
          </div>

          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DecisionBadge decision="ALLOW" />
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                  READ :: search_kb_articles
                </span>
                <span className="text-slate-400 font-mono text-[11px]">[seq: 140]</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Agent: <span className="font-mono text-slate-700 dark:text-slate-300">agent-cust-supp</span> | Target: <span className="font-mono text-emerald-600 dark:text-emerald-400">/knowledge/public/*</span> (Irreversible: false)
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Risk: 08/100</div>
                <div className="text-[11px] text-slate-400">Intervention: ALLOW</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
