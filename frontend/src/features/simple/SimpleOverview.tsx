import React from 'react';
import { StatusIndicator } from '../../components/common/StatusIndicator';
import { MetricCard } from '../../components/common/MetricCard';
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { SimpleModeStatus } from '@sentinel/shared';
import { useNavigation } from '../../stores/navigationContext';
import { AgentConnectionStatus } from '../../components/common/AgentConnectionStatus';

interface AgentOverviewItem {
  id: string;
  name: string;
  role: string;
  status: SimpleModeStatus;
  userFacingExplanation: string;
  recommendedAction: string;
  requiresAction: boolean;
}

const SAMPLE_AGENTS: AgentOverviewItem[] = [
  {
    id: 'agent-1',
    name: 'Customer Support Assistant',
    role: 'Tier 1 Support Agent (Gemini Pro)',
    status: 'SAFE',
    userFacingExplanation: 'Performing routine customer query resolutions within verified bounds.',
    recommendedAction: 'No action needed. System is operating safely.',
    requiresAction: false
  },
  {
    id: 'agent-2',
    name: 'Financial Report Compiler',
    role: 'Batch Analyst Agent (Gemini Flash)',
    status: 'WATCHING',
    userFacingExplanation: 'Sentinel is keeping a close watch on unusual query frequency.',
    recommendedAction: 'Autonomous monitoring active. No manual intervention required.',
    requiresAction: false
  },
  {
    id: 'agent-3',
    name: 'Cloud Infrastructure Optimizer',
    role: 'DevOps Agent (Gemini Ultra)',
    status: 'APPROVAL_NEEDED',
    userFacingExplanation: 'The agent wants your permission before deleting unused staging containers.',
    recommendedAction: 'Review and approve action before execution proceeds.',
    requiresAction: true
  }
];

export const SimpleOverview: React.FC = () => {
  const { setActiveTab } = useNavigation();

  return (
    <div className="space-y-6">
      {/* AI Agent Connection Indicator */}
      <AgentConnectionStatus />

      {/* Primary Status Banner - Answering "What is happening? Is it safe? Do I need to do something?" */}
      <div className="card-tactile p-6 sm:p-8 bg-gradient-to-r from-surface-primary to-surface-50 dark:from-surface-primary dark:to-surface-850 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <StatusIndicator status="APPROVAL_NEEDED" size="lg" pulse />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                System Status Overview
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              1 action requires your confirmation
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Sentinel 2.0 is actively governing your AI agents. 2 agents are operating normally, and 1 agent has reached the optimal intervention point requiring human sign-off.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('interventions')}
              className="px-5 py-2.5 rounded-pill bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-tactile-subtle inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Review Pending Action</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Plain Language Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <MetricCard
          title="Safe Agents"
          value="2"
          subtitle="Operating within normal bounds"
          badge={<StatusIndicator status="SAFE" size="sm" />}
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
          hint="All actions automatically validated"
        />
        <MetricCard
          title="Watching Closely"
          value="1"
          subtitle="Mildly unusual behavior observed"
          badge={<StatusIndicator status="WATCHING" size="sm" />}
          icon={<AlertCircle className="w-5 h-5 text-sky-600" />}
          hint="Telemetric recording active"
        />
        <MetricCard
          title="Actions Needing Approval"
          value="1"
          subtitle="Paused before sensitive execution"
          badge={<StatusIndicator status="APPROVAL_NEEDED" size="sm" />}
          icon={<CheckCircle2 className="w-5 h-5 text-orange-600" />}
          hint="Optimal intervention window"
        />
      </div>

      {/* Agents Card List in Plain Language */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Active AI Agents
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time summary of AI agent behavior and recommended responses
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {SAMPLE_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={`card-tactile p-5 transition-all ${
                agent.requiresAction
                  ? 'border-orange-300 dark:border-orange-900/60 bg-orange-50/20 dark:bg-orange-950/10'
                  : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                      {agent.name}
                    </h3>
                    <StatusIndicator status={agent.status} size="sm" />
                    <span className="text-xs font-mono text-slate-400">({agent.role})</span>
                  </div>

                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {agent.userFacingExplanation}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Recommended:
                    </span>
                    <span>{agent.recommendedAction}</span>
                  </div>
                </div>

                {agent.requiresAction ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-pill bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors shadow-tactile-subtle"
                    >
                      Authorize Action
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-pill bg-surface-200 hover:bg-surface-300 dark:bg-surface-800 dark:hover:bg-surface-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                    >
                      Halt Agent
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 self-center">Autonomous Safe Mode</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
