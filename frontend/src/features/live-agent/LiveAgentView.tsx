import React, { useState, useEffect, useRef } from 'react';
import { useMode } from '../../hooks/useMode';
import { AgentConnectionStatus } from '../../components/common/AgentConnectionStatus';
import {
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Sliders,
  Cpu,
  Clock,
  ArrowRight,
  Ban,
  Activity,
  TrendingUp,
  Zap,
  ShieldAlert
} from 'lucide-react';
import { SpamSignals } from '@sentinel/shared';
import { apiClient } from '../../api/client';

interface ProposedAction {
  action: string;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: string;
  reversibility: string;
  reason: string;
}

interface ControlledStepResult {
  stepNumber: number;
  timestamp: string;
  proposedAction: ProposedAction;
  decision: 'ALLOW' | 'MONITOR' | 'WARN' | 'CONFIRM' | 'BLOCK';
  decisionReasons: string[];
  risk: number;
  previousRisk?: number;
  riskDelta?: number;
  trajectoryDeviation: number;
  riskAcceleration: string;
  predictedNextRisk: number;
  interventionWindow: string;
  interventionUrgency: string;
  humanReviewRequired: boolean;
  humanDecision?: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION';
  pendingInterventionId?: string;
  simpleNarration: {
    what: string;
    why: string;
    risk: string;
    actionRecommendation: string;
  };
  tool?: string;
  toolExecutionState?: 'SUCCESS' | 'WAITING_FOR_HUMAN_APPROVAL' | 'BLOCKED_NOT_EXECUTED' | 'DENIED_NOT_EXECUTED';
  toolResult?: unknown;
  preventionProof?: string;
  executed: boolean;
  halted: boolean;
  spamSignals?: SpamSignals;
}

interface CustomerStoreState {
  customers: Array<{ id: string; name: string; email: string; status: string; balance: number; tier: string }>;
  orders: Array<{ id: string; customerId: string; amount: number; status: string; refundIssued: boolean; refundAmount?: number; notes?: string }>;
  adminRequests: Array<{ id: string; agentId: string; targetRole: string; justification: string; granted: boolean }>;
}

interface ProviderStatusData {
  providerId: string;
  providerName: string;
  modelName: string;
  isConfigured: boolean;
  statusText: string;
  supportedScenarios: string[];
}

const SCENARIOS = [
  {
    id: 'GEMINI_CUSTOMER_SUPPORT',
    name: 'Customer Support Tool Execution (Protected Gateway)',
    description: 'Gemini Support Agent requesting protected tools (get_customer, get_order, update_order, issue_refund, request_admin_access, delete_customer) with complete Sentinel decision gating.'
  },
  { id: 'GEMINI_SCOPE_CREEP', name: 'Scope Creep Escalation', description: 'Agent drifts from safe docs into executive financial records' },
  { id: 'GEMINI_FINANCIAL_AUDIT', name: 'Financial Audit Workflow', description: 'Financial audit task escalating to unauthorized HR access and deletion' },
  { id: 'GEMINI_NORMAL', name: 'Normal Research', description: 'Routine documentation analysis, 100% authorized and safe' },
  { id: 'GEMINI_SENSITIVE_ACCESS', name: 'Sensitive Data Spike', description: 'Abrupt request to export confidential customer PII vault' },
  { id: 'GEMINI_PRIVILEGE_ESCALATION', name: 'Privilege Escalation', description: 'Unauthorized attempt to claim super-admin IAM role' },
  { id: 'GEMINI_DESTRUCTIVE_ATTEMPT', name: 'Destructive Deletion', description: 'Attempted permanent destruction of production database' },
  { id: 'GEMINI_FALSE_POSITIVE', name: 'Legitimate Diagnostic (False Positive Check)', description: 'Unusual system analysis with legitimate context — Sentinel does not blindly block' }
];

export const LiveAgentView: React.FC = () => {
  const { isSimple } = useMode();
  const [providerStatus, setProviderStatus] = useState<ProviderStatusData | null>(null);
  const [customerStore, setCustomerStore] = useState<CustomerStoreState | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('GEMINI_CUSTOMER_SUPPORT');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'IDLE' | 'LIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED'>('IDLE');
  const [steps, setSteps] = useState<ControlledStepResult[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Fetch customer store state
  const fetchCustomerStore = async () => {
    try {
      const data = await apiClient.get<any>('/v1/tools/customer-store');
      setCustomerStore(data.data || data);
    } catch {
      // Ignored
    }
  };

  // Fetch provider status
  const fetchStatus = async () => {
    try {
      const data = await apiClient.get<any>('/v1/live-agent/status');
      setProviderStatus(data.data || data);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchCustomerStore();
  }, []);

  // Scroll to latest step in stream
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  // Execute full guided demo
  const handleStartSession = async () => {
    setIsRunning(true);
    setError(null);
    setSteps([]);
    setSessionStatus('LIVE');

    try {
      // 1. Start session
      const startData = await apiClient.post<any>('/v1/live-agent/start', {
        scenarioId: selectedScenario
      });

      const newSessionId = startData.session?.id || startData.id;
      const newAgentId = startData.agent?.id;
      setSessionId(newSessionId);
      setAgentId(newAgentId);

      // 2. Step through actions iteratively
      let currentStatus: 'LIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED' = 'LIVE';
      let stepNum = 0;
      const maxSteps = 7;

      while (stepNum < maxSteps && currentStatus === 'LIVE') {
        stepNum++;
        const stepData: ControlledStepResult = await apiClient.post<ControlledStepResult>(
          '/v1/live-agent/step',
          { sessionId: newSessionId }
        );
        setSteps((prev) => [...prev, stepData]);
        setSelectedStepIndex(stepNum - 1);
        await fetchCustomerStore();

        if (stepData.decision === 'CONFIRM') {
          currentStatus = 'PAUSED';
          setSessionStatus('PAUSED');
          break; // Stop automated loop to await human interaction
        }

        if (stepData.decision === 'BLOCK') {
          currentStatus = 'BLOCKED';
          setSessionStatus('BLOCKED');
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      if (currentStatus === 'LIVE') {
        setSessionStatus('COMPLETED');
      }
    } catch (err) {
      setError((err as Error).message);
      setSessionStatus('IDLE');
    } finally {
      setIsRunning(false);
    }
  };

  // Submit human intervention decision
  const handleHumanDecision = async (decision: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION') => {
    if (!sessionId) return;
    setIsSubmittingDecision(true);
    try {
      await apiClient.post('/v1/live-agent/decision', {
        sessionId,
        decision,
        reviewerId: 'sec-ops-lead',
        reason: `Security Operator selected ${decision}`
      });

      // Refresh customer store immediately after human decision
      await fetchCustomerStore();

      // Update local step with decision
      setSteps((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last) {
          last.humanDecision = decision;
          if (decision === 'ALLOW_ONCE') {
            last.executed = true;
            last.toolExecutionState = 'SUCCESS';
          } else {
            last.executed = false;
            last.toolExecutionState = 'DENIED_NOT_EXECUTED';
          }
        }
        return copy;
      });

      if (decision === 'ALLOW_ONCE') {
        setSessionStatus('LIVE');
        // Resume next step
        setIsRunning(true);
        setTimeout(async () => {
          try {
            const nextStepData: ControlledStepResult = await apiClient.post<ControlledStepResult>(
              '/v1/live-agent/step',
              { sessionId }
            );
            setSteps((prev) => [...prev, nextStepData]);
            setSelectedStepIndex(steps.length);
            await fetchCustomerStore();
            setSessionStatus(nextStepData.decision === 'BLOCK' ? 'BLOCKED' : 'COMPLETED');
          } catch {
            setSessionStatus('COMPLETED');
          } finally {
            setIsRunning(false);
          }
        }, 600);
      } else {
        setSessionStatus('BLOCKED');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const currentStep = steps[selectedStepIndex] || steps[steps.length - 1];

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'ALLOW':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'MONITOR':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
      case 'WARN':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'CONFIRM':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'BLOCK':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  // Trajectory SVG Chart calculations
  const chartWidth = 560;
  const chartHeight = 160;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 25;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  const getX = (index: number, total: number) => {
    const divisor = Math.max(total - 1, 4);
    return padLeft + (index / divisor) * plotWidth;
  };

  const getY = (riskVal: number) => {
    const clamped = Math.max(0, Math.min(100, riskVal));
    return padTop + plotHeight * (1 - clamped / 100);
  };

  // Threshold Y at Risk 60
  const thresholdY = getY(60);
  // Optimal Window Y bounds: 50 to 75
  const windowTopY = getY(75);
  const windowBottomY = getY(50);

  return (
    <div className="space-y-6">
      {/* Top Connection Indicator */}
      <AgentConnectionStatus />

      {/* Security Control Center Header */}
      <div className="card-tactile p-6 bg-gradient-to-r from-surface-primary to-surface-50 dark:from-surface-primary dark:to-surface-850 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                {sessionStatus === 'LIVE' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  sessionStatus === 'LIVE'
                    ? 'bg-emerald-500'
                    : sessionStatus === 'PAUSED'
                    ? 'bg-amber-500'
                    : sessionStatus === 'BLOCKED'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`} />
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Security Operations Center // External Agent Gate
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Session: {sessionStatus}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Live Agent Governance Console
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <div>Agent: <span className="text-slate-900 dark:text-slate-100 font-semibold">{selectedScenario === 'GEMINI_CUSTOMER_SUPPORT' ? 'Gemini Support Agent' : 'Gemini Research Agent'} {agentId ? `(${agentId})` : ''}</span></div>
              <div>Provider: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{providerStatus?.providerName || 'Google Gemini'}</span></div>
              <div>Model: <span className="text-slate-900 dark:text-slate-100 font-mono font-semibold">{providerStatus?.modelName || 'gemini-3.8-flash'}</span></div>
              <div>Task: <span className="text-slate-900 dark:text-slate-100 italic">{selectedScenario === 'GEMINI_CUSTOMER_SUPPORT' ? 'Customer service & order triage' : 'Research project information'}</span></div>
            </div>
          </div>

          {/* Scenario Selector & Run Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              disabled={isRunning || sessionStatus === 'PAUSED'}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-primary dark:bg-surface-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleStartSession}
              disabled={isRunning}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-tactile-subtle transition-all cursor-pointer ${
                isRunning
                  ? 'bg-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98]'
              }`}
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Governing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Agent Session</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Provider Graceful Fallback Banner */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {providerStatus?.isConfigured
                ? 'Gemini Connected — Real model inference active.'
                : 'Gemini is not configured — running deterministic demo agent.'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Enforcement: Sentinel REST Gate (/api/v1/actions)
          </span>
        </div>
      </div>

      {/* Step 3: Runtime Security Architecture Control Strip */}
      <div className="card-tactile p-4 border-slate-200 dark:border-slate-800 bg-surface-50/50 dark:bg-surface-900/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            Runtime Security Architecture // Real-Time Enforcement Path
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Authoritative Gate: Sentinel Intervention Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Node 1: External Agent */}
          <div className={`p-3 rounded-xl border text-center transition-all ${
            sessionStatus === 'LIVE' || sessionStatus === 'PAUSED'
              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'bg-surface-100 dark:bg-surface-800 border-slate-200 dark:border-slate-700 text-slate-500'
          }`}>
            <span className="text-[10px] font-bold block uppercase tracking-wider text-slate-400">1. External AI</span>
            <span className="text-xs font-bold block mt-0.5">{providerStatus?.providerName || 'Gemini Agent'}</span>
            <span className="text-[10px] block font-mono text-slate-500 mt-0.5 truncate">
              {currentStep ? `${currentStep.proposedAction.action} ${currentStep.proposedAction.resource}` : 'Proposes Action'}
            </span>
          </div>

          {/* Arrow 1 */}
          <div className="hidden md:flex justify-center text-slate-400">
            <ArrowRight className="w-4 h-4 animate-pulse" />
          </div>

          {/* Node 2: Sentinel Gate */}
          <div className={`p-3 rounded-xl border text-center transition-all ${
            currentStep
              ? 'bg-sky-500/10 border-sky-500/40 text-sky-700 dark:text-sky-300 shadow-tactile-subtle'
              : 'bg-surface-100 dark:bg-surface-800 border-slate-200 dark:border-slate-700 text-slate-500'
          }`}>
            <span className="text-[10px] font-bold block uppercase tracking-wider text-slate-400">2. Sentinel Gate</span>
            <span className="text-xs font-bold block mt-0.5">Runtime Security Gate</span>
            <span className="text-[10px] block font-mono text-slate-500 mt-0.5">POST /api/v1/actions</span>
          </div>

          {/* Arrow 2 */}
          <div className="hidden md:flex justify-center text-slate-400">
            <ArrowRight className="w-4 h-4 animate-pulse" />
          </div>

          {/* Node 3: Enforcement & Outcome */}
          <div className={`p-3 rounded-xl border text-center transition-all ${
            sessionStatus === 'BLOCKED' || currentStep?.decision === 'BLOCK'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
              : sessionStatus === 'PAUSED' || currentStep?.decision === 'CONFIRM'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 animate-pulse-subtle'
              : currentStep?.decision === 'ALLOW' || currentStep?.decision === 'MONITOR'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-surface-100 dark:bg-surface-800 border-slate-200 dark:border-slate-700 text-slate-500'
          }`}>
            <span className="text-[10px] font-bold block uppercase tracking-wider text-slate-400">3. Enforcement</span>
            <span className="text-xs font-bold block mt-0.5">
              {sessionStatus === 'BLOCKED'
                ? 'TERMINATED (BLOCK)'
                : sessionStatus === 'PAUSED'
                ? 'HUMAN INTERVENTION'
                : currentStep
                ? `GOVERNED (${currentStep.decision})`
                : 'Awaiting Session'}
            </span>
            <span className="text-[10px] block font-mono text-slate-500 mt-0.5">
              {sessionStatus === 'PAUSED' ? 'Window Active' : sessionStatus === 'BLOCKED' ? 'Execution Halted' : 'Zero Direct Execution'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Human Intervention Decision Banner (Active when sessionStatus is PAUSED) */}
      {sessionStatus === 'PAUSED' && currentStep && (
        <div className="card-tactile p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300 dark:border-amber-700/60 animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Sliders className="w-4 h-4" />
                <span>Intervention Window Triggered // Human Decision Required</span>
              </div>

              {/* Simple Mode Layman Prompt */}
              {isSimple ? (
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {currentStep.simpleNarration.what}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Why?</strong> {currentStep.simpleNarration.why}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    Risk Assessment: {currentStep.simpleNarration.risk}
                  </p>
                </div>
              ) : (
                /* Expert Mode Technical Diagnostics */
                <div className="space-y-1">
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                    CONFIRM: {currentStep.proposedAction.action} {currentStep.proposedAction.resource}
                  </h3>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    Deviation: {currentStep.trajectoryDeviation}% | Risk: {currentStep.risk}/100 | Window: {currentStep.interventionWindow}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Scope: <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">{currentStep.proposedAction.scope}</code> (Unauthorized)
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons: Allow Once, Deny, Stop Agent */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleHumanDecision('ALLOW_ONCE')}
                disabled={isSubmittingDecision}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-tactile-subtle flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Allow Once</span>
              </button>

              <button
                onClick={() => handleHumanDecision('DENY')}
                disabled={isSubmittingDecision}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition-all shadow-tactile-subtle flex items-center gap-2 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Deny</span>
              </button>

              <button
                onClick={() => handleHumanDecision('REVOKE_SESSION')}
                disabled={isSubmittingDecision}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold transition-all shadow-tactile-subtle flex items-center gap-2 cursor-pointer border border-slate-600"
              >
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Stop Agent</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spam & Abuse Protection Card */}
      <div className="card-tactile p-4 border-slate-200 dark:border-slate-800 bg-surface-50/40 dark:bg-surface-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Spam Protection
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">
              // Pre-Ingestion Guard Layer
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Request Rate:{' '}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {currentStep?.spamSignals
                  ? `${currentStep.spamSignals.requestRate} req/window`
                  : currentStep
                  ? '1 req/window'
                  : '0 req/window'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</span>
              {(() => {
                const status = currentStep?.spamSignals?.status || (sessionStatus === 'BLOCKED' ? 'BLOCKED' : 'NORMAL');
                const badgeColor =
                  status === 'BLOCKED' || status === 'THROTTLED'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : status === 'WARNING'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
                return (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                    {status}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Signals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-100 dark:bg-surface-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">Burst detected</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              currentStep?.spamSignals?.burstDetected
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-slate-400 font-normal'
            }`}>
              {currentStep?.spamSignals?.burstDetected ? 'YES' : 'NO'}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-100 dark:bg-surface-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">Duplicate detected</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              currentStep?.spamSignals?.duplicateDetected
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-slate-400 font-normal'
            }`}>
              {currentStep?.spamSignals?.duplicateDetected
                ? `YES (${currentStep.spamSignals.duplicateCount}x)`
                : 'NO'}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-100 dark:bg-surface-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">Rate limit exceeded</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              currentStep?.spamSignals?.rateLimitExceeded
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                : 'text-slate-400 font-normal'
            }`}>
              {currentStep?.spamSignals?.rateLimitExceeded ? 'EXCEEDED' : 'NOMINAL'}
            </span>
          </div>
        </div>
      </div>

      {/* Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Agent</span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block mt-1">
            {selectedScenario === 'GEMINI_CUSTOMER_SUPPORT' ? 'Gemini Support Agent' : 'Gemini Research Agent'}
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Session</span>
          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate block mt-1">
            {sessionId || 'Not Started'}
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Current Action</span>
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate block mt-1">
            {currentStep?.tool || currentStep?.proposedAction.action || '—'}
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Decision</span>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getDecisionBadge(currentStep?.decision || 'ALLOW')}`}>
            {currentStep?.decision || 'STANDBY'}
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Risk</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xs font-bold ${
              (currentStep?.risk ?? 0) >= 70 ? 'text-rose-500' : (currentStep?.risk ?? 0) >= 40 ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              {currentStep?.risk ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Intervention</span>
          <span className={`text-xs font-bold block mt-1 ${
            currentStep?.interventionWindow === 'OPTIMAL_WINDOW' ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'
          }`}>
            {currentStep?.interventionWindow || 'SAFE'}
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800 xl:col-span-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tool Execution</span>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
            (currentStep?.toolExecutionState === 'WAITING_FOR_HUMAN_APPROVAL' || (sessionStatus === 'PAUSED' && currentStep?.decision === 'CONFIRM'))
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
              : (currentStep?.toolExecutionState === 'SUCCESS' || (currentStep?.executed && currentStep?.decision !== 'BLOCK'))
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : (currentStep?.toolExecutionState === 'BLOCKED_NOT_EXECUTED' || currentStep?.decision === 'BLOCK')
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
              : (currentStep?.toolExecutionState === 'DENIED_NOT_EXECUTED')
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
          }`}>
            {(currentStep?.toolExecutionState === 'WAITING_FOR_HUMAN_APPROVAL' || (sessionStatus === 'PAUSED' && currentStep?.decision === 'CONFIRM'))
              ? 'WAITING FOR HUMAN APPROVAL'
              : (currentStep?.toolExecutionState === 'SUCCESS' || (currentStep?.executed && currentStep?.decision !== 'BLOCK'))
              ? 'SUCCESS'
              : (currentStep?.toolExecutionState === 'BLOCKED_NOT_EXECUTED' || currentStep?.decision === 'BLOCK')
              ? 'BLOCKED — NOT EXECUTED'
              : (currentStep?.toolExecutionState === 'DENIED_NOT_EXECUTED')
              ? 'DENIED — NOT EXECUTED'
              : 'STANDBY'}
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Deviation</span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mt-1">
            {currentStep?.trajectoryDeviation ?? 0}%
          </span>
        </div>

        <div className="card-tactile p-3 border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Predicted Risk</span>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mt-1">
            {currentStep?.predictedNextRisk ?? 0}
          </span>
        </div>
      </div>

      {/* Step 5: Live Risk Trajectory Chart */}
      <div className="card-tactile p-5 border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Live Behavioral Risk Trajectory & Intervention Window
            </h2>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Low Risk (&lt;40)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Elevated (40-69)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Critical (≥70)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-500">
              <Zap className="w-3 h-3" />
              Forecast Horizon
            </span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 select-none">
            {/* Background Grid Lines */}
            <line x1={padLeft} y1={getY(0)} x2={chartWidth - padRight} y2={getY(0)} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
            <line x1={padLeft} y1={getY(25)} x2={chartWidth - padRight} y2={getY(25)} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padLeft} y1={getY(50)} x2={chartWidth - padRight} y2={getY(50)} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padLeft} y1={getY(75)} x2={chartWidth - padRight} y2={getY(75)} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padLeft} y1={getY(100)} x2={chartWidth - padRight} y2={getY(100)} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />

            {/* Y-Axis Labels */}
            <text x={padLeft - 8} y={getY(0) + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">0</text>
            <text x={padLeft - 8} y={getY(25) + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">25</text>
            <text x={padLeft - 8} y={getY(50) + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">50</text>
            <text x={padLeft - 8} y={getY(75) + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">75</text>
            <text x={padLeft - 8} y={getY(100) + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">100</text>

            {/* Optimal Intervention Window Shaded Band (50 to 75) */}
            <rect
              x={padLeft}
              y={windowTopY}
              width={plotWidth}
              height={windowBottomY - windowTopY}
              className="fill-amber-500/10 dark:fill-amber-500/15"
            />
            <text
              x={chartWidth - padRight - 6}
              y={windowTopY + 12}
              textAnchor="end"
              className="text-[9px] fill-amber-600 dark:fill-amber-400 font-mono font-semibold"
            >
              ★ OPTIMAL INTERVENTION WINDOW (50-75)
            </text>

            {/* Intervention Threshold Dashed Line (Risk 60) */}
            <line
              x1={padLeft}
              y1={thresholdY}
              x2={chartWidth - padRight}
              y2={thresholdY}
              stroke="rgb(249 115 22)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            <text
              x={padLeft + 6}
              y={thresholdY - 4}
              className="text-[9px] fill-orange-500 font-mono font-bold"
            >
              Threshold (60)
            </text>

            {/* Step Trajectory Points & Path */}
            {steps.length > 0 && (
              <>
                {/* Connecting Polyline */}
                {steps.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="rgb(99 102 241)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={steps.map((s, i) => `${getX(i, steps.length)},${getY(s.risk)}`).join(' ')}
                  />
                )}

                {/* Forecast Line to predictedNextRisk */}
                {currentStep && (
                  <line
                    x1={getX(steps.length - 1, steps.length)}
                    y1={getY(currentStep.risk)}
                    x2={Math.min(chartWidth - padRight, getX(steps.length - 1, steps.length) + 45)}
                    y2={getY(currentStep.predictedNextRisk)}
                    stroke="rgb(168 85 247)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Render Each Step Node */}
                {steps.map((s, i) => {
                  const cx = getX(i, steps.length);
                  const cy = getY(s.risk);
                  const isBlock = s.decision === 'BLOCK';
                  const isConfirm = s.decision === 'CONFIRM';
                  const fillColor = s.risk >= 70 ? '#f43f5e' : s.risk >= 40 ? '#f59e0b' : '#10b981';

                  return (
                    <g key={i}>
                      {/* Pulse circle on selected */}
                      {selectedStepIndex === i && (
                        <circle cx={cx} cy={cy} r="9" className="fill-indigo-500/30 animate-ping" />
                      )}
                      {/* Node circle */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="5.5"
                        fill={fillColor}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer"
                        onClick={() => setSelectedStepIndex(i)}
                      />
                      {/* Step Number X-Axis Label */}
                      <text x={cx} y={chartHeight - 6} textAnchor="middle" className="text-[10px] fill-slate-400 font-mono">
                        S{s.stepNumber}
                      </text>
                      {/* Risk Value Above Point */}
                      <text x={cx} y={cy - 9} textAnchor="middle" className="text-[10px] fill-slate-600 dark:fill-slate-300 font-mono font-bold">
                        {s.risk}
                      </text>
                      {/* Milestone Badges */}
                      {isConfirm && (
                        <text x={cx} y={cy - 20} textAnchor="middle" className="text-[9px] fill-orange-500 font-mono font-bold">
                          ★ CONFIRM
                        </text>
                      )}
                      {isBlock && (
                        <text x={cx} y={cy - 20} textAnchor="middle" className="text-[9px] fill-rose-500 font-mono font-bold">
                          ⛔ BLOCK
                        </text>
                      )}
                    </g>
                  );
                })}
              </>
            )}

            {/* Zero State Prompt */}
            {steps.length === 0 && (
              <text x={chartWidth / 2} y={chartHeight / 2} textAnchor="middle" className="text-xs fill-slate-400 font-medium">
                Click "Run Agent Session" to plot live behavioral risk trajectory
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* Live Simulated Customer & Order Data Store Panel */}
      <div className="card-tactile p-4 border-slate-200 dark:border-slate-800 bg-surface-50/50 dark:bg-surface-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Simulated Customer & Order Data Store // Live In-Memory State
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Resource Isolation: Zero Direct Tool Authority for Gemini
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Record */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-surface-primary dark:bg-surface-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                Customer: {customerStore?.customers[0]?.id || 'CUST-001'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                customerStore?.customers[0]?.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
              }`}>
                Status: {customerStore?.customers[0]?.status || 'ACTIVE'}
              </span>
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              <div>Name: <span className="font-semibold">{customerStore?.customers[0]?.name || 'Acme Corp / Sarah Chen'}</span></div>
              <div>Tier: <span className="font-mono text-slate-500">{customerStore?.customers[0]?.tier || 'ENTERPRISE'}</span> | Balance: <span className="font-mono font-semibold">${customerStore?.customers[0]?.balance?.toFixed(2) || '4500.00'}</span></div>
            </div>
            {currentStep?.tool === 'delete_customer' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                🛡️ Sentinel Prevented Permanent Deletion — Customer Profile Remains ACTIVE
              </div>
            )}
          </div>

          {/* Order Record */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-surface-primary dark:bg-surface-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                Order: {customerStore?.orders[0]?.id || 'ORD-1001'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                customerStore?.orders[0]?.status === 'REFUNDED'
                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
              }`}>
                Status: {customerStore?.orders[0]?.status || 'DELIVERED'}
              </span>
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              <div>Amount: <span className="font-mono font-semibold">${customerStore?.orders[0]?.amount?.toFixed(2) || '350.00'}</span> | Refund Issued: <span className={`font-bold ${customerStore?.orders[0]?.refundIssued ? 'text-amber-500' : 'text-slate-500'}`}>{customerStore?.orders[0]?.refundIssued ? 'YES (Approved by Human Operator)' : 'NO'}</span></div>
              {customerStore?.orders[0]?.notes && (
                <div className="text-[11px] text-slate-500 truncate">Notes: {customerStore?.orders[0]?.notes}</div>
              )}
            </div>
            {currentStep?.tool === 'issue_refund' && sessionStatus === 'PAUSED' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                ⏳ Tool Execution Held — Awaiting Human Approval before refunding $350.00
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Stream & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Security Event Stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live Governance Telemetry Stream
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {steps.length} Events Logged
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {steps.length === 0 ? (
              <div className="card-tactile p-8 text-center text-slate-400 text-xs border-dashed">
                Session idle. Click "Run Agent Session" to initiate governed agent stream.
              </div>
            ) : (
              steps.map((step, idx) => {
                const isSelected = selectedStepIndex === idx;
                const timeStr = new Date(step.timestamp).toLocaleTimeString();
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedStepIndex(idx)}
                    className={`card-tactile p-4 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Timestamp + Stream Flow Header */}
                    <div className="flex items-center justify-between gap-3 text-xs mb-2">
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getDecisionBadge(step.decision)}`}>
                          Sentinel → {step.decision}
                        </span>
                        {step.humanDecision && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Operator: {step.humanDecision}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Agent Proposal */}
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-100 dark:bg-surface-800 text-slate-700 dark:text-slate-300 mt-0.5">
                        {step.stepNumber}
                      </span>
                      <div className="space-y-1 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="text-indigo-600 dark:text-indigo-400">Gemini</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{step.proposedAction.action} {step.proposedAction.resource}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          "{step.proposedAction.reason}"
                        </p>
                      </div>
                    </div>

                    {/* Simple vs Expert Stream Details */}
                    {isSimple ? (
                      <div className="mt-3 p-2.5 rounded-lg bg-surface-50 dark:bg-surface-850 border border-slate-200/60 dark:border-slate-800 text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {step.simpleNarration.what}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>Risk: {step.risk}/100</span>
                        <span>Δ: {step.riskDelta ?? 0}</span>
                        <span>Dev: {step.trajectoryDeviation}%</span>
                        <span>Window: {step.interventionWindow}</span>
                        <span>Scope: {step.proposedAction.scope}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={streamEndRef} />
          </div>
        </div>

        {/* Right 1 Col: Detailed Step Inspector */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isSimple ? 'Sentinel Safety Summary' : 'Security Engine Telemetry'}
          </h2>

          {currentStep ? (
            <div className="card-tactile p-5 border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Step {currentStep.stepNumber} Inspector
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  {currentStep.proposedAction.action} {currentStep.proposedAction.resource}
                </h3>
              </div>

              {isSimple ? (
                /* Simple Mode Explanation Cards */
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      What is happening?
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {currentStep.simpleNarration.what}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-850 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Why did Sentinel flag this?
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {currentStep.simpleNarration.why}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-850 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Recommendation:
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {currentStep.simpleNarration.actionRecommendation}
                    </p>
                  </div>
                </div>
              ) : (
                /* Expert Mode Technical Breakdown */
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Policy Verdict Reasons:</span>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {currentStep.decisionReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resource:</span>
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[170px]">{currentStep.proposedAction.resource}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Required Scope:</span>
                      <span className="text-slate-800 dark:text-slate-200">{currentStep.proposedAction.scope}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sensitivity:</span>
                      <span className="text-slate-800 dark:text-slate-200">{currentStep.proposedAction.sensitivity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reversibility:</span>
                      <span className="text-slate-800 dark:text-slate-200">{currentStep.proposedAction.reversibility}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Risk Velocity / Delta:</span>
                      <span className="text-slate-800 dark:text-slate-200">{currentStep.riskAcceleration} (Δ: {currentStep.riskDelta ?? 0})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Intervention Window:</span>
                      <span className="text-amber-500 font-bold">{currentStep.interventionWindow} ({currentStep.interventionUrgency})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Forecast Horizon Risk:</span>
                      <span className="text-indigo-500 font-bold">{currentStep.predictedNextRisk}/100</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-semibold">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tool Execution:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    (currentStep.toolExecutionState === 'WAITING_FOR_HUMAN_APPROVAL' || (!currentStep.executed && currentStep.decision === 'CONFIRM'))
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                      : (currentStep.toolExecutionState === 'SUCCESS' || currentStep.executed)
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}>
                    {(currentStep.toolExecutionState === 'WAITING_FOR_HUMAN_APPROVAL' || (!currentStep.executed && currentStep.decision === 'CONFIRM'))
                      ? 'WAITING FOR HUMAN APPROVAL'
                      : (currentStep.toolExecutionState === 'SUCCESS' || currentStep.executed)
                      ? 'SUCCESS'
                      : currentStep.toolExecutionState === 'DENIED_NOT_EXECUTED'
                      ? 'DENIED — NOT EXECUTED'
                      : 'BLOCKED — NOT EXECUTED'}
                  </span>
                </div>

                {currentStep.preventionProof && (
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                    🛡️ {currentStep.preventionProof}
                  </div>
                )}

                {currentStep.toolResult !== undefined && currentStep.toolResult !== null && (
                  <div className="mt-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-850 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Simulated Tool Return:</span>
                    <pre className="text-[10px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-24">
                      {JSON.stringify(currentStep.toolResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No step data selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
