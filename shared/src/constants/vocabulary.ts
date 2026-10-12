import { DecisionType } from '../types/decision.js';
import { InterventionWindowStage } from '../types/intervention.js';
import { RiskLevel } from '../types/risk.js';

export type SimpleModeStatus =
  | 'SAFE'
  | 'WATCHING'
  | 'ATTENTION'
  | 'APPROVAL_NEEDED'
  | 'STOPPED';

export interface StatusMeta {
  code: string;
  label: string;
  simpleLabel: string;
  description: string;
  colorScheme: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  };
}

export const DECISION_VOCABULARY: Record<DecisionType, StatusMeta> = {
  ALLOW: {
    code: 'ALLOW',
    label: 'Allow',
    simpleLabel: 'SAFE',
    description: 'The requested action meets all security baselines and was permitted.',
    colorScheme: {
      bg: 'var(--status-safe-bg)',
      text: 'var(--status-safe-text)',
      border: 'var(--status-safe-border)',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-300'
    }
  },
  MONITOR: {
    code: 'MONITOR',
    label: 'Monitor',
    simpleLabel: 'WATCHING',
    description: 'Action is allowed with enhanced telemetry and behavioral observation.',
    colorScheme: {
      bg: 'var(--status-monitoring-bg)',
      text: 'var(--status-monitoring-text)',
      border: 'var(--status-monitoring-border)',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
      badgeText: 'text-sky-700 dark:text-sky-300'
    }
  },
  WARNING: {
    code: 'WARNING',
    label: 'Warning',
    simpleLabel: 'ATTENTION',
    description: 'Anomalous or unusual action noted. Agent flagged for risk acceleration.',
    colorScheme: {
      bg: 'var(--status-warning-bg)',
      text: 'var(--status-warning-text)',
      border: 'var(--status-warning-border)',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300'
    }
  },
  WARN: {
    code: 'WARN',
    label: 'Warning',
    simpleLabel: 'ATTENTION',
    description: 'Anomalous or high-sensitivity action noted.',
    colorScheme: {
      bg: 'var(--status-warning-bg)',
      text: 'var(--status-warning-text)',
      border: 'var(--status-warning-border)',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300'
    }
  },
  CONFIRM: {
    code: 'CONFIRM',
    label: 'Confirm Required',
    simpleLabel: 'APPROVAL NEEDED',
    description: 'Action paused. The agent wants your permission before continuing.',
    colorScheme: {
      bg: 'var(--status-confirm-bg)',
      text: 'var(--status-confirm-text)',
      border: 'var(--status-confirm-border)',
      badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
      badgeText: 'text-orange-700 dark:text-orange-300'
    }
  },
  BLOCK: {
    code: 'BLOCK',
    label: 'Block',
    simpleLabel: 'STOPPED',
    description: 'Sentinel stopped this action because it could be unsafe.',
    colorScheme: {
      bg: 'var(--status-block-bg)',
      text: 'var(--status-block-text)',
      border: 'var(--status-block-border)',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
      badgeText: 'text-rose-700 dark:text-rose-300'
    }
  }
};

export const INTERVENTION_STAGE_VOCABULARY: Record<InterventionWindowStage, {
  label: string;
  simpleDescription: string;
  expertDescription: string;
  isOptimal: boolean;
}> = {
  TOO_EARLY: {
    label: 'Too Early',
    simpleDescription: 'Everything is normal. Intervening now would cause unnecessary disruption.',
    expertDescription: 'Baseline behavior. Intervention introduces high false-positive disruption cost.',
    isOptimal: false
  },
  MONITOR: {
    label: 'Monitoring',
    simpleDescription: 'Keeping an eye on agent behavior.',
    expertDescription: 'Slight trajectory drift or novel action. Passive observational telemetry activated.',
    isOptimal: false
  },
  WARNING: {
    label: 'Warning',
    simpleDescription: 'The agent is behaving differently from its usual activity.',
    expertDescription: 'Trajectory divergence or risk acceleration threshold reached.',
    isOptimal: false
  },
  OPTIMAL_WINDOW: {
    label: 'Optimal Intervention Window',
    simpleDescription: 'Ideal moment to intervene before any serious harm occurs.',
    expertDescription: 'Pre-execution sweet spot. Maximum reversibility and minimal irreversible consequence.',
    isOptimal: true
  },
  OPTIMAL_INTERVENTION_WINDOW: {
    label: 'Optimal Intervention Window',
    simpleDescription: 'Ideal moment to intervene before any serious harm occurs.',
    expertDescription: 'Pre-execution sweet spot. Maximum reversibility and minimal irreversible consequence.',
    isOptimal: true
  },
  CONFIRM: {
    label: 'Confirmation Required',
    simpleDescription: 'The agent wants your permission before continuing.',
    expertDescription: 'High-risk or sensitive resource execution held pending human authorization.',
    isOptimal: true
  },
  TOO_LATE: {
    label: 'Too Late',
    simpleDescription: 'Destructive action was attempted or completed. Irreversible consequences possible.',
    expertDescription: 'Post-execution breach or destructive state change occurred prior to mitigation.',
    isOptimal: false
  }
};

export const RISK_LEVEL_META: Record<RiskLevel, {
  label: string;
  simpleLabel: SimpleModeStatus;
  color: string;
}> = {
  NONE: { label: 'None', simpleLabel: 'SAFE', color: 'emerald' },
  LOW: { label: 'Low', simpleLabel: 'SAFE', color: 'emerald' },
  MEDIUM: { label: 'Medium', simpleLabel: 'WATCHING', color: 'sky' },
  HIGH: { label: 'High', simpleLabel: 'ATTENTION', color: 'amber' },
  CRITICAL: { label: 'Critical', simpleLabel: 'STOPPED', color: 'rose' }
};
