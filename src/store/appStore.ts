import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface BenchmarkOption {
  symbol: string;
  label: string;
}

export type DesignVariant = 'classic' | 'editorial';

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEI', label: 'Nifty 50' },
  { symbol: '^NIFTY100', label: 'Nifty 100' },
  { symbol: '^BSESN', label: 'BSE Sensex' },
];

interface PersistedAppState {
  defaultBenchmarkSymbol: string;
  designVariant: DesignVariant;
}

interface AppStore extends PersistedAppState {
  setDefaultBenchmarkSymbol: (symbol: string) => void;
  setDesignVariant: (variant: DesignVariant) => void;
}

const STORAGE_KEY = 'fundlens-app';
const DEFAULT_STATE: PersistedAppState = {
  defaultBenchmarkSymbol: '^NSEI',
  designVariant: 'classic',
};

const memoryStore = new Map<string, string>();

function isWebRuntime() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function isReactNativeRuntime() {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

function parsePersistedState(raw: string | null): PersistedAppState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    return {
      defaultBenchmarkSymbol: parsed.defaultBenchmarkSymbol ?? DEFAULT_STATE.defaultBenchmarkSymbol,
      designVariant: parsed.designVariant ?? DEFAULT_STATE.designVariant,
    };
  } catch {
    return null;
  }
}

function getInitialPersistedState(): PersistedAppState {
  if (isWebRuntime()) {
    return parsePersistedState(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_STATE;
  }

  return DEFAULT_STATE;
}

async function readPersistedState(): Promise<PersistedAppState | null> {
  let raw: string | null = null;

  if (isWebRuntime()) {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } else if (isReactNativeRuntime()) {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } else {
    raw = memoryStore.get(STORAGE_KEY) ?? null;
  }

  return parsePersistedState(raw);
}

async function persistState(state: PersistedAppState) {
  const value = JSON.stringify(state);

  if (isWebRuntime()) {
    window.localStorage.setItem(STORAGE_KEY, value);
    return;
  }

  if (isReactNativeRuntime()) {
    await AsyncStorage.setItem(STORAGE_KEY, value);
    return;
  }

  memoryStore.set(STORAGE_KEY, value);
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...getInitialPersistedState(),
  setDefaultBenchmarkSymbol: (symbol) => {
    set({ defaultBenchmarkSymbol: symbol });
    void persistState({
      defaultBenchmarkSymbol: symbol,
      designVariant: get().designVariant,
    });
  },
  setDesignVariant: (variant) => {
    set({ designVariant: variant });
    void persistState({
      defaultBenchmarkSymbol: get().defaultBenchmarkSymbol,
      designVariant: variant,
    });
  },
}));

void readPersistedState().then((persisted) => {
  if (!persisted) return;
  useAppStore.setState(persisted);
});
