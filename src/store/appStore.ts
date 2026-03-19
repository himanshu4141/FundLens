import { create } from 'zustand';

export interface BenchmarkOption {
  symbol: string;
  label: string;
}

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEI', label: 'Nifty 50' },
  { symbol: '^NSEBANK', label: 'Nifty Bank' },
  { symbol: '^BSESN', label: 'SENSEX' },
  { symbol: '^CNXIT', label: 'Nifty IT' },
];

interface AppStore {
  defaultBenchmarkSymbol: string;
  setDefaultBenchmarkSymbol: (symbol: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  defaultBenchmarkSymbol: '^NSEI',
  setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
}));
