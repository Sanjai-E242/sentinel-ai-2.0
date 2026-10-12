import React, { useState } from 'react';
import { TopBar } from '../navigation/TopBar';
import { NavigationRail } from '../navigation/NavigationRail';
import { ModeSwitcher } from '../navigation/ModeSwitcher';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface AppShellProps {
  children: ReactNode;
}

import { ReactNode } from 'react';

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-900 transition-colors">
      {/* Top Header */}
      <TopBar onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />

      {/* Mobile Mode Switcher Bar */}
      <div className="sm:hidden flex items-center justify-center p-2.5 border-b border-slate-200 dark:border-slate-800 bg-surface-primary dark:bg-surface-primary">
        <ModeSwitcher />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Navigation Rail */}
        <aside className="hidden md:flex">
          <NavigationRail
            activeId={activeSection}
            onSelect={(id) => setActiveSection(id)}
          />
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          >
            <div
              className="w-64 h-full bg-white dark:bg-surface-primary shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <NavigationRail
                activeId={activeSection}
                onSelect={(id) => {
                  setActiveSection(id);
                  setMobileNavOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Main Content Area Wrapped with Error Boundary */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <ErrorBoundary fallbackTitle="Error loading dashboard section">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};
