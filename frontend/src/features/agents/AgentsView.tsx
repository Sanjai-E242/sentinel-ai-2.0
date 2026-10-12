import React, { useState, useEffect, useCallback } from 'react';
import { Agent, CreateAgentInput } from '@sentinel/shared';
import { agentsApi } from '../../api/agents.api';
import { useMode } from '../../hooks/useMode';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Bot, Plus, Shield, RefreshCw } from 'lucide-react';

export const AgentsView: React.FC = () => {
  const { isSimple } = useMode();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('external-ai-agent');
  const [scopesStr, setScopesStr] = useState('project.read, project.write');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentsApi.list();
      setAgents(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Agent name is required');
      return;
    }
    const scopes = scopesStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setSubmitting(true);
    setFormError(null);
    try {
      const input: CreateAgentInput = {
        name: name.trim(),
        type: type.trim(),
        scopes
      };
      await agentsApi.create(input);
      setName('');
      setShowRegisterModal(false);
      await loadAgents();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to register agent');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && agents.length === 0) {
    return <LoadingState message="Loading registered AI agents..." />;
  }

  if (error && agents.length === 0) {
    return (
      <ErrorState
        title="Failed to Load Agents"
        message={error}
        onRetry={loadAgents}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Registered AI Agents
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isSimple
              ? 'External AI agents registered with Sentinel control layer.'
              : 'Agent identity registry, granted permission scopes, and runtime statuses.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAgents}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-surface-100 dark:hover:bg-surface-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh agents"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-pill bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-tactile-subtle transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register Agent</span>
          </button>
        </div>
      </div>

      {/* Agents List / Table */}
      {agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="w-6 h-6 text-slate-400" />}
          title="No Agents Registered"
          description="Register your first external AI agent to begin runtime behavioral monitoring."
          action={{
            label: 'Register Agent',
            onClick: () => setShowRegisterModal(true)
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="card-tactile p-5 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {agent.name}
                    </h2>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        agent.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                          : agent.status === 'SUSPENDED'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                      }`}
                    >
                      {agent.status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {agent.id}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span>Type: <strong className="text-slate-700 dark:text-slate-300 font-medium">{agent.type}</strong></span>
                    <span>•</span>
                    <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Granted Scopes */}
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      {isSimple ? 'Allowed Permissions' : 'Authorized Scopes'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.scopes && agent.scopes.length > 0 ? (
                        agent.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                          >
                            <Shield className="w-3 h-3 text-emerald-500" />
                            {scope}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No scopes granted</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Agent Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="card-tactile w-full max-w-md p-6 bg-surface-primary dark:bg-surface-primary shadow-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Register External AI Agent
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add a new agent identity to Sentinel's runtime control layer.
            </p>

            <form onSubmit={handleRegister} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800/40">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Research Agent"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Agent Type
                </label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="external-ai-agent"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Authorized Scopes (comma-separated)
                </label>
                <input
                  type="text"
                  value={scopesStr}
                  onChange={(e) => setScopesStr(e.target.value)}
                  placeholder="project.read, project.write"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-xs rounded-pill border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs rounded-pill bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-tactile-subtle disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
