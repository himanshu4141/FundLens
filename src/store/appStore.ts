import { create } from 'zustand';

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
}

export const useAppStore = create<AppStore>((set) => ({
  defaultBenchmarkSymbol: '^NSEI',
  setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
}));
