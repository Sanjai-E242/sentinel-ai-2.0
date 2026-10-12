import React from 'react';
import {
  LayoutDashboard,
  Bot,
  Activity,
  GitBranch,
  ShieldAlert,
  FileText,
  Sliders,
  FlaskConical,
  BarChart3,
  Cpu,
  GitFork
} from 'lucide-react';

import { useNavigation, NavigationTab } from '../../stores/navigationContext';

interface NavigationRailProps {
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  groupHeader?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, groupHeader: 'Monitor' },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'sessions', label: 'Sessions', icon: Activity },
  { id: 'actions', label: 'Live Actions', icon: ShieldAlert },
  { id: 'trajectory', label: 'Trajectory', icon: GitBranch, groupHeader: 'Analyze' },
  { id: 'interventions', label: 'Interventions', icon: Sliders },
  { id: 'simulations', label: 'Counterfactual Simulator', icon: GitFork },
  { id: 'live-agent', label: 'Live Agent (Gemini)', icon: Cpu, groupHeader: 'Integration' },
  { id: 'scenarios', label: 'Scenario Lab', icon: FlaskConical, groupHeader: 'Evaluate' },
  { id: 'evaluation', label: 'Evaluation', icon: BarChart3 },
  { id: 'audit', label: 'Audit Trail', icon: FileText },
];

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeId,
  onSelect,
  className = ''
}) => {
  const { activeTab, setActiveTab } = useNavigation();
  const currentTab = activeId || activeTab;

  const handleSelect = (id: NavigationTab) => {
    setActiveTab(id);
    onSelect?.(id);
  };

  return (
    <nav
      aria-label="Sidebar Navigation"
      className={`w-64 border-r border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary p-4 flex flex-col justify-between ${className}`}
    >
      <div className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <React.Fragment key={item.id}>
              {item.groupHeader && (
                <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase first:pt-0">
                  {item.groupHeader}
                </div>
              )}
              <button
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-tactile-subtle'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : ''}`} />
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3.5 rounded-xl bg-surface-100 dark:bg-surface-800 border border-slate-200/60 dark:border-slate-700/40">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          Core Principle
        </p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
          "Don't just detect risk. Know when to intervene."
        </p>
      </div>
    </nav>
  );
};
