import React, { useState, useEffect, useCallback } from 'react';
import { ActionEvent, formatDecisionExplanation } from '@sentinel/shared';
import { actionsApi } from '../../api/actions.api';
import { agentsApi } from '../../api/agents.api';
import { sessionsApi } from '../../api/sessions.api';
import { useMode } from '../../hooks/useMode';
import { DecisionBadge } from '../../components/common/DecisionBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Radio, RefreshCw, Send } from 'lucide-react';

export const LiveActionsView: React.FC = () => {
  const { isSimple } = useMode();
  const [actions, setActions] = useState<ActionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Action Dispatch Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [actionType, setActionType] = useState('READ');
  const [resource, setResource] = useState('project-documents');
  const [scope, setScope] = useState('project.read');
  const [sensitivity, setSensitivity] = useState('low');
  const [reversibility, setReversibility] = useState('reversible');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await actionsApi.list();
      setActions(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load action events');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [agentsData, sessionsData] = await Promise.all([
        agentsApi.list(),
        sessionsApi.list()
      ]);
      setAgents(agentsData);
      setSessions(sessionsData.filter((s) => s.status === 'ACTIVE'));
      if (agentsData.length > 0 && !selectedAgentId) setSelectedAgentId(agentsData[0].id);
      const active = sessionsData.filter((s) => s.status === 'ACTIVE');
      if (active.length > 0 && !selectedSessionId) setSelectedSessionId(active[0].id);
    } catch {
      // Ignored for modal pre-fetching
    }
  };

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleOpenSendModal = async () => {
    await loadPrerequisites();
    setShowSendModal(true);
  };

  const handleSendAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !selectedSessionId) {
      setSendError('Both an active agent and session are required.');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await actionsApi.ingest({
        agentId: selectedAgentId,
        sessionId: selectedSessionId,
        action: actionType as any,
        resource,
        resourceType: 'resource',
        scope,
        sensitivity: sensitivity as any,
        reversibility: reversibility as any
      });
      setShowSendModal(false);
      await loadActions();
    } catch (err: unknown) {
      setSendError((err as Error).message || 'Failed to dispatch action');
    } finally {
      setSending(false);
    }
  };

  // Helper to determine mock or stored decision based on authorization/sensitivity
  const inferDecision = (event: ActionEvent) => {
    if (event.action === 'PRIVILEGE_ESCALATION' && event.authorization !== 'AUTHORIZED') return 'BLOCK';
    if (event.action === 'DELETE' && event.authorization !== 'AUTHORIZED') return 'BLOCK';
    if (event.authorization !== 'AUTHORIZED') {
      return event.reversibility === 'REVERSIBLE' ? 'CONFIRM' : 'BLOCK';
    }
    if (event.sensitivity === 'HIGH' || event.sensitivity === 'CRITICAL') return 'WARN';
    if (event.sensitivity === 'MEDIUM') return 'MONITOR';
    return 'ALLOW';
  };

  if (loading && actions.length === 0) {
    return <LoadingState message="Connecting to action ingestion stream..." />;
  }

  if (error && actions.length === 0) {
    return (
      <ErrorState
        title="Failed to Load Live Actions"
        message={error}
        onRetry={loadActions}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-pulse" />
            Live Ingested Actions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isSimple
              ? 'Real-time record of what AI agents are attempting and Sentinel decisions.'
              : 'Runtime action interception stream, scope verification, and policy decisions.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadActions}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-surface-100 dark:hover:bg-surface-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh action stream"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenSendModal}
            className="px-4 py-2 rounded-pill bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-tactile-subtle transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Send Test Action</span>
          </button>
        </div>
      </div>

      {/* Stream List */}
      {actions.length === 0 ? (
        <EmptyState
          icon={<Radio className="w-6 h-6 text-slate-400" />}
          title="No Actions Ingested Yet"
          description="Send an action from an external AI agent or use the 'Send Test Action' button to test Sentinel's decision engine."
          action={{
            label: 'Send Test Action',
            onClick: handleOpenSendModal
          }}
        />
      ) : (
        <div className="card-tactile divide-y divide-slate-100 dark:divide-slate-800/80">
          {actions.map((act) => {
            const decision = inferDecision(act);
            return (
              <div key={act.eventId} className="p-4 sm:p-5 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <DecisionBadge decision={decision as any} />
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {act.action}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {act.resource}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                          act.authorization === 'AUTHORIZED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {act.authorization}
                      </span>
                    </div>

                    {/* Mode-Aware Explanation */}
                    <p className="text-xs text-slate-700 dark:text-slate-300 pt-1">
                      {formatDecisionExplanation(decision as any, [
                        `Scope: ${act.scope}`,
                        `Sensitivity: ${act.sensitivity}`,
                        `Reversibility: ${act.reversibility}`
                      ], isSimple)}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono pt-1">
                      <span>Agent: {act.agentId}</span>
                      <span>•</span>
                      <span>Session: {act.sessionId}</span>
                      <span>•</span>
                      <span>{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send Test Action Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="card-tactile w-full max-w-lg p-6 bg-surface-primary dark:bg-surface-primary shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Dispatch Action to Sentinel API
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Simulate an external AI agent tool invocation to verify authorization and policy decision.
            </p>

            <form onSubmit={handleSendAction} className="mt-4 space-y-3.5">
              {sendError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800/40">
                  {sendError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agent *
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    required
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Active Session *
                  </label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    required
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Action Type *
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="READ">READ</option>
                    <option value="WRITE">WRITE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="EXECUTE">EXECUTE</option>
                    <option value="EXPORT">EXPORT</option>
                    <option value="DOWNLOAD">DOWNLOAD</option>
                    <option value="PRIVILEGE_ESCALATION">PRIVILEGE_ESCALATION</option>
                    <option value="EXTERNAL_REQUEST">EXTERNAL_REQUEST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scope Requested *
                  </label>
                  <input
                    type="text"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Resource URI *
                </label>
                <input
                  type="text"
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sensitivity
                  </label>
                  <select
                    value={sensitivity}
                    onChange={(e) => setSensitivity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="critical">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reversibility
                  </label>
                  <select
                    value={reversibility}
                    onChange={(e) => setReversibility(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="reversible">REVERSIBLE</option>
                    <option value="partially_reversible">PARTIALLY_REVERSIBLE</option>
                    <option value="irreversible">IRREVERSIBLE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 text-xs rounded-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 text-xs rounded-pill bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-tactile-subtle disabled:opacity-50"
                >
                  {sending ? 'Dispatching...' : 'Dispatch Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
