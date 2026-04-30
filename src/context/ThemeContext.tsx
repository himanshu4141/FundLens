import { createContext, useContext, type ReactNode } from 'react';
import { Colors } from '@/src/constants/theme';
import { ClearLensCompatibleColors } from '@/src/constants/clearLensTheme';
import { useAppStore } from '@/src/store/appStore';

export type AppColors = typeof Colors;

interface ThemeContextValue {
  colors: AppColors;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: Colors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const appDesignMode = useAppStore((state) => state.appDesignMode);
  const colors = appDesignMode === 'clearLens' ? ClearLensCompatibleColors : Colors;

  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
