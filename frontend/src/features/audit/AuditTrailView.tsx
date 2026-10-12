import React, { useState, useEffect, useCallback } from 'react';
import { AuditLogEntry, AuditEventType } from '@sentinel/shared';
import { auditApi } from '../../api/audit.api';
import {
  FileText,
  RefreshCw,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  UserCheck,
  Lock,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filter = selectedEventType !== 'ALL' ? { eventType: selectedEventType } : undefined;
      const data = await auditApi.fetchLogs(filter);
      setLogs(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventType]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getEventBadge = (eventType: AuditEventType) => {
    switch (eventType) {
      case 'AGENT_CREATED':
      case 'AGENT_SUSPENDED':
      case 'AGENT_REVOKED':
        return {
          icon: UserCheck,
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40'
        };
      case 'SESSION_STARTED':
      case 'SESSION_COMPLETED':
        return {
          icon: Play,
          color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40'
        };
      case 'ACTION_ALLOWED':
        return {
          icon: ShieldCheck,
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
        };
      case 'ACTION_MONITORED':
        return {
          icon: ShieldAlert,
          color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40'
        };
      case 'ACTION_WARNED':
      case 'ACTION_CONFIRM_REQUIRED':
        return {
          icon: AlertTriangle,
          color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
        };
      case 'ACTION_BLOCKED':
      case 'RATE_LIMIT_TRIGGERED':
      case 'REQUEST_THROTTLED':
        return {
          icon: Lock,
          color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
        };
      case 'BURST_DETECTED':
      case 'DUPLICATE_DETECTED':
        return {
          icon: AlertTriangle,
          color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
        };
      case 'ACTION_INGESTED':
      default:
        return {
          icon: FileText,
          color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
        };
    }
  };

  const EVENT_OPTIONS = [
    { value: 'ALL', label: 'All Security Events' },
    { value: 'AGENT_CREATED', label: 'Agent Created' },
    { value: 'AGENT_SUSPENDED', label: 'Agent Suspended' },
    { value: 'AGENT_REVOKED', label: 'Agent Revoked' },
    { value: 'SESSION_STARTED', label: 'Session Started' },
    { value: 'SESSION_COMPLETED', label: 'Session Completed' },
    { value: 'ACTION_INGESTED', label: 'Action Ingested' },
    { value: 'ACTION_ALLOWED', label: 'Action Allowed' },
    { value: 'ACTION_MONITORED', label: 'Action Monitored' },
    { value: 'ACTION_WARNED', label: 'Action Warned' },
    { value: 'ACTION_CONFIRM_REQUIRED', label: 'Action Confirm Required' },
    { value: 'ACTION_BLOCKED', label: 'Action Blocked' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <FileText className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Immutable Audit Trail
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Append-only ledger of security decisions, policy enforcement, and agent lifecycle
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-primary dark:bg-surface-primary border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="text-xs bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              {EVENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="dark:bg-slate-800">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-primary dark:bg-surface-primary border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-800 shadow-sm transition-all disabled:opacity-50"
            title="Refresh audit records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading && logs.length === 0 ? (
        <div className="p-12 text-center bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">Loading audit records from persistent store...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/30">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={loadLogs}
            className="mt-3 px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800">
          <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Audit Records Found</p>
          <p className="text-xs text-slate-500 mt-1">
            Registered agents, sessions, and ingested actions will automatically record immutable entries here.
          </p>
        </div>
      ) : (
        <div className="bg-surface-primary dark:bg-surface-primary rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-tactile-subtle">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((entry) => {
              const badge = getEventBadge(entry.eventType);
              const BadgeIcon = badge.icon;
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-semibold border ${badge.color}`}
                      >
                        <BadgeIcon className="w-3 h-3" />
                        <span>{entry.eventType}</span>
                      </div>

                      <div className="text-xs">
                        <span className="font-mono text-slate-500 dark:text-slate-400 mr-2">
                          [{entry.entityType}]
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {entry.entityId}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {entry.sessionId && (
                        <span className="hidden md:inline text-[11px] opacity-75">
                          sess: {entry.sessionId.slice(0, 16)}...
                        </span>
                      )}
                      <span className="text-[11px]">
                        actor: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{entry.actor}</strong>
                      </span>
                      <span className="text-[11px] opacity-75">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded JSON Payload */}
                  {isExpanded && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Audit Payload & Cryptographic Metadata
                      </div>
                      <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                        {JSON.stringify(
                          {
                            auditId: entry.id,
                            eventType: entry.eventType,
                            entityType: entry.entityType,
                            entityId: entry.entityId,
                            sessionId: entry.sessionId,
                            actor: entry.actor,
                            timestamp: entry.createdAt,
                            payload: entry.payload
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
