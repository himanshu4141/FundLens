import { BENCHMARK_OPTIONS, migratePersistedAppState } from '../appStore';

const DEFAULT_RETURN_ASSUMPTIONS = { cautious: 8, balanced: 12, growth: 12 };

const DEFAULT_WEALTH_JOURNEY = {
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

describe('BENCHMARK_OPTIONS', () => {
  it('contains exactly 3 entries — Nifty 50, Nifty 100, BSE Sensex', () => {
    expect(BENCHMARK_OPTIONS).toHaveLength(3);
    const symbols = BENCHMARK_OPTIONS.map((b) => b.symbol);
    expect(symbols).toEqual(['^NSEI', '^NIFTY100', '^BSESN']);
  });

  it('does not include short-history benchmarks that produce unreliable market XIRR', () => {
    const symbols = BENCHMARK_OPTIONS.map((b) => b.symbol);
    for (const removed of ['^BSE100', '^BSE500', '^NSEBANK', '^CNXIT']) {
      expect(symbols).not.toContain(removed);
    }
  });

  it('each option has a non-empty label', () => {
    for (const opt of BENCHMARK_OPTIONS) {
      expect(opt.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('appDesignMode persistence migration', () => {
  it('defaults missing persisted state to Clear Lens and initializes Wealth Journey state', () => {
    expect(migratePersistedAppState(null)).toEqual({
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('preserves clearLens mode when already stored', () => {
    expect(migratePersistedAppState({ appDesignMode: 'clearLens' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('migrates old Editorial v1/v2 designVariant values to Clear Lens', () => {
    expect(migratePersistedAppState({ designVariant: 'v1' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
    expect(migratePersistedAppState({ designVariant: 'v2' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('preserves explicit classic mode when stored', () => {
    expect(migratePersistedAppState({ appDesignMode: 'classic' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'classic',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('preserves benchmark preference during migration', () => {
    expect(migratePersistedAppState({ defaultBenchmarkSymbol: '^BSESN', designVariant: 'v2' })).toEqual({
      defaultBenchmarkSymbol: '^BSESN',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('preserves existing Wealth Journey state during migration', () => {
    expect(migratePersistedAppState({
      appDesignMode: 'clearLens',
      wealthJourney: {
        hasOpened: true,
        hasSavedPlan: true,
        currentSipOverride: 75000,
        futureSipTarget: 125000,
        yearsToRetirement: 20,
      },
    })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: {
        ...DEFAULT_WEALTH_JOURNEY,
        hasOpened: true,
        hasSavedPlan: true,
        currentSipOverride: 75000,
        futureSipTarget: 125000,
        yearsToRetirement: 20,
      },
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('sanitizes out-of-range Wealth Journey values during migration', () => {
    expect(migratePersistedAppState({
      appDesignMode: 'clearLens',
      wealthJourney: {
        hasOpened: true,
        hasSavedPlan: true,
        currentSipOverride: 99_00_00_000,
        futureSipTarget: -100,
        monthlySipIncrease: -99_00_00_000,
        additionalTopUp: 99_00_00_000,
        yearsToRetirement: 1000,
        expectedReturn: 100,
        expectedReturnPreset: 'balanced',
        retirementDurationYears: 1000,
        withdrawalRate: 100,
        postRetirementReturn: 100,
      },
    })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: {
        ...DEFAULT_WEALTH_JOURNEY,
        hasOpened: true,
        hasSavedPlan: true,
        currentSipOverride: 25_00_000,
        futureSipTarget: 0,
        monthlySipIncrease: -25_00_000,
        additionalTopUp: 10_00_00_000,
        yearsToRetirement: 40,
        expectedReturn: 30,
        expectedReturnPreset: 'balanced',
        retirementDurationYears: 40,
        withdrawalRate: 12,
        postRetirementReturn: 20,
      },
      returnAssumptions: DEFAULT_RETURN_ASSUMPTIONS,
      goals: [],
    });
  });

  it('preserves valid returnAssumptions from persisted state', () => {
    const result = migratePersistedAppState({
      returnAssumptions: { cautious: 7, balanced: 11, growth: 14 },
    });
    expect(result.returnAssumptions).toEqual({ cautious: 7, balanced: 11, growth: 14 });
  });

  it('falls back to defaults for invalid returnAssumptions', () => {
    expect(migratePersistedAppState({ returnAssumptions: null }).returnAssumptions)
      .toEqual(DEFAULT_RETURN_ASSUMPTIONS);
    expect(migratePersistedAppState({ returnAssumptions: 'bad' }).returnAssumptions)
      .toEqual(DEFAULT_RETURN_ASSUMPTIONS);
  });

  it('clamps out-of-range returnAssumptions values', () => {
    const result = migratePersistedAppState({
      returnAssumptions: { cautious: 0, balanced: 50, growth: -5 },
    });
    expect(result.returnAssumptions!.cautious).toBe(1);
    expect(result.returnAssumptions!.balanced).toBe(30);
    expect(result.returnAssumptions!.growth).toBe(1);
  });

  it('migrates persisted goals, preserving valid ones and dropping corrupt ones', () => {
    const result = migratePersistedAppState({
      goals: [
        {
          id: 'g-1',
          name: 'Retirement',
          targetAmount: 1_00_00_000,
          targetDate: '2040-01-01',
          lumpSum: 5_00_000,
          currentMonthly: 25_000,
          returnPreset: 'growth',
          createdAt: '2025-01-01T00:00:00Z',
        },
        null,
        { id: '', name: 'Bad' },
      ],
    });
    expect(result.goals).toHaveLength(1);
    expect(result.goals![0].name).toBe('Retirement');
    expect(result.goals![0].returnPreset).toBe('growth');
  });

  it('defaults invalid returnPreset in goal to balanced', () => {
    const result = migratePersistedAppState({
      goals: [{ id: 'g-1', name: 'Test', returnPreset: 'aggressive' }],
    });
    expect(result.goals![0].returnPreset).toBe('balanced');
  });
});

/**
 * Headline delta formula contract
 *
 * portfolioXirr and marketXirr are DECIMAL fractions (e.g. 0.128 = 12.8%).
 * The PortfolioHeader displays "X.X% ahead/behind" by computing:
 *   delta = Math.abs((xirrRate - marketXirr) * 100)
 *
 * Without the * 100, a 2.84% lead would show as "0.0% ahead" because
 * 0.0284.toFixed(1) === "0.0".
 */
describe('headline delta formula', () => {
  function computeHeadlineDelta(xirrRate: number, marketXirr: number): number {
    return Math.abs((xirrRate - marketXirr) * 100);
  }

  it('renders the correct percentage point difference for realistic XIRRs', () => {
    // Portfolio XIRR 12.80%, Nifty 50 XIRR 9.96% → 2.84% ahead
    const delta = computeHeadlineDelta(0.128, 0.0996);
    expect(delta.toFixed(1)).toBe('2.8');
  });

  it('shows the correct percentage when lagging', () => {
    // Portfolio XIRR 10%, Nifty 100 XIRR 51% → 41.0% behind
    const delta = computeHeadlineDelta(0.10, 0.51);
    expect(delta.toFixed(1)).toBe('41.0');
  });

  it('without * 100 the old bug returns 0.0 for typical XIRR differences', () => {
    // Demonstrates why * 100 is required
    const buggyDelta = Math.abs(0.128 - 0.0996);
    expect(buggyDelta.toFixed(1)).toBe('0.0'); // the old broken behaviour
  });

  it('delta is 0.0 when portfolio exactly matches the benchmark', () => {
    expect(computeHeadlineDelta(0.15, 0.15)).toBe(0);
  });
});
