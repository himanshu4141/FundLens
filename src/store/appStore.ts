import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export interface BenchmarkOption {
  symbol: string;
  label: string;
}

export type DesignVariant = 'classic' | 'editorial';

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEI',     label: 'Nifty 50' },
  { symbol: '^NIFTY100', label: 'Nifty 100' },
  { symbol: '^BSESN',    label: 'BSE Sensex' },
];

interface AppStore {
  defaultBenchmarkSymbol: string;
  designVariant: DesignVariant;
  setDefaultBenchmarkSymbol: (symbol: string) => void;
  setDesignVariant: (variant: DesignVariant) => void;
}

const memoryStore = new Map<string, string>();

function isReactNativeRuntime() {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

async function getNativeAsyncStorage() {
  return (await import('@react-native-async-storage/async-storage')).default;
}

const appStateStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(name);
    }
    if (isReactNativeRuntime()) {
      return (await getNativeAsyncStorage()).getItem(name);
    }
    return memoryStore.get(name) ?? null;
  },
  setItem: async (name, value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(name, value);
      return;
    }
    if (isReactNativeRuntime()) {
      await (await getNativeAsyncStorage()).setItem(name, value);
      return;
    }
    memoryStore.set(name, value);
  },
  removeItem: async (name) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(name);
      return;
    }
    if (isReactNativeRuntime()) {
      await (await getNativeAsyncStorage()).removeItem(name);
      return;
    }
    memoryStore.delete(name);
  }
};

const storage = createJSONStorage(() => appStateStorage);

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      defaultBenchmarkSymbol: '^NSEI',
      designVariant: 'classic',
      setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
      setDesignVariant: (variant) => set({ designVariant: variant }),
    }),
    {
      name: 'fundlens-app',
      storage,
      partialize: (state) => ({
        defaultBenchmarkSymbol: state.defaultBenchmarkSymbol,
        designVariant: state.designVariant,
      }),
    },
  ),
);
