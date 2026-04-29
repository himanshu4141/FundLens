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

const WEALTH_JOURNEY_LIMITS = {
  maxSip: 25_00_000,
  maxTopUp: 10_00_00_000,
  maxYears: 40,
  maxExpectedReturn: 30,
  maxPostRetirementReturn: 20,
  maxWithdrawalRate: 12,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function clampNullableNumber(value: unknown, min: number, max: number): number | null {
  if (value == null) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, numeric));
}

function sanitizeWealthJourneyState(state: Partial<WealthJourneyState>): WealthJourneyState {
  const expectedReturnPreset: WealthJourneyReturnPreset | null =
    state.expectedReturnPreset === 'cautious' ||
    state.expectedReturnPreset === 'balanced' ||
    state.expectedReturnPreset === 'growth' ||
    state.expectedReturnPreset === 'custom'
      ? state.expectedReturnPreset
      : null;

  return {
    hasOpened: state.hasOpened === true,
    hasSavedPlan: state.hasSavedPlan === true,
    currentSipOverride: clampNullableNumber(
      state.currentSipOverride,
      0,
      WEALTH_JOURNEY_LIMITS.maxSip,
    ),
    futureSipTarget: clampNullableNumber(
      state.futureSipTarget,
      0,
      WEALTH_JOURNEY_LIMITS.maxSip,
    ),
    monthlySipIncrease: clampInteger(
      state.monthlySipIncrease,
      -WEALTH_JOURNEY_LIMITS.maxSip,
      WEALTH_JOURNEY_LIMITS.maxSip,
      DEFAULT_WEALTH_JOURNEY_STATE.monthlySipIncrease,
    ),
    additionalTopUp: clampInteger(
      state.additionalTopUp,
      0,
      WEALTH_JOURNEY_LIMITS.maxTopUp,
      DEFAULT_WEALTH_JOURNEY_STATE.additionalTopUp,
    ),
    yearsToRetirement: clampInteger(
      state.yearsToRetirement,
      1,
      WEALTH_JOURNEY_LIMITS.maxYears,
      DEFAULT_WEALTH_JOURNEY_STATE.yearsToRetirement,
    ),
    expectedReturn: clampNullableNumber(
      state.expectedReturn,
      0,
      WEALTH_JOURNEY_LIMITS.maxExpectedReturn,
    ),
    expectedReturnPreset,
    retirementDurationYears: clampInteger(
      state.retirementDurationYears,
      1,
      WEALTH_JOURNEY_LIMITS.maxYears,
      DEFAULT_WEALTH_JOURNEY_STATE.retirementDurationYears,
    ),
    withdrawalRate: clampNumber(
      state.withdrawalRate,
      1,
      WEALTH_JOURNEY_LIMITS.maxWithdrawalRate,
      DEFAULT_WEALTH_JOURNEY_STATE.withdrawalRate,
    ),
    postRetirementReturn: clampNullableNumber(
      state.postRetirementReturn,
      0,
      WEALTH_JOURNEY_LIMITS.maxPostRetirementReturn,
    ),
  };
}

function applyWealthJourneyPatch(
  state: WealthJourneyState,
  patch: Partial<WealthJourneyState>,
): WealthJourneyState {
  let changed = false;
  const next = sanitizeWealthJourneyState({ ...state, ...patch });

  for (const key of Object.keys(next) as (keyof WealthJourneyState)[]) {
    if (state[key] !== next[key]) {
      changed = true;
      break;
    }
  }

  return changed ? next : state;
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
    wealthJourney: sanitizeWealthJourneyState({
      ...DEFAULT_WEALTH_JOURNEY_STATE,
      ...(state.wealthJourney ?? {}),
    }),
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
        set((state) => {
          const wealthJourney = applyWealthJourneyPatch(state.wealthJourney, patch);
          return wealthJourney === state.wealthJourney ? state : { wealthJourney };
        }),
      resetWealthJourney: () => set({ wealthJourney: DEFAULT_WEALTH_JOURNEY_STATE }),
    }),
    {
      name: 'fundlens-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: migratePersistedAppState,
      merge: (persistedState, currentState) => {
        const state =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as PersistedAppStore)
            : {};
        return {
          ...currentState,
          defaultBenchmarkSymbol: state.defaultBenchmarkSymbol ?? currentState.defaultBenchmarkSymbol,
          appDesignMode: state.appDesignMode === 'classic' ? 'classic' : 'clearLens',
          wealthJourney: sanitizeWealthJourneyState({
            ...DEFAULT_WEALTH_JOURNEY_STATE,
            ...(state.wealthJourney ?? {}),
          }),
        };
      },
      partialize: (state) => ({
        defaultBenchmarkSymbol: state.defaultBenchmarkSymbol,
        appDesignMode: state.appDesignMode,
        wealthJourney: state.wealthJourney,
      }),
    },
  ),
);
