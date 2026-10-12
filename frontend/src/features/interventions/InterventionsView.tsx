import React, { useState, useEffect, useCallback } from 'react';
import { useMode } from '../../hooks/useMode';
import { interventionsApi } from '../../api/interventions.api';
import { sessionsApi } from '../../api/sessions.api';
import {
  PendingInterventionRecord,
  HumanDecisionAction,
  Session,
  SessionInterventionResponse
} from '@sentinel/shared';
import { InterventionTimeline } from './InterventionTimeline';
import { CounterfactualComparison } from './CounterfactualComparison';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  ShieldCheck,
  Ban
} from 'lucide-react';

export const InterventionsView: React.FC = () => {
  const { isSimple } = useMode();

  const [interventions, setInterventions] = useState<PendingInterventionRecord[]>([]);
  const [selectedIntervention, setSelectedIntervention] = useState<PendingInterventionRecord | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionAnalysis, setSessionAnalysis] = useState<SessionInterventionResponse | null>(null);

  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');

  // 1. Load Interventions and Sessions
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [interventionsData, sessionsData] = await Promise.all([
        statusFilter === 'PENDING'
          ? interventionsApi.listPending()
          : interventionsApi.listAll(),
        sessionsApi.list()
      ]);

      setInterventions(interventionsData);
      setSessions(sessionsData);

      // Preserve or set selected intervention
      if (interventionsData.length > 0) {
        if (!selectedIntervention || !interventionsData.some((i) => i.id === selectedIntervention.id)) {
          setSelectedIntervention(interventionsData[0]);
        } else {
          // Refresh selected intervention with latest status
          const refreshed = interventionsData.find((i) => i.id === selectedIntervention.id);
          if (refreshed) setSelectedIntervention(refreshed);
        }
      } else {
        setSelectedIntervention(null);
      }

      // If no intervention selected, auto-select first active session for live inspection
      if (sessionsData.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessionsData[0].id);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load intervention queue');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, selectedIntervention, selectedSessionId]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // 2. Fetch session intervention when selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return;
    let isMounted = true;

    interventionsApi
      .getSessionIntervention(selectedSessionId)
      .then((res) => {
        if (isMounted) setSessionAnalysis(res);
      })
      .catch(() => {
        // Non-fatal if session has no actions yet
        if (isMounted) setSessionAnalysis(null);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSessionId]);

  // 3. Handle Human Decision Action
  const handleDecision = async (decision: HumanDecisionAction) => {
    if (!selectedIntervention) return;
    setIsSubmitting(true);
    setError(null);
    setActionSuccessMessage(null);

    try {
      const updated = await interventionsApi.submitDecision(selectedIntervention.id, {
        decision,
        reviewerId: 'sec-analyst-human',
        reason: reviewNote.trim() || undefined
      });

      setActionSuccessMessage(
        decision === 'ALLOW_ONCE'
          ? `Action approved for one-time execution.`
          : decision === 'DENY'
          ? `Action denied. Agent execution blocked.`
          : `Session revoked. Agent immediately terminated.`
      );
      setReviewNote('');

      // Refresh list
      const freshList =
        statusFilter === 'PENDING'
          ? await interventionsApi.listPending()
          : await interventionsApi.listAll();
      setInterventions(freshList);

      if (statusFilter === 'PENDING') {
        setSelectedIntervention(freshList.length > 0 ? freshList[0] : null);
      } else {
        setSelectedIntervention(updated);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to process decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRecord = selectedIntervention;
  const currentRisk = activeRecord?.currentRisk ?? sessionAnalysis?.analysis.currentRisk ?? 0;
  const currentWindow = activeRecord?.interventionWindow ?? sessionAnalysis?.analysis.interventionWindow ?? 'TOO_EARLY';
  const activeCounterfactual = activeRecord?.counterfactual ?? sessionAnalysis?.analysis.counterfactual;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Intervention Intelligence Engine
            </h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              PHASE 4
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic intervention window resolution, risk forecasting, counterfactual modeling, and human review orchestration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-surface-100 dark:bg-surface-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'PENDING'
                  ? 'bg-surface-primary dark:bg-surface-primary text-slate-900 dark:text-slate-100 shadow-tactile-subtle'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Pending Reviews ({interventions.filter((i) => i.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-surface-primary dark:bg-surface-primary text-slate-900 dark:text-slate-100 shadow-tactile-subtle'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Audit History
            </button>
          </div>

          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary hover:bg-surface-100 dark:hover:bg-surface-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Refresh intervention queue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <ErrorState
          title="Intervention Engine Error"
          message={error}
          onRetry={loadData}
        />
      )}

      {/* Primary Layout Grid */}
      {isLoading && interventions.length === 0 ? (
        <LoadingState message="Evaluating intervention windows and pending reviews..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Pending Queue & Selectors (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="card-tactile p-4 bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {statusFilter === 'PENDING' ? 'Pending Review Queue' : 'All Interventions'}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surface-800 text-slate-600 dark:text-slate-300">
                  {interventions.length} items
                </span>
              </div>

              {interventions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500/60" />
                  <p className="font-medium text-slate-700 dark:text-slate-300">No Pending Interventions</p>
                  <p className="text-[11px] text-slate-500">
                    All agents are operating within autonomous bounds or reviews have been resolved.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {interventions.map((item) => {
                    const isSelected = selectedIntervention?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedIntervention(item)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-tactile'
                            : 'bg-surface-50 dark:bg-surface-800/40 hover:bg-surface-100 dark:hover:bg-surface-800 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            item.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                              : item.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                          }`}>
                            {item.status}
                          </span>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
                            {item.interventionWindow}
                          </span>
                        </div>

                        <div className="mt-2 font-medium text-xs truncate">
                          {item.action} <span className={isSelected ? 'text-slate-300 dark:text-slate-600 font-normal' : 'text-slate-400 font-normal'}>on</span> {item.resource}
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className={isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500'}>
                            {item.agentName}
                          </span>
                          <span className="font-mono font-bold">
                            Risk {item.currentRisk}/100
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Session Inspector Selector */}
            <div className="card-tactile p-4 bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Live Session Inspector
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Select a session...</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.metadata?.agentName ? String(s.metadata.agentName) : s.agentId} — #{s.id.slice(0, 8)} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column: Review Details & Dual Mode UI (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* If an active intervention is selected for review */}
            {activeRecord ? (
              <div className="card-tactile p-6 bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 shadow-tactile space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase font-mono tracking-wider ${
                        activeRecord.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                          : activeRecord.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60'
                      }`}>
                        {activeRecord.status === 'PENDING' ? 'HUMAN REVIEW REQUIRED' : `REVIEW: ${activeRecord.status}`}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: #{activeRecord.id.slice(0, 8)}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">
                      Target Action: {activeRecord.action} <span className="text-slate-400 font-normal">→</span> {activeRecord.resource}
                    </h2>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Agent Identity</span>
                    <strong className="text-xs text-slate-800 dark:text-slate-200 font-semibold">
                      {activeRecord.agentName}
                    </strong>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Session #{activeRecord.sessionId.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* SIMPLE MODE VIEW */}
                {isSimple ? (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                          Sentinel needs your attention
                        </h3>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        This AI agent is moving beyond its normal task boundaries and attempting to access sensitive resources. Risk is rising quickly, but the action remains safely reversible. Sentinel identified this as the right moment to verify before potential harm occurs.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Why Sentinel Stopped This Action:
                      </h4>
                      <div className="space-y-1.5">
                        {activeRecord.reasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Simple Decision Actions */}
                    {activeRecord.status === 'PENDING' && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => handleDecision('ALLOW_ONCE')}
                          disabled={isSubmitting}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-tactile flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Allow Once</span>
                        </button>
                        <button
                          onClick={() => handleDecision('DENY')}
                          disabled={isSubmitting}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-tactile flex items-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          <span>Deny Action</span>
                        </button>
                        <button
                          onClick={() => handleDecision('REVOKE_SESSION')}
                          disabled={isSubmitting}
                          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-surface-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                        >
                          Revoke Entire Session
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* EXPERT MODE VIEW */
                  <div className="space-y-5">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">Current Risk</span>
                        <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                          {activeRecord.currentRisk}<span className="text-xs text-slate-400">/100</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">Trajectory Deviation</span>
                        <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                          {activeRecord.trajectoryDeviation}<span className="text-xs text-slate-400">/100</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">Acceleration</span>
                        <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                          {activeRecord.riskAcceleration}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">Predicted Risk</span>
                        <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                          {activeRecord.predictedRisk}<span className="text-xs text-slate-400">/100</span>
                        </div>
                      </div>
                    </div>

                    {/* Window & Forecast Details */}
                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Resolved Intervention Window:</span>
                        <strong className="font-mono text-amber-600 dark:text-amber-400">
                          {activeRecord.interventionWindow}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Sentinel Recommendation:</span>
                        <strong className="font-mono text-slate-900 dark:text-slate-100">
                          {activeRecord.recommendation}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Action Sensitivity & Reversibility:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {activeRecord.sensitivity} | {activeRecord.reversibility}
                        </span>
                      </div>
                      {activeRecord.forecast && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-500">Forecast Horizon Label:</span>
                          <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">
                            {activeRecord.forecast.horizonLabel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Detailed Reasons */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Deterministic Decision Signals:
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {activeRecord.reasons.map((r, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold">›</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Optional Reviewer Note & Actions */}
                    {activeRecord.status === 'PENDING' && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                        <input
                          type="text"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="Optional audit reason or justification..."
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => handleDecision('ALLOW_ONCE')}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-tactile flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            <span>ALLOW ONCE</span>
                          </button>
                          <button
                            onClick={() => handleDecision('DENY')}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-tactile flex items-center gap-2"
                          >
                            <Ban className="w-4 h-4" />
                            <span>DENY ACTION</span>
                          </button>
                          <button
                            onClick={() => handleDecision('REVOKE_SESSION')}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors"
                          >
                            REVOKE SESSION
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* If no pending intervention, show session telemetry status */
              <div className="card-tactile p-6 bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 text-center py-12 space-y-3">
                <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No Active Review Required
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Select an intervention from the queue or inspect a live session using the selector. To evaluate the intervention continuum under stress, run Scenario 7: "Right Moment to Intervene".
                </p>
              </div>
            )}

            {/* Embedded Intervention Timeline */}
            <InterventionTimeline
              currentRisk={currentRisk}
              interventionWindow={currentWindow}
              currentStage={sessionAnalysis?.analysis.interventionWindow || currentWindow}
            />

            {/* Embedded Counterfactual Analysis */}
            {activeCounterfactual && (
              <CounterfactualComparison counterfactual={activeCounterfactual} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
