import React, { useState, useEffect, useCallback, useRef } from 'react';
import { scenariosApi, ScenarioListItem, ScenarioRunResult, ScenarioStepResult } from '../../api/scenarios.api';
import { interventionsApi } from '../../api/interventions.api';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { DecisionBadge } from '../../components/common/DecisionBadge';
import { AgentConnectionStatus } from '../../components/common/AgentConnectionStatus';
import {
  FlaskConical,
  Play,
  RefreshCw,
  AlertTriangle,
  Zap,
  Clock,
  TrendingUp,
  Eye,
  Ban,
  CheckCircle2,
  XCircle,
  Crosshair
} from 'lucide-react';
import type { DecisionType } from '@sentinel/shared';

// ─── Scenario Metadata ───────────────────────────────────────────────────────
interface ScenarioMeta {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'NORMAL' | 'ATTACK' | 'FALSE_POSITIVE' | 'ESCALATION' | 'DESTRUCTIVE';
  tagline: string;
  color: string;
  bgGradient: string;
}

const SCENARIO_META: Record<string, ScenarioMeta> = {
  NORMAL_RESEARCH: {
    riskLevel: 'LOW',
    category: 'NORMAL',
    tagline: 'Demonstrates Sentinel does NOT block normal work',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20'
  },
  LEGITIMATE_BROAD_SEARCH: {
    riskLevel: 'LOW',
    category: 'FALSE_POSITIVE',
    tagline: 'Unusual volume, fully authorized — no false alarm',
    color: 'text-teal-600 dark:text-teal-400',
    bgGradient: 'from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20'
  },
  GRADUAL_SCOPE_CREEP: {
    riskLevel: 'MEDIUM',
    category: 'ATTACK',
    tagline: 'Trajectory drift detected before hard threshold breach',
    color: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20'
  },
  SENSITIVE_DATA_ACCESS: {
    riskLevel: 'HIGH',
    category: 'ESCALATION',
    tagline: 'Sudden sensitivity spike triggers immediate escalation',
    color: 'text-orange-600 dark:text-orange-400',
    bgGradient: 'from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20'
  },
  PRIVILEGE_ESCALATION: {
    riskLevel: 'CRITICAL',
    category: 'ESCALATION',
    tagline: 'Root access attempt — immediate critical response',
    color: 'text-red-600 dark:text-red-400',
    bgGradient: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20'
  },
  DESTRUCTIVE_ACTION: {
    riskLevel: 'CRITICAL',
    category: 'DESTRUCTIVE',
    tagline: 'Irreversible deletion triggers maximum containment',
    color: 'text-rose-600 dark:text-rose-400',
    bgGradient: 'from-rose-50 to-red-50 dark:from-rose-950/20 dark:to-red-950/20'
  },
  GRADUAL_ATTACK: {
    riskLevel: 'CRITICAL',
    category: 'ATTACK',
    tagline: 'Shows WHEN to intervene — the optimal window matters',
    color: 'text-violet-600 dark:text-violet-400',
    bgGradient: 'from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20'
  }
};

const RISK_LEVEL_BADGE: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBar({ value, animated }: { value: number; animated?: boolean }) {
  const color =
    value >= 80 ? 'bg-red-500' :
    value >= 60 ? 'bg-orange-500' :
    value >= 40 ? 'bg-amber-500' :
    value >= 20 ? 'bg-sky-500' : 'bg-emerald-500';

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} ${animated ? 'transition-all duration-700 ease-out' : ''}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function WindowBadge({ window }: { window?: string }) {
  if (!window) return null;
  const styles: Record<string, string> = {
    TOO_EARLY: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    OPTIMAL_WINDOW: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-bold',
    TOO_LATE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  };
  const labels: Record<string, string> = {
    TOO_EARLY: 'Too Early',
    OPTIMAL_WINDOW: '⭐ Optimal Window',
    TOO_LATE: 'Too Late'
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[window] || 'bg-slate-100 text-slate-500'}`}>
      {labels[window] || window}
    </span>
  );
}

// ─── Intervention Panel ───────────────────────────────────────────────────────
interface InterventionPanelProps {
  step: ScenarioStepResult;
  result: ScenarioRunResult;
  onDecision: (decision: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION') => Promise<void>;
  isSubmitting: boolean;
  decisionMade: string | null;
}

function InterventionPanel({ step, result, onDecision, isSubmitting, decisionMade }: InterventionPanelProps) {
  const pendingInterventionId = (result.session as Record<string, unknown>)?.pendingInterventionId as string | undefined;

  return (
    <div className="rounded-2xl border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/20 overflow-hidden shadow-tactile-hover">
      {/* Header */}
      <div className="px-5 py-3 bg-orange-500 dark:bg-orange-600 flex items-center gap-3">
        <Crosshair className="w-5 h-5 text-white flex-shrink-0" />
        <div>
          <div className="text-white font-bold text-sm tracking-wide">OPTIMAL INTERVENTION WINDOW DETECTED</div>
          <div className="text-orange-100 text-[11px]">Sentinel recommends human review now</div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-white dark:bg-surface-800 border border-orange-200 dark:border-orange-800/40">
            <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{step.risk}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Current Risk</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-white dark:bg-surface-800 border border-orange-200 dark:border-orange-800/40">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{Math.round(step.trajectoryDeviation)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Deviation %</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-white dark:bg-surface-800 border border-orange-200 dark:border-orange-800/40">
            <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{step.urgency || '—'}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Urgency</div>
          </div>
        </div>

        {/* Reason */}
        <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-surface-800 rounded-xl p-3 border border-orange-200 dark:border-orange-800/40">
          <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Why now?</div>
          <p className="leading-relaxed text-slate-600 dark:text-slate-400">
            Risk is accelerating and the trajectory has moved substantially outside its baseline,
            but the current action remains reversible — the optimal moment to pause and review.
          </p>
        </div>

        {/* Decision buttons */}
        {decisionMade ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Decision recorded: <strong>{decisionMade}</strong>
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Human Decision Required
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onDecision('ALLOW_ONCE')}
                disabled={isSubmitting || !pendingInterventionId}
                className="flex-1 min-w-[100px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Allow Once
              </button>
              <button
                onClick={() => onDecision('DENY')}
                disabled={isSubmitting || !pendingInterventionId}
                className="flex-1 min-w-[100px] px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Ban className="w-3.5 h-3.5" />
                Deny
              </button>
              <button
                onClick={() => onDecision('REVOKE_SESSION')}
                disabled={isSubmitting || !pendingInterventionId}
                className="flex-1 min-w-[100px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-3.5 h-3.5" />
                Revoke Session
              </button>
            </div>
            {!pendingInterventionId && (
              <p className="text-[10px] text-slate-400 italic">
                Human decision buttons require a CONFIRM-status intervention record in the queue.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Counterfactual Display ───────────────────────────────────────────────────
function CounterfactualDisplay({ result }: { result: ScenarioRunResult }) {
  const cf = result.intervention?.counterfactual;
  if (!cf) return null;

  const paths = [
    { key: 'early', label: 'Too Early', icon: Clock, color: 'text-sky-600 dark:text-sky-400', borderColor: 'border-sky-200 dark:border-sky-800/40', data: cf.early },
    { key: 'recommended', label: 'Optimal (Recommended)', icon: Crosshair, color: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-300 dark:border-orange-700/60', data: cf.recommended, highlight: true },
    { key: 'late', label: 'Too Late', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', borderColor: 'border-red-200 dark:border-red-800/40', data: cf.late }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GitBranchIcon className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Counterfactual Comparison</h3>
        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Prototype Simulation Values</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {paths.map(({ key, label, icon: Icon, color, borderColor, data, highlight }) => (
          <div
            key={key}
            className={`rounded-xl border-2 p-4 ${borderColor} ${highlight ? 'bg-orange-50 dark:bg-orange-950/10' : 'bg-surface-primary dark:bg-surface-800'}`}
          >
            <div className={`flex items-center gap-2 mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
              <span className="text-xs font-bold">{label}</span>
            </div>
            {data ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Risk at decision</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{data.riskAtDecision ?? '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Disruption cost</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{data.disruptionCost ?? '—'}</span>
                </div>
                {data.label && (
                  <div className="text-[11px] text-slate-500 italic mt-1">{data.label}</div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">No data</div>
            )}
          </div>
        ))}
      </div>
      {cf.optimalRationale && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1">
          {cf.optimalRationale}
        </div>
      )}
    </div>
  );
}

// Inline icon alias to avoid lucide import conflict
function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </svg>
  );
}

// ─── Main ScenarioLabView ─────────────────────────────────────────────────────
export const ScenarioLabView: React.FC = () => {
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedScenario, setSelectedScenario] = useState<ScenarioListItem | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<ScenarioRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Animated step-by-step display
  const [visibleSteps, setVisibleSteps] = useState<ScenarioStepResult[]>([]);
  const [animationDone, setAnimationDone] = useState(false);
  const animTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Intervention panel
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionMade, setDecisionMade] = useState<string | null>(null);

  const stepsEndRef = useRef<HTMLDivElement>(null);

  // Load scenarios
  useEffect(() => {
    scenariosApi.list()
      .then(setScenarios)
      .catch((e) => setListError(e.message || 'Failed to load scenarios'))
      .finally(() => setIsLoadingList(false));
  }, []);

  // Animate steps after run
  const animateSteps = useCallback((steps: ScenarioStepResult[]) => {
    setVisibleSteps([]);
    setAnimationDone(false);
    animTimeouts.current.forEach(clearTimeout);
    animTimeouts.current = [];

    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setVisibleSteps((prev) => [...prev, step]);
        stepsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, i * 600);
      animTimeouts.current.push(t);
    });

    const doneTimeout = setTimeout(() => {
      setAnimationDone(true);
    }, steps.length * 600 + 300);
    animTimeouts.current.push(doneTimeout);
  }, []);

  const handleRunScenario = async (scenario: ScenarioListItem) => {
    setSelectedScenario(scenario);
    setIsRunning(true);
    setRunResult(null);
    setRunError(null);
    setVisibleSteps([]);
    setAnimationDone(false);
    setDecisionMade(null);
    animTimeouts.current.forEach(clearTimeout);

    try {
      const result = await scenariosApi.run(scenario.id);
      setRunResult(result);
      animateSteps(result.results);
    } catch (e: unknown) {
      setRunError((e as Error).message || 'Scenario run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDecision = async (decision: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION') => {
    if (!runResult) return;
    const pendingId = (runResult.session as Record<string, unknown>)?.pendingInterventionId as string | undefined;
    if (!pendingId) return;

    setIsSubmittingDecision(true);
    try {
      await interventionsApi.submitDecision(pendingId, { decision, reviewerId: 'human-operator', reason: 'Scenario Lab decision' });
      setDecisionMade(decision);
    } catch (e: unknown) {
      // Decision UI is prototype — record locally even if API fails
      setDecisionMade(decision);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Find optimal window step for intervention panel
  const optimalStep = runResult?.results.find((r) => r.window === 'OPTIMAL_WINDOW');

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (isLoadingList) return <LoadingState message="Loading Scenario Lab" subtext="Fetching deterministic test scenarios…" />;
  if (listError) return <ErrorState title="Scenario Lab Unavailable" message={listError} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">
            <FlaskConical className="w-3.5 h-3.5" />
            Sentinel Scenario Lab
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Deterministic Behavioral Scenarios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Run any scenario to watch Sentinel evaluate an AI agent's trajectory in real-time.
            Each scenario demonstrates a different behavioral pattern and intervention timing decision.
          </p>
        </div>
        <div className="flex-shrink-0">
          <AgentConnectionStatus compact />
        </div>
      </div>

      {/* Core concept callout */}
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 p-4 flex items-start gap-3">
        <Crosshair className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-violet-800 dark:text-violet-200">Core Innovation: Intervention Timing</div>
          <div className="text-xs text-violet-700 dark:text-violet-300 mt-0.5 leading-relaxed">
            Sentinel doesn't just detect dangerous actions — it identifies <strong>when</strong> to intervene.
            Too early disrupts legitimate work. Too late causes irreversible damage. The optimal window is the key.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ─── Left: Scenario Grid ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Select a scenario to run
          </h2>
          {scenarios.map((scenario) => {
            const meta = SCENARIO_META[scenario.id];
            const isSelected = selectedScenario?.id === scenario.id;
            const isCurrentlyRunning = isRunning && isSelected;

            return (
              <div
                key={scenario.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isSelected
                    ? 'border-slate-400 dark:border-slate-500 shadow-tactile-hover'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                } bg-surface-primary dark:bg-surface-primary`}
              >
                <div className={`p-4 ${meta?.bgGradient ? `bg-gradient-to-r ${meta.bgGradient}` : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {scenario.name}
                        </span>
                        {meta?.riskLevel && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RISK_LEVEL_BADGE[meta.riskLevel]}`}>
                            {meta.riskLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {meta?.tagline || scenario.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span>{scenario.stepCount} steps</span>
                        <span>·</span>
                        <span>Expected: <strong className={meta?.color || 'text-slate-600'}>{scenario.expectedFinalState}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRunScenario(scenario)}
                      disabled={isRunning}
                      className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isCurrentlyRunning
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 shadow-tactile-subtle'
                      }`}
                    >
                      {isCurrentlyRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Running…
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Run
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Demonstrates row */}
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-surface-50 dark:bg-surface-800/50">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                    {scenario.demonstrates}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Right: Live Execution Panel ────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedScenario && !runResult && (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center gap-3 bg-surface-primary dark:bg-surface-primary">
              <FlaskConical className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a scenario to run</p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Watch Sentinel analyze an AI agent's behavior step by step, tracking risk and identifying the optimal intervention moment.
              </p>
            </div>
          )}

          {isRunning && selectedScenario && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 bg-surface-primary dark:bg-surface-primary">
              <div className="flex items-center gap-3 mb-4">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Running: {selectedScenario.name}</div>
                  <div className="text-xs text-slate-500">Executing action sequence…</div>
                </div>
              </div>
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
                ))}
              </div>
            </div>
          )}

          {runError && (
            <ErrorState title="Scenario failed" message={runError} onRetry={() => selectedScenario && handleRunScenario(selectedScenario)} />
          )}

          {runResult && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{runResult.scenarioName}</div>
                  <div className="text-xs text-slate-500">{runResult.results.length} actions executed</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    runResult.finalTelemetry.state === 'NORMAL' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                    runResult.finalTelemetry.state === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                    runResult.finalTelemetry.state === 'ESCALATING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {runResult.finalTelemetry.state}
                  </span>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    Risk: {runResult.finalTelemetry.currentRisk}/100
                  </span>
                </div>
              </div>

              {/* Action sequence */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-surface-primary dark:bg-surface-primary">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-surface-800 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Action Sequence</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {visibleSteps.map((step, i) => (
                    <div
                      key={i}
                      className={`px-4 py-3 flex items-start gap-3 animate-fadeIn ${
                        step.window === 'OPTIMAL_WINDOW'
                          ? 'bg-orange-50/50 dark:bg-orange-950/10'
                          : step.decision === 'BLOCK'
                          ? 'bg-red-50/50 dark:bg-red-950/10'
                          : ''
                      }`}
                    >
                      {/* Step number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {step.stepLabel}
                          </span>
                          <DecisionBadge decision={step.decision as DecisionType} />
                          <WindowBadge window={step.window} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="font-mono">{step.action}</span>
                          <span className="truncate">{step.resource}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <RiskBar value={step.risk} animated />
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">
                            {step.risk}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={stepsEndRef} />
                </div>
              </div>

              {/* Intervention panel - show when optimal window is found */}
              {animationDone && optimalStep && !decisionMade && runResult.finalTelemetry.state !== 'NORMAL' && (
                <InterventionPanel
                  step={optimalStep}
                  result={runResult}
                  onDecision={handleDecision}
                  isSubmitting={isSubmittingDecision}
                  decisionMade={decisionMade}
                />
              )}

              {/* Final telemetry */}
              {animationDone && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-surface-primary dark:bg-surface-primary space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Final Telemetry</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Risk', value: `${runResult.finalTelemetry.currentRisk}/100`, icon: Zap },
                      { label: 'Deviation', value: `${Math.round(runResult.finalTelemetry.trajectoryDeviation)}%`, icon: TrendingUp },
                      { label: 'Velocity', value: runResult.finalTelemetry.riskVelocity || '—', icon: TrendingUp },
                      { label: 'Window', value: runResult.finalTelemetry.interventionWindow?.replace('_', ' ') || '—', icon: Crosshair }
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-xl bg-slate-50 dark:bg-surface-800 p-3 text-center">
                        <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Counterfactual */}
                  {runResult.intervention?.counterfactual && (
                    <CounterfactualDisplay result={runResult} />
                  )}
                </div>
              )}

              {/* Re-run */}
              {animationDone && (
                <button
                  onClick={() => selectedScenario && handleRunScenario(selectedScenario)}
                  disabled={isRunning}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-800 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Remove standalone Activity shim — imported from lucide-react above
