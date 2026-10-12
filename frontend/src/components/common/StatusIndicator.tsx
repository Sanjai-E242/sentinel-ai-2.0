import React from 'react';
import { SimpleModeStatus } from '@sentinel/shared';
import { ShieldCheck, Eye, AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';

interface StatusIndicatorProps {
  status: SimpleModeStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  SimpleModeStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgLight: string;
    textLight: string;
    borderLight: string;
    bgDark: string;
    textDark: string;
    borderDark: string;
    dotClass: string;
  }
> = {
  SAFE: {
    label: 'SAFE',
    icon: ShieldCheck,
    bgLight: 'bg-emerald-50',
    textLight: 'text-emerald-700',
    borderLight: 'border-emerald-200',
    bgDark: 'dark:bg-emerald-950/40',
    textDark: 'dark:text-emerald-300',
    borderDark: 'dark:border-emerald-800/40',
    dotClass: 'bg-emerald-500'
  },
  WATCHING: {
    label: 'WATCHING',
    icon: Eye,
    bgLight: 'bg-sky-50',
    textLight: 'text-sky-700',
    borderLight: 'border-sky-200',
    bgDark: 'dark:bg-sky-950/40',
    textDark: 'dark:text-sky-300',
    borderDark: 'dark:border-sky-800/40',
    dotClass: 'bg-sky-500'
  },
  ATTENTION: {
    label: 'ATTENTION',
    icon: AlertTriangle,
    bgLight: 'bg-amber-50',
    textLight: 'text-amber-700',
    borderLight: 'border-amber-200',
    bgDark: 'dark:bg-amber-950/40',
    textDark: 'dark:text-amber-300',
    borderDark: 'dark:border-amber-800/40',
    dotClass: 'bg-amber-500'
  },
  APPROVAL_NEEDED: {
    label: 'APPROVAL NEEDED',
    icon: AlertCircle,
    bgLight: 'bg-orange-50',
    textLight: 'text-orange-700',
    borderLight: 'border-orange-200',
    bgDark: 'dark:bg-orange-950/40',
    textDark: 'dark:text-orange-300',
    borderDark: 'dark:border-orange-800/40',
    dotClass: 'bg-orange-500'
  },
  STOPPED: {
    label: 'STOPPED',
    icon: ShieldAlert,
    bgLight: 'bg-rose-50',
    textLight: 'text-rose-700',
    borderLight: 'border-rose-200',
    bgDark: 'dark:bg-rose-950/40',
    textDark: 'dark:text-rose-300',
    borderDark: 'dark:border-rose-800/40',
    dotClass: 'bg-rose-500'
  }
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showIcon = true,
  size = 'md',
  pulse = false,
  className = ''
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.WATCHING;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-3 py-1 text-xs gap-2',
    lg: 'px-4 py-1.5 text-sm gap-2.5 font-semibold'
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-pill border font-medium ${config.bgLight} ${config.textLight} ${config.borderLight} ${config.bgDark} ${config.textDark} ${config.borderDark} ${sizeClasses} ${className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotClass}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`} />
      </span>
      {showIcon && <Icon className={iconSizes} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
};
