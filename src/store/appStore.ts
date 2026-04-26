import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WealthJourneyReturnPreset = 'cautious' | 'balanced' | 'growth' | 'custom';
export type AppDesignMode = 'classic' | 'clearLens';

export interface BenchmarkOption {
  symbol: string;
  label: string;
}

export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEI',     label: 'Nifty 50' },
  { symbol: '^NIFTY100', label: 'Nifty 100' },
  { symbol: '^BSESN',    label: 'BSE Sensex' },
];

export interface WealthJourneyState {
  hasOpened: boolean;
  hasSavedPlan: boolean;
  currentSipOverride: number | null;
  futureSipTarget: number | null;
  monthlySipIncrease: number;
  additionalTopUp: number;
  yearsToRetirement: number;
  expectedReturn: number | null;
  expectedReturnPreset: WealthJourneyReturnPreset | null;
  retirementDurationYears: number;
  withdrawalRate: number;
  postRetirementReturn: number | null;
}

const DEFAULT_WEALTH_JOURNEY_STATE: WealthJourneyState = {
  hasOpened: false,
  hasSavedPlan: false,
  currentSipOverride: null,
  futureSipTarget: null,
  monthlySipIncrease: 0,
  additionalTopUp: 0,
  yearsToRetirement: 15,
  expectedReturn: null,
  expectedReturnPreset: null,
  retirementDurationYears: 25,
  withdrawalRate: 4,
  postRetirementReturn: null,
};

interface AppStore {
  defaultBenchmarkSymbol: string;
  setDefaultBenchmarkSymbol: (symbol: string) => void;
  appDesignMode: AppDesignMode;
  setAppDesignMode: (mode: AppDesignMode) => void;
  wealthJourney: WealthJourneyState;
  updateWealthJourney: (patch: Partial<WealthJourneyState>) => void;
  resetWealthJourney: () => void;
}

type PersistedAppStore = Partial<AppStore> & {
  designVariant?: 'v1' | 'v2';
};

export function migratePersistedAppState(persistedState: unknown): Partial<AppStore> {
  if (!persistedState || typeof persistedState !== 'object') {
    return {
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY_STATE,
    };
  }

  const state = persistedState as PersistedAppStore;
  const appDesignMode: AppDesignMode =
    state.appDesignMode === 'classic' ? 'classic' : 'clearLens';

  return {
    defaultBenchmarkSymbol: state.defaultBenchmarkSymbol ?? '^NSEI',
    appDesignMode,
    wealthJourney: {
      ...DEFAULT_WEALTH_JOURNEY_STATE,
      ...(state.wealthJourney ?? {}),
    },
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      defaultBenchmarkSymbol: '^NSEI',
      setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
      appDesignMode: 'clearLens' as AppDesignMode,
      setAppDesignMode: (mode) => set({ appDesignMode: mode }),
      wealthJourney: DEFAULT_WEALTH_JOURNEY_STATE,
      updateWealthJourney: (patch) =>
        set((state) => ({
          wealthJourney: { ...state.wealthJourney, ...patch },
        })),
      resetWealthJourney: () => set({ wealthJourney: DEFAULT_WEALTH_JOURNEY_STATE }),
    }),
    {
      name: 'fundlens-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: migratePersistedAppState,
      partialize: (state) => ({
        defaultBenchmarkSymbol: state.defaultBenchmarkSymbol,
        appDesignMode: state.appDesignMode,
        wealthJourney: state.wealthJourney,
      }),
    },
  ),
);
