import React from 'react';
import { DecisionType, getDecisionMeta } from '@sentinel/shared';

interface DecisionBadgeProps {
  decision: DecisionType;
  showExplanation?: boolean;
  className?: string;
}

export const DecisionBadge: React.FC<DecisionBadgeProps> = ({
  decision,
  showExplanation = false,
  className = ''
}) => {
  const meta = getDecisionMeta(decision);

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${meta.colorScheme.badgeBg} ${meta.colorScheme.badgeText}`}
      >
        {meta.code}
      </span>
      {showExplanation && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {meta.description}
        </span>
      )}
    </div>
  );
};
