import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DesignVariant = 'v1' | 'v2';

export interface BenchmarkOption {
  symbol: string;
  label: string;
}

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEI',     label: 'Nifty 50' },
  { symbol: '^NIFTY100', label: 'Nifty 100' },
  { symbol: '^BSESN',    label: 'BSE Sensex' },
];

interface AppStore {
  defaultBenchmarkSymbol: string;
  setDefaultBenchmarkSymbol: (symbol: string) => void;
  designVariant: DesignVariant;
  setDesignVariant: (variant: DesignVariant) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      defaultBenchmarkSymbol: '^NSEI',
      setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
      designVariant: 'v1' as DesignVariant,
      setDesignVariant: (variant) => set({ designVariant: variant }),
    }),
    {
      name: 'fundlens-app-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
