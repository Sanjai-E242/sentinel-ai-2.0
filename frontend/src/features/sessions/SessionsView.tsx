import React, { useState, useEffect, useCallback } from 'react';
import { Session, Agent, formatTrajectoryDeviation } from '@sentinel/shared';
import { sessionsApi } from '../../api/sessions.api';
import { agentsApi } from '../../api/agents.api';
import { useMode } from '../../hooks/useMode';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Activity, Plus, RefreshCw, StopCircle } from 'lucide-react';

export const SessionsView: React.FC = () => {
  const { isSimple } = useMode();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start session modal state
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [starting, setStarting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, agentsData] = await Promise.all([
        sessionsApi.list(),
        agentsApi.list()
      ]);
      setSessions(sessionsData);
      setAgents(agentsData);
      if (agentsData.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agentsData[0].id);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load sessions data');
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setModalError('Please select an agent');
      return;
    }
    setStarting(true);
    setModalError(null);
    try {
      await sessionsApi.create({ agentId: selectedAgentId });
      setShowStartModal(false);
      await loadData();
    } catch (err: unknown) {
      setModalError((err as Error).message || 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await sessionsApi.end(sessionId);
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to end session');
    }
  };

  if (loading && sessions.length === 0) {
    return <LoadingState message="Loading agent runtime sessions..." />;
  }

  if (error && sessions.length === 0) {
    return (
      <ErrorState
        title="Failed to Load Sessions"
        message={error}
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Agent Runtime Sessions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isSimple
              ? 'Active and completed work sessions for your AI agents.'
              : 'Runtime session states, trajectory baseline drift, and live risk metrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-surface-100 dark:hover:bg-surface-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh sessions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            disabled={agents.length === 0}
            className="px-4 py-2 rounded-pill bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-tactile-subtle transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Start Session</span>
          </button>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-6 h-6 text-slate-400" />}
          title="No Sessions Active"
          description="Start an agent session or dispatch actions via the REST API to view live session state."
          action={
            agents.length > 0
              ? {
                  label: 'Start New Session',
                  onClick: () => setShowStartModal(true)
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((session) => {
            const agent = agents.find((a) => a.id === session.agentId);
            const isCompleted = session.status === 'COMPLETED';

            return (
              <div key={session.id} className="card-tactile p-5 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {session.id}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          session.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-surface-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {session.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        Agent: <strong className="text-slate-700 dark:text-slate-300">{agent?.name || session.agentId}</strong>
                      </span>
                    </div>

                    {/* Mode-Aware Trajectory & Risk Information */}
                    <div className="pt-1 text-xs">
                      <p className="text-slate-700 dark:text-slate-300">
                        {formatTrajectoryDeviation(session.trajectoryDeviation, isSimple)}
                      </p>
                      {!isSimple && (
                        <div className="mt-1 flex items-center gap-4 text-[11px] font-mono text-slate-500">
                          <span>Risk Score: {session.currentRisk}/100</span>
                          <span>•</span>
                          <span>Actions Ingested: {session.actionCount || 0}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Started: {new Date(session.startedAt).toLocaleString()}
                      {session.endedAt && ` | Ended: ${new Date(session.endedAt).toLocaleString()}`}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => handleEndSession(session.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40 dark:border-rose-900 transition-colors"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>End Session</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Start Session Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="card-tactile w-full max-w-md p-6 bg-surface-primary dark:bg-surface-primary shadow-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Initialize Agent Session
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select a registered agent to begin tracking runtime telemetry.
            </p>

            <form onSubmit={handleStartSession} className="mt-4 space-y-4">
              {modalError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800/40">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Agent *
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 text-xs rounded-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={starting}
                  className="px-4 py-2 text-xs rounded-pill bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-tactile-subtle disabled:opacity-50"
                >
                  {starting ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
