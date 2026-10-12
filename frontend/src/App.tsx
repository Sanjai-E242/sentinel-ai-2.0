import React from 'react';
import { ThemeProvider } from './stores/themeContext';
import { ModeProvider } from './stores/modeContext';
import { NavigationProvider } from './stores/navigationContext';
import { AppShell } from './components/shells/AppShell';
import { DashboardPage } from './pages/DashboardPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ModeProvider>
        <NavigationProvider>
          <AppShell>
            <DashboardPage />
          </AppShell>
        </NavigationProvider>
      </ModeProvider>
    </ThemeProvider>
  );
};

export default App;
