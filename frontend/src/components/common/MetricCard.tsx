import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  icon,
  hint,
  className = ''
}) => {
  return (
    <div className={`card-tactile p-5 flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {icon && (
          <div className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-slate-600 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </span>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {hint && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
        </div>
      )}
    </div>
  );
};
