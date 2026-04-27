import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DesignVariant = 'v1' | 'v2';
export type WealthJourneyReturnPreset = 'cautious' | 'balanced' | 'growth' | 'custom';

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
  designVariant: DesignVariant;
  setDesignVariant: (variant: DesignVariant) => void;
  wealthJourney: WealthJourneyState;
  updateWealthJourney: (patch: Partial<WealthJourneyState>) => void;
  resetWealthJourney: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      defaultBenchmarkSymbol: '^NSEI',
      setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
      designVariant: 'v1' as DesignVariant,
      setDesignVariant: (variant) => set({ designVariant: variant }),
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
    },
  ),
);
