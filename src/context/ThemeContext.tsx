import { createContext, useContext, type ReactNode } from 'react';
import { Colors } from '@/src/constants/theme';
import { ColorsV2 } from '@/src/constants/theme_v2';
import { useAppStore, type DesignVariant } from '@/src/store/appStore';

export type AppColors = typeof Colors;
export type { DesignVariant };

interface ThemeContextValue {
  colors: AppColors;
  variant: DesignVariant;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: Colors,
  variant: 'v1',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const variant = useAppStore((s) => s.designVariant);
  const colors = variant === 'v2' ? ColorsV2 : Colors;
  return (
    <ThemeContext.Provider value={{ colors, variant }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
