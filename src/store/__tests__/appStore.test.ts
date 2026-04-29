import { BENCHMARK_OPTIONS, migratePersistedAppState } from '../appStore';

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
    });
  });

  it('preserves clearLens mode when already stored', () => {
    expect(migratePersistedAppState({ appDesignMode: 'clearLens' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
    });
  });

  it('migrates old Editorial v1/v2 designVariant values to Clear Lens', () => {
    expect(migratePersistedAppState({ designVariant: 'v1' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
    });
    expect(migratePersistedAppState({ designVariant: 'v2' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
    });
  });

  it('preserves explicit classic mode when stored', () => {
    expect(migratePersistedAppState({ appDesignMode: 'classic' })).toEqual({
      defaultBenchmarkSymbol: '^NSEI',
      appDesignMode: 'classic',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
    });
  });

  it('preserves benchmark preference during migration', () => {
    expect(migratePersistedAppState({ defaultBenchmarkSymbol: '^BSESN', designVariant: 'v2' })).toEqual({
      defaultBenchmarkSymbol: '^BSESN',
      appDesignMode: 'clearLens',
      wealthJourney: DEFAULT_WEALTH_JOURNEY,
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
    });
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
