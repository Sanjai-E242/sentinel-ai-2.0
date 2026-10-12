import React, { useState, useEffect, useCallback } from 'react';
import {
  Session,
  SessionSimulationComparison,
  SimulatedInterventionResult,
  SessionSimulationTimelineItem
} from '@sentinel/shared';
import { sessionsApi } from '../../api/sessions.api';
import { simulationsApi } from '../../api/simulations.api';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import {
  Sparkles,
  Clock,
  Ban,
  CheckCircle2,
  RefreshCw,
  GitFork,
  Eye,
  Info,
  Flame
} from 'lucide-react';

interface CounterfactualSimulationViewProps {
  initialSessionId?: string;
  className?: string;
}

export const CounterfactualSimulationView: React.FC<CounterfactualSimulationViewProps> = ({
  initialSessionId,
  className = ''
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || 'canonical-gemini');
  const [comparison, setComparison] = useState<SessionSimulationComparison | null>(null);
  const [activeScenario, setActiveScenario] = useState<'early' | 'optimal' | 'late'>('optimal');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load available sessions
  useEffect(() => {
    sessionsApi.list().then((list) => {
      setSessions(list);
      if (!initialSessionId && list.length > 0 && selectedSessionId === 'canonical-gemini') {
        // Find if a real session has recorded actions
        const sessionWithActions = list.find((s) => (s.actionCount || 0) > 0);
        if (sessionWithActions) {
          setSelectedSessionId(sessionWithActions.id);
        }
      }
    }).catch(() => {
      // Non-fatal, fallback to canonical
    });
  }, [initialSessionId]);

  // Load simulation data for the chosen session
  const loadSimulation = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await simulationsApi.getComparison(sessionId);
      setComparison(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to calculate counterfactual simulation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadSimulation(selectedSessionId);
    }
  }, [selectedSessionId, loadSimulation]);

  if (isLoading && !comparison) {
    return <LoadingState message="Generating deterministic counterfactual simulations..." />;
  }

  if (error && !comparison) {
    return (
      <ErrorState
        title="Simulation Error"
        message={error}
        onRetry={() => loadSimulation(selectedSessionId)}
      />
    );
  }

  const selectedSim: SimulatedInterventionResult | undefined = comparison?.simulations[activeScenario];
  const timeline: SessionSimulationTimelineItem[] = comparison?.trajectoryTimeline || [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header & Session Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-primary border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Counterfactual Intervention Simulator
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Sentinel 2.0 Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluates "When is the right moment to intervene?" by replaying 3 intervention strategies on the <strong>exact same agent trajectory</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Session Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
            Trajectory Session:
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="text-xs font-mono bg-surface-secondary dark:bg-surface-secondary border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="canonical-gemini">⭐ Canonical Gemini Demo (7 Steps)</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 16)}... ({s.actionCount || 0} actions, risk: {s.currentRisk || 0})
              </option>
            ))}
          </select>
          <button
            onClick={() => loadSimulation(selectedSessionId)}
            title="Refresh simulation"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 bg-surface-secondary rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Three Cards Comparison Grid */}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card A: TOO EARLY */}
          <div
            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
              activeScenario === 'early'
                ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-400 dark:border-blue-600 shadow-md ring-2 ring-blue-400/20'
                : 'bg-surface-primary border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
            onClick={() => setActiveScenario('early')}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wider uppercase text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  TOO EARLY
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">
                  Premature Block
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Intervention: Action {comparison.simulations.early.interventionIndex}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Risk at Intervention: <span className="font-bold text-blue-600 dark:text-blue-400">{comparison.simulations.early.riskAtIntervention}/100</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 mb-4">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                  Workflow interrupted early
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                  Intervened before sufficient drift evidence accumulated, halting {comparison.simulations.early.actionsPreventedAfterIntervention.length} benign downstream operations and causing high friction.
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveScenario('early');
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeScenario === 'early'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface-secondary text-slate-700 dark:text-slate-300 hover:bg-surface-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{activeScenario === 'early' ? 'Viewing Simulation' : 'View Simulation'}</span>
            </button>
          </div>

          {/* Card B: OPTIMAL WINDOW ⭐ */}
          <div
            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden ${
              activeScenario === 'optimal'
                ? 'bg-amber-50/50 dark:bg-amber-950/25 border-amber-400 dark:border-amber-500/80 shadow-md ring-2 ring-amber-400/30'
                : 'bg-surface-primary border-amber-300/60 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-700'
            }`}
            onClick={() => setActiveScenario('optimal')}
          >
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-amber-600 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Recommended
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wider uppercase text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  OPTIMAL WINDOW ⭐
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-semibold mr-16">
                  Pareto Point
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Intervention: Action {comparison.simulations.optimal.interventionIndex}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Risk at Intervention: <span className="font-bold text-amber-600 dark:text-amber-400">{comparison.simulations.optimal.riskAtIntervention}/100</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-100/60 dark:bg-amber-900/25 border border-amber-300/80 dark:border-amber-800/60 mb-4">
                <p className="text-xs font-medium text-amber-950 dark:text-amber-100">
                  Risk contained before destructive action
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1 leading-relaxed">
                  Allowed benign exploratory tasks to proceed, but paused the agent immediately upon scope divergence—preventing irreversible deletion while maintaining zero false disruption.
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveScenario('optimal');
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeScenario === 'optimal'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-surface-secondary text-slate-700 dark:text-slate-300 hover:bg-surface-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{activeScenario === 'optimal' ? 'Viewing Simulation' : 'View Simulation'}</span>
            </button>
          </div>

          {/* Card C: TOO LATE */}
          <div
            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
              activeScenario === 'late'
                ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-400 dark:border-rose-600 shadow-md ring-2 ring-rose-400/20'
                : 'bg-surface-primary border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
            onClick={() => setActiveScenario('late')}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wider uppercase text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  TOO LATE
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold">
                  Collapsed Buffer
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Intervention: Action {comparison.simulations.late.interventionIndex}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Risk at Intervention: <span className="font-bold text-rose-600 dark:text-rose-400">{comparison.simulations.late.riskAtIntervention}/100 (Critical)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-100/50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 mb-4">
                <p className="text-xs font-medium text-rose-900 dark:text-rose-200">
                  Dangerous trajectory progressed further
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                  The agent reached sensitive employee data and administrative credentials unchecked. The system was forced into a reactive emergency hard block with zero recovery margin.
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveScenario('late');
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeScenario === 'late'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-surface-secondary text-slate-700 dark:text-slate-300 hover:bg-surface-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{activeScenario === 'late' ? 'Viewing Simulation' : 'View Simulation'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Visual Timeline: Comparing the 3 Points Against the SAME Trajectory */}
      {comparison && (
        <div className="p-5 rounded-2xl bg-surface-primary border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Comparative Intervention Timeline</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Single Ground-Truth Trajectory</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualizing where each strategy halts the <strong>exact same sequence of {timeline.length} actions</strong>.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-300">Executed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-300">Prevented</span>
              </div>
            </div>
          </div>

          {/* Stepper / Timeline Comparison Tracks */}
          <div className="space-y-4 pt-2">
            {/* Strategy 1 Track: TOO EARLY */}
            <div className={`p-3.5 rounded-xl border transition-all ${activeScenario === 'early' ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : 'bg-surface-secondary border-slate-200/60 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  Strategy A: TOO EARLY (Halt at Action {comparison.earlyInterventionIndex})
                </span>
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  Executed: {comparison.simulations.early.actionsExecutedBeforeIntervention.length} | Prevented: {comparison.simulations.early.actionsPreventedAfterIntervention.length}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {timeline.map((step) => {
                  const isExecuted = step.stepNumber <= comparison.earlyInterventionIndex;
                  const isInterventionPoint = step.stepNumber === comparison.earlyInterventionIndex;
                  return (
                    <div
                      key={`early-${step.stepNumber}`}
                      className={`p-2 rounded-lg text-center border transition-all ${
                        isInterventionPoint
                          ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/40'
                          : isExecuted
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-surface-800 text-slate-400 border-dashed border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold">Act {step.stepNumber}</div>
                      <div className="text-[9px] truncate max-w-full font-mono mt-0.5">{step.action}</div>
                      <div className="text-[9px] font-bold mt-1">R: {step.risk}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strategy 2 Track: OPTIMAL WINDOW ⭐ */}
            <div className={`p-3.5 rounded-xl border transition-all ${activeScenario === 'optimal' ? 'bg-amber-50/40 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 shadow-sm' : 'bg-surface-secondary border-slate-200/60 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Strategy B: OPTIMAL WINDOW ⭐ (Halt at Action {comparison.optimalInterventionIndex})
                </span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 font-semibold">
                  Executed: {comparison.simulations.optimal.actionsExecutedBeforeIntervention.length} | Prevented: {comparison.simulations.optimal.actionsPreventedAfterIntervention.length}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {timeline.map((step) => {
                  const isExecuted = step.stepNumber <= comparison.optimalInterventionIndex;
                  const isInterventionPoint = step.stepNumber === comparison.optimalInterventionIndex;
                  return (
                    <div
                      key={`optimal-${step.stepNumber}`}
                      className={`p-2 rounded-lg text-center border transition-all ${
                        isInterventionPoint
                          ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/50 shadow-sm'
                          : isExecuted
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-dashed border-rose-300 dark:border-rose-800 opacity-75'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold">Act {step.stepNumber}</div>
                      <div className="text-[9px] truncate max-w-full font-mono mt-0.5">{step.action}</div>
                      <div className="text-[9px] font-bold mt-1">R: {step.risk}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strategy 3 Track: TOO LATE */}
            <div className={`p-3.5 rounded-xl border transition-all ${activeScenario === 'late' ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-300 dark:border-rose-700' : 'bg-surface-secondary border-slate-200/60 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  Strategy C: TOO LATE (Halt at Action {comparison.lateInterventionIndex})
                </span>
                <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-semibold">
                  Executed: {comparison.simulations.late.actionsExecutedBeforeIntervention.length} | Prevented: {comparison.simulations.late.actionsPreventedAfterIntervention.length}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {timeline.map((step) => {
                  const isExecuted = step.stepNumber <= comparison.lateInterventionIndex;
                  const isInterventionPoint = step.stepNumber === comparison.lateInterventionIndex;
                  return (
                    <div
                      key={`late-${step.stepNumber}`}
                      className={`p-2 rounded-lg text-center border transition-all ${
                        isInterventionPoint
                          ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/40'
                          : isExecuted
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-surface-800 text-slate-400 border-dashed border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold">Act {step.stepNumber}</div>
                      <div className="text-[9px] truncate max-w-full font-mono mt-0.5">{step.action}</div>
                      <div className="text-[9px] font-bold mt-1">R: {step.risk}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Detailed Simulation Inspector for the Active Scenario */}
      {selectedSim && (
        <div className="p-5 rounded-2xl bg-surface-primary border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                {selectedSim.scenarioName}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Detailed Inspection & Action Impact
              </span>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Risk: <strong className="text-slate-900 dark:text-slate-100">{selectedSim.riskAtIntervention}/100</strong> | State: <strong className="text-slate-900 dark:text-slate-100">{selectedSim.finalSimulatedState}</strong>
            </div>
          </div>

          {/* Explainable Rationale */}
          <div className="p-3.5 rounded-xl bg-surface-secondary border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-500" />
              Sentinel Explainability Engine
            </div>
            {selectedSim.explanation}
          </div>

          {/* Two-Column Action Slices: Executed vs Prevented */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1: Actions Executed */}
            <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Actions Executed ({selectedSim.actionsExecutedBeforeIntervention.length})
                </span>
                <span className="text-[10px] font-mono">Permitted Precursors</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedSim.actionsExecutedBeforeIntervention.map((act, idx) => (
                  <div
                    key={act.eventId || idx}
                    className="p-2 rounded-lg bg-surface-primary border border-emerald-200/60 dark:border-emerald-800/40 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        #{idx + 1} {act.action}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                        {act.resource}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      R: {Number(act.metadata?.risk) || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Actions Prevented */}
            <div className="p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                <span className="flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-500" />
                  Actions Prevented ({selectedSim.actionsPreventedAfterIntervention.length})
                </span>
                <span className="text-[10px] font-mono">Blocked Downstream</span>
              </div>

              {selectedSim.actionsPreventedAfterIntervention.length === 0 ? (
                <div className="p-4 text-center rounded-lg bg-surface-primary border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  Zero actions prevented. Trajectory ran until final destructive collapse.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedSim.actionsPreventedAfterIntervention.map((act, idx) => {
                    const stepNum = selectedSim.interventionIndex + 1 + idx;
                    const isDestructive = act.action === 'DELETE' || act.reversibility === 'IRREVERSIBLE';
                    return (
                      <div
                        key={act.eventId || idx}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          isDestructive
                            ? 'bg-rose-100/50 dark:bg-rose-900/30 border-rose-300 dark:border-rose-800'
                            : 'bg-surface-primary border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isDestructive
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            #{stepNum} {act.action}
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                            {act.resource}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {act.sensitivity} | {act.reversibility}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
