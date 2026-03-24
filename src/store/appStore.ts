import { create } from 'zustand';

export interface BenchmarkOption {
  symbol: string;
  label: string;
}

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEI',     label: 'Nifty 50' },
  { symbol: '^NIFTY100', label: 'Nifty 100' },
  { symbol: '^BSESN',    label: 'BSE Sensex' },
  { symbol: '^BSE100',   label: 'BSE 100' },
  { symbol: '^BSE500',   label: 'BSE 500' },
  { symbol: '^NSEBANK',  label: 'Nifty Bank' },
  { symbol: '^CNXIT',    label: 'Nifty IT' },
];

interface AppStore {
  defaultBenchmarkSymbol: string;
  setDefaultBenchmarkSymbol: (symbol: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  defaultBenchmarkSymbol: '^NSEI',
  setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
}));
