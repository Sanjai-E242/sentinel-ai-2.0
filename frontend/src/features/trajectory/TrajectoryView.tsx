import React, { useState, useEffect, useCallback } from 'react';
import { useMode } from '../../hooks/useMode';
import { sessionsApi } from '../../api/sessions.api';
import { trajectoryApi, ScenarioListItem } from '../../api/trajectory.api';
import { interventionsApi } from '../../api/interventions.api';
import {
  Session,
  SessionTrajectoryResponse,
  SessionInterventionResponse,
  TrajectoryState,
  RiskVelocity,
  RiskAcceleration
} from '@sentinel/shared';
import { RiskTrajectoryGraph } from './RiskTrajectoryGraph';
import {
  GitBranch,
  RefreshCw,
  Play,
  Activity,
  Zap,
  TrendingUp,
  Info,
  Sparkles
} from 'lucide-react';

export const TrajectoryView: React.FC = () => {
  const { isSimple } = useMode();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [trajectory, setTrajectory] = useState<SessionTrajectoryResponse | null>(null);
  const [interventionData, setInterventionData] = useState<SessionInterventionResponse | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [isRunningScenario, setIsRunningScenario] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScenarioDrawerOpen, setIsScenarioDrawerOpen] = useState(false);

  // 1. Load Sessions & Scenarios
  const loadInitialData = useCallback(async () => {
    try {
      const [sessionsData, scenarioData] = await Promise.all([
        sessionsApi.list(),
        trajectoryApi.listScenarios()
      ]);
      setSessions(sessionsData);
      setScenarios(scenarioData);

      if (sessionsData.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessionsData[0].id);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load trajectory data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Load Selected Session Trajectory & Intervention Analysis
  const loadTrajectory = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [trajData, intervData] = await Promise.all([
        trajectoryApi.getTrajectory(sessionId),
        interventionsApi.getSessionIntervention(sessionId).catch(() => null)
      ]);
      setTrajectory(trajData);
      setInterventionData(intervData);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load session trajectory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadTrajectory(selectedSessionId);
    }
  }, [selectedSessionId, loadTrajectory]);

  // 3. Run Deterministic Scenario
  const handleRunScenario = async (scenarioId: string) => {
    setIsRunningScenario(scenarioId);
    setError(null);
    try {
      const result = await trajectoryApi.runScenario(scenarioId);
      // Refresh session list and select the new scenario session
      const updatedSessions = await sessionsApi.list();
      setSessions(updatedSessions);
      setSelectedSessionId(result.sessionId);
      await loadTrajectory(result.sessionId);
      setIsScenarioDrawerOpen(false);
    } catch (err: unknown) {
      setError(`Failed to execute scenario ${scenarioId}: ${(err as Error).message}`);
    } finally {
      setIsRunningScenario(null);
    }
  };

  const getStateBadge = (state: TrajectoryState) => {
    switch (state) {
      case 'NORMAL':
        return {
          label: 'NORMAL TRAJECTORY',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
          dotClass: 'bg-emerald-500'
        };
      case 'WATCH':
        return {
          label: 'WATCH REQUIRED',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
          dotClass: 'bg-amber-500'
        };
      case 'DRIFTING':
        return {
          label: 'DRIFTING',
          badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40',
          dotClass: 'bg-orange-500'
        };
      case 'ESCALATING':
        return {
          label: 'ESCALATING RISK',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
          dotClass: 'bg-rose-500'
        };
      case 'CRITICAL':
        return {
          label: 'CRITICAL BOUNDARY SPIKE',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
          dotClass: 'bg-rose-600 animate-pulse'
        };
      default:
        return {
          label: 'UNKNOWN',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
          dotClass: 'bg-slate-400'
        };
    }
  };

  const getVelocityBadge = (velocity: RiskVelocity) => {
    switch (velocity) {
      case 'EXTREME':
        return 'text-rose-600 dark:text-rose-400 font-bold';
      case 'HIGH':
        return 'text-orange-600 dark:text-orange-400 font-semibold';
      case 'MEDIUM':
        return 'text-amber-600 dark:text-amber-400 font-medium';
      case 'LOW':
      default:
        return 'text-emerald-600 dark:text-emerald-400 font-medium';
    }
  };

  const getAccelerationBadge = (accel: RiskAcceleration) => {
    switch (accel) {
      case 'SURGING':
        return 'text-rose-600 dark:text-rose-400 font-bold';
      case 'RISING':
        return 'text-amber-600 dark:text-amber-400 font-semibold';
      case 'FALLING':
        return 'text-emerald-600 dark:text-emerald-400 font-medium';
      case 'STABLE':
      default:
        return 'text-slate-500 dark:text-slate-400 font-medium';
    }
  };

  const stateInfo = trajectory ? getStateBadge(trajectory.state) : null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-tactile-subtle">
              <GitBranch className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Trajectory Intelligence & Cumulative Risk
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Phase 3 Live
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detecting behavioral drift across action sequences before security thresholds are breached
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Session Selector */}
          <div className="flex items-center gap-2 bg-surface-primary dark:bg-surface-primary border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <span className="text-slate-400 font-medium">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent font-mono text-slate-700 dark:text-slate-200 outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id} className="dark:bg-slate-800 font-mono">
                  {s.id.slice(0, 16)}... ({s.status})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => selectedSessionId && loadTrajectory(selectedSessionId)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-primary dark:bg-surface-primary border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-800 shadow-sm transition-all"
            title="Refresh trajectory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Test Scenarios Drawer Button */}
          <button
            onClick={() => setIsScenarioDrawerOpen(!isScenarioDrawerOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-tactile-subtle transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>Test Scenarios ({scenarios.length})</span>
          </button>
        </div>
      </div>

      {/* Scenario Runner Drawer / Selector Modal */}
      {isScenarioDrawerOpen && (
        <div className="p-5 bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 shadow-tactile-prominent space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                Deterministic Trajectory Scenarios
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Run verified multi-step behavioral sequences to observe trajectory tracking and risk accumulation
              </p>
            </div>
            <button
              onClick={() => setIsScenarioDrawerOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 bg-surface-50/50 dark:bg-surface-800/30 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {sc.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                      {sc.stepCount} steps
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                    {sc.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                    ➔ Expected: {sc.expectedFinalState}
                  </span>
                  <button
                    onClick={() => handleRunScenario(sc.id)}
                    disabled={isRunningScenario !== null}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-emerald-600 dark:hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {isRunningScenario === sc.id ? 'Running...' : 'Run Scenario'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trajectory Main Content */}
      {isLoading && !trajectory ? (
        <div className="p-12 text-center bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">Evaluating trajectory intelligence metrics...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/30">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={() => selectedSessionId && loadTrajectory(selectedSessionId)}
            className="mt-3 px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : trajectory && stateInfo ? (
        <div className="space-y-6">
          {/* Top Banner: State, Velocity, Acceleration, Risk */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Trajectory State Card */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Trajectory State
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${stateInfo.dotClass}`} />
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {trajectory.state}
                </span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {trajectory.currentRisk <= 30 ? 'Within baseline tolerance' : 'Behavioral drift detected'}
              </span>
            </div>

            {/* Cumulative Risk Score */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cumulative Risk
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {trajectory.currentRisk}
                </span>
                <span className="text-xs text-slate-400 font-mono">/100</span>
              </div>
              <div className="mt-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${trajectory.currentRisk}%` }}
                />
              </div>
            </div>

            {/* Trajectory Deviation */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Trajectory Deviation
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {trajectory.trajectoryDeviation}
                </span>
                <span className="text-xs text-slate-400 font-mono">/100</span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {trajectory.trajectoryDeviation > 50 ? 'Significant drift' : 'Within normal variance'}
              </span>
            </div>

            {/* Risk Velocity */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Risk Velocity
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className={`text-base font-bold font-mono ${getVelocityBadge(trajectory.riskVelocity)}`}>
                  {trajectory.riskVelocity}
                </span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Rate of risk escalation
              </span>
            </div>

            {/* Risk Acceleration */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Risk Acceleration
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-sky-500" />
                <span className={`text-base font-bold font-mono ${getAccelerationBadge(trajectory.riskAcceleration)}`}>
                  {trajectory.riskAcceleration}
                </span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Second derivative of risk
              </span>
            </div>
          </div>

          {/* Simple Mode vs Expert Mode Adaptive Explanation */}
          {isSimple ? (
            /* SIMPLE MODE VIEW */
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Behavioral Health Summary
                </h3>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                {trajectory.explanation.simpleText}
              </p>

              {trajectory.explanation.plainReasons && trajectory.explanation.plainReasons.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Why Sentinel is observing this agent:
                  </span>
                  <ul className="mt-1.5 space-y-1">
                    {trajectory.explanation.plainReasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span className="capitalize">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* EXPERT MODE VIEW: Explainable Components & Feature Breakdowns */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Component Contribution Breakdown */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Trajectory Deviation Components (Additive)
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    Total: {trajectory.trajectoryDeviation} pts
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {(Object.entries(trajectory.components) as [string, number][]).map(([compName, score]) => (
                    <div key={compName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-600 dark:text-slate-400 capitalize">
                          {compName.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{score} pts</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (score / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 10 Normalized Raw Features */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    10 Explainable Trajectory Features (0–100 Normalized)
                  </h3>
                  <span className="text-xs font-mono text-slate-400">Raw Signals</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                  {(Object.entries(trajectory.features) as [string, number][]).map(([featName, val]) => (
                    <div
                      key={featName}
                      className="p-2 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize truncate">
                        {featName.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div className="text-sm font-bold font-mono mt-0.5 text-slate-800 dark:text-slate-200">
                        {val}
                        <span className="text-[10px] text-slate-400 font-normal">/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interactive SVG Risk Timeline Graph */}
          <RiskTrajectoryGraph
            actions={trajectory.actions}
            forecast={interventionData?.analysis.forecast}
            interventionWindow={interventionData?.analysis.interventionWindow}
          />

          {/* Sequential Action Replay Feed */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary shadow-tactile-subtle space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Chronological Action History & Replay Feed
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Step-by-step risk progression and policy decisions
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {trajectory.actions.length} action{trajectory.actions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {trajectory.actions.map((act, index) => (
                <div key={act.eventId || index} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-slate-600 dark:text-slate-400 text-[10px]">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {act.action}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                          {act.resource}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-slate-500">Risk: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{act.risk}/100</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500">Dev: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{act.trajectoryDeviation}/100</strong>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        act.decision === 'ALLOW'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : act.decision === 'BLOCK'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {act.decision}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
