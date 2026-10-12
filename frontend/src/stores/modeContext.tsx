import React, { createContext, useContext, useState, useEffect } from 'react';

export type ViewMode = 'simple' | 'expert';

interface ModeContextType {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggleMode: () => void;
  isSimple: boolean;
  isExpert: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'sentinel_ui_mode';

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Simple Mode is the default experience as explicitly specified
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'simple' || stored === 'expert') {
        return stored;
      }
    }
    return 'simple';
  });

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const setMode = (newMode: ViewMode) => {
    setModeState(newMode);
  };

  const toggleMode = () => {
    setModeState((prev) => (prev === 'simple' ? 'expert' : 'simple'));
  };

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isSimple: mode === 'simple',
        isExpert: mode === 'expert'
      }}
    >
      {children}
    </ModeContext.Provider>
  );
};

export function useMode(): ModeContextType {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
