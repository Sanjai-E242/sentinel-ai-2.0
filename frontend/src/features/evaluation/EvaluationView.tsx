import React, { useState, useEffect, useCallback } from 'react';
import { evaluationApi, EvaluationMetrics, ScenarioRunRecord } from '../../api/evaluation.api';
import { scenariosApi } from '../../api/scenarios.api';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BarChart3,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Crosshair,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Play,
  Info
} from 'lucide-react';
import { useNavigation } from '../../stores/navigationContext';

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
  border
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  border: string;
}) {
  return (
    <div className={`rounded-2xl border ${border} bg-surface-primary dark:bg-surface-primary p-4`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
        </div>
        <div className={`p-2 rounded-xl ${border.replace('border-', 'bg-').split(' ')[0]}/10`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function StateChip({ state }: { state: string }) {
  const styles: Record<string, string> = {
    NORMAL: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    WATCH: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    DRIFTING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    ESCALATING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[state] || 'bg-slate-100 text-slate-600'}`}>
      {state}
    </span>
  );
}

function WindowChip({ window }: { window?: string }) {
  if (!window) return <span className="text-[10px] text-slate-400">—</span>;
  const styles: Record<string, string> = {
    TOO_EARLY: 'text-sky-600 dark:text-sky-400',
    OPTIMAL_WINDOW: 'text-orange-600 dark:text-orange-400 font-bold',
    TOO_LATE: 'text-red-600 dark:text-red-400'
  };
  return <span className={`text-[10px] font-mono ${styles[window] || 'text-slate-400'}`}>{window.replace('_', ' ')}</span>;
}

function InterventionTimingBar({ metrics }: { metrics: EvaluationMetrics }) {
  const correct = metrics.interventionsTriggered;
  const blocked = metrics.dangerousActionsBlocked;
  const normal = metrics.normalActionsAllowed;
  const totalActions = normal + blocked + (metrics.interventionsTriggered * 2);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sentinel Action Distribution</h3>
      <div className="space-y-2">
        {[
          { label: 'Normal Actions Allowed', value: normal, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Interventions Triggered', value: correct, color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400' },
          { label: 'Dangerous Actions Blocked', value: blocked, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color, textColor }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-36 text-[11px] text-slate-500 text-right flex-shrink-0">{label}</div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-700`}
                style={{ width: `${Math.min(100, totalActions > 0 ? (value / totalActions) * 100 : 0)}%` }}
              />
            </div>
            <div className={`w-8 text-right text-[11px] font-mono font-bold ${textColor}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main EvaluationView ──────────────────────────────────────────────────────
export const EvaluationView: React.FC = () => {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const { setActiveTab } = useNavigation();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await evaluationApi.getMetrics();
      setMetrics(data);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load evaluation metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Seed by running key scenarios
  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await Promise.all([
        scenariosApi.run('NORMAL_RESEARCH').catch(() => null),
        scenariosApi.run('GRADUAL_ATTACK').catch(() => null)
      ]);
      await load();
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading Evaluation" subtext="Fetching scenario metrics…" />;
  if (error) return <ErrorState title="Evaluation Unavailable" message={error} onRetry={load} />;

  const isEmpty = !metrics || metrics.totalScenarioRuns === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            Evaluation Dashboard
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Prototype Evaluation Results
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Metrics computed from deterministic scenario executions. All values reflect actual API outcomes — nothing is hardcoded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {isEmpty && (
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 transition-colors shadow-tactile-subtle"
            >
              {isSeeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {isSeeding ? 'Running…' : 'Seed with Scenarios'}
            </button>
          )}
        </div>
      </div>

      {/* Prototype label */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>Prototype Simulation</strong> — Run scenarios via the{' '}
          <button onClick={() => setActiveTab('scenarios')} className="underline hover:no-underline">Scenario Lab</button>{' '}
          to populate real evaluation data from the live API.
        </span>
      </div>

      {isEmpty ? (
        <EmptyState
          title="No scenario runs yet"
          description="Run scenarios in the Scenario Lab to generate evaluation metrics. The Seed button above will automatically run NORMAL_RESEARCH and GRADUAL_ATTACK."
          action={{ label: 'Go to Scenario Lab', onClick: () => setActiveTab('scenarios') }}
        />
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricTile
              icon={BarChart3}
              label="Scenario Runs"
              value={metrics!.totalScenarioRuns}
              sub="Total executions"
              color="text-slate-700 dark:text-slate-200"
              border="border-slate-200 dark:border-slate-700"
            />
            <MetricTile
              icon={ShieldCheck}
              label="Normal Allowed"
              value={metrics!.normalActionsAllowed}
              sub="No false blocks"
              color="text-emerald-600 dark:text-emerald-400"
              border="border-emerald-200 dark:border-emerald-800/40"
            />
            <MetricTile
              icon={Crosshair}
              label="Interventions"
              value={metrics!.interventionsTriggered}
              sub="Optimal window hits"
              color="text-orange-600 dark:text-orange-400"
              border="border-orange-200 dark:border-orange-800/40"
            />
            <MetricTile
              icon={AlertTriangle}
              label="Blocked"
              value={metrics!.dangerousActionsBlocked}
              sub="Dangerous actions"
              color="text-red-600 dark:text-red-400"
              border="border-red-200 dark:border-red-800/40"
            />
            <MetricTile
              icon={TrendingUp}
              label="Suspicious Trajectories"
              value={metrics!.suspiciousTrajectoriesDetected}
              sub="DRIFTING → CRITICAL"
              color="text-amber-600 dark:text-amber-400"
              border="border-amber-200 dark:border-amber-800/40"
            />
            <MetricTile
              icon={CheckCircle2}
              label="Human Overrides"
              value={metrics!.humanOverrides}
              sub="Operator decisions"
              color="text-violet-600 dark:text-violet-400"
              border="border-violet-200 dark:border-violet-800/40"
            />
            <MetricTile
              icon={XCircle}
              label="False Interventions"
              value={metrics!.falseInterventions}
              sub="Blocks on safe scenarios"
              color={metrics!.falseInterventions === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
              border={metrics!.falseInterventions === 0 ? 'border-emerald-200 dark:border-emerald-800/40' : 'border-red-200 dark:border-red-800/40'}
            />
            <MetricTile
              icon={Clock}
              label="Avg Lead Time"
              value={`${metrics!.averageInterventionLeadTime} steps`}
              sub="Optimal → destructive gap"
              color="text-sky-600 dark:text-sky-400"
              border="border-sky-200 dark:border-sky-800/40"
            />
          </div>

          {/* Distribution chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary p-5">
            <InterventionTimingBar metrics={metrics!} />
          </div>

          {/* Intervention timing concept */}
          <div className="rounded-2xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/10 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-bold text-orange-800 dark:text-orange-200">Intervention Timing Analysis</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Too Early', description: 'Intervening before the agent has shown sufficient deviation disrupts legitimate workflows unnecessarily.', icon: Clock, color: 'text-sky-600 dark:text-sky-400' },
                { label: 'Optimal', description: `Average lead time: ${metrics!.averageInterventionLeadTime} action steps before a destructive threshold is reached.`, icon: Crosshair, color: 'text-orange-600 dark:text-orange-400', highlight: true },
                { label: 'Too Late', description: 'Waiting until the action is already destructive reduces the ability to prevent harm.', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' }
              ].map(({ label, description, icon: Icon, color, highlight }) => (
                <div key={label} className={`rounded-xl p-3 ${highlight ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700/40' : 'bg-white dark:bg-surface-800'}`}>
                  <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{label}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Run history table */}
          {metrics!.scenarioRunHistory.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-surface-primary dark:bg-surface-primary">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-surface-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Scenario Runs</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {metrics!.scenarioRunHistory.map((run: ScenarioRunRecord) => (
                  <div key={run.runId} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{run.scenarioName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{run.runId}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StateChip state={run.finalState} />
                      <WindowChip window={run.interventionWindow} />
                      <span className="text-[11px] font-mono text-slate-500">Risk: {run.finalRisk}</span>
                      <span className="text-[11px] text-slate-400">{run.actionCount} actions</span>
                      <span className="text-[11px] text-slate-400">{new Date(run.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
