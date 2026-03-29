import { BENCHMARK_OPTIONS, useAppStore } from '../appStore';

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

describe('appStore', () => {
  it('defaults to the classic design variant', () => {
    expect(useAppStore.getState().designVariant).toBe('classic');
  });

  it('allows switching the design variant', () => {
    useAppStore.getState().setDesignVariant('editorial');
    expect(useAppStore.getState().designVariant).toBe('editorial');
    useAppStore.getState().setDesignVariant('classic');
  });
});
