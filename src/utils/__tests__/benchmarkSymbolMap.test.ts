import {
  BENCHMARK_DISCLOSURE,
  fundDetailBenchmarkOptions,
  resolveTRI,
  triLabel,
} from '../benchmarkSymbolMap';
import { BENCHMARK_OPTIONS } from '@/src/store/appStore';

describe('resolveTRI', () => {
  it('maps every supported PR symbol to its TRI counterpart', () => {
    expect(resolveTRI('^NSEI')).toBe('^NSEITRI');
    expect(resolveTRI('^NIFTY100')).toBe('^NIFTY100TRI');
    expect(resolveTRI('^NIFTY200')).toBe('^NIFTY200TRI');
    expect(resolveTRI('^NIFTY500')).toBe('^NIFTY500TRI');
    expect(resolveTRI('^NIFTYNEXT50')).toBe('^NIFTYNEXT50TRI');
    expect(resolveTRI('^NIFTYMIDCAP150')).toBe('^NIFTYMIDCAP150TRI');
    expect(resolveTRI('^NIFTYSMALLCAP250')).toBe('^NIFTYSMALLCAP250TRI');
    expect(resolveTRI('^NIFTYLMI250')).toBe('^NIFTYLMI250TRI');
    expect(resolveTRI('^NSEBANK')).toBe('^NSEBANKTRI');
    expect(resolveTRI('^CNXIT')).toBe('^CNXITTRI');
  });

  it('migrates BSE Sensex to Nifty 50 TRI (Sensex 30 large caps ≈ Nifty 50)', () => {
    expect(resolveTRI('^BSESN')).toBe('^NSEITRI');
  });

  it('treats Yahoo\'s ^CNX100 alias the same as ^NIFTY100', () => {
    expect(resolveTRI('^CNX100')).toBe('^NIFTY100TRI');
  });

  it('passes through TRI symbols unchanged', () => {
    expect(resolveTRI('^NSEITRI')).toBe('^NSEITRI');
    expect(resolveTRI('^NIFTY500TRI')).toBe('^NIFTY500TRI');
    expect(resolveTRI('^NIFTYMIDCAP150TRI')).toBe('^NIFTYMIDCAP150TRI');
  });

  it('passes through unknown / debt-index / CRISIL symbols unchanged', () => {
    expect(resolveTRI('CRISILUST')).toBe('CRISILUST');
    expect(resolveTRI('^NIFTYHYBRID6535')).toBe('^NIFTYHYBRID6535');
    expect(resolveTRI('^NIFTY1D')).toBe('^NIFTY1D');
    expect(resolveTRI('UNKNOWN_SYMBOL')).toBe('UNKNOWN_SYMBOL');
  });

  it('falls back to the first global benchmark for null / undefined / empty input', () => {
    const fallback = BENCHMARK_OPTIONS[0].symbol;
    expect(resolveTRI(null)).toBe(fallback);
    expect(resolveTRI(undefined)).toBe(fallback);
    expect(resolveTRI('')).toBe(fallback);
  });

  it('is idempotent: resolveTRI(resolveTRI(x)) === resolveTRI(x)', () => {
    for (const sym of ['^NSEI', '^BSESN', '^NIFTY100TRI', '^NSEITRI', 'UNKNOWN']) {
      expect(resolveTRI(resolveTRI(sym))).toBe(resolveTRI(sym));
    }
  });
});

describe('triLabel', () => {
  it('appends " TRI" to a plain index name', () => {
    expect(triLabel('Nifty 50')).toBe('Nifty 50 TRI');
    expect(triLabel('Nifty Midcap 150')).toBe('Nifty Midcap 150 TRI');
  });

  it('keeps an existing TRI suffix without doubling it', () => {
    expect(triLabel('Nifty 50 TRI')).toBe('Nifty 50 TRI');
    expect(triLabel('NIFTY 500 TRI')).toBe('NIFTY 500 TRI');
  });

  it('matches "TRI" case-insensitively', () => {
    expect(triLabel('nifty 50 tri')).toBe('nifty 50 tri');
    expect(triLabel('Nifty 50 Tri')).toBe('Nifty 50 Tri');
  });

  it('strips a trailing "Index" before appending TRI', () => {
    expect(triLabel('Nifty Midcap 150 Index')).toBe('Nifty Midcap 150 TRI');
  });

  it('returns empty string for null / undefined / blank', () => {
    expect(triLabel(null)).toBe('');
    expect(triLabel(undefined)).toBe('');
    expect(triLabel('   ')).toBe('');
  });
});

describe('fundDetailBenchmarkOptions', () => {
  it('returns global picks when fund has no benchmark assignment', () => {
    expect(fundDetailBenchmarkOptions(null)).toBe(BENCHMARK_OPTIONS);
    expect(fundDetailBenchmarkOptions(undefined)).toBe(BENCHMARK_OPTIONS);
    expect(fundDetailBenchmarkOptions({ benchmark_index_symbol: null }))
      .toBe(BENCHMARK_OPTIONS);
  });

  it('puts the fund\'s SEBI benchmark first when set', () => {
    const opts = fundDetailBenchmarkOptions({
      benchmark_index: 'Nifty Midcap 150 TRI',
      benchmark_index_symbol: '^NIFTYMIDCAP150',
    });
    expect(opts[0]).toEqual({ symbol: '^NIFTYMIDCAP150TRI', label: 'Nifty Midcap 150 TRI' });
  });

  it('appends the global picks after the fund\'s benchmark', () => {
    const opts = fundDetailBenchmarkOptions({
      benchmark_index: 'Nifty Midcap 150',
      benchmark_index_symbol: '^NIFTYMIDCAP150',
    });
    // First option is the fund's benchmark; rest are the globals
    expect(opts.slice(1)).toEqual(BENCHMARK_OPTIONS);
  });

  it('deduplicates when the fund\'s benchmark already matches a global pick', () => {
    const opts = fundDetailBenchmarkOptions({
      benchmark_index: 'Nifty 50',
      benchmark_index_symbol: '^NSEI',
    });
    // ^NSEI resolves to ^NSEITRI which is in BENCHMARK_OPTIONS — no duplicate
    const symbols = opts.map((o) => o.symbol);
    const unique = new Set(symbols);
    expect(unique.size).toBe(symbols.length);
    expect(opts[0].symbol).toBe('^NSEITRI');
  });

  it('uses the fund\'s display name when provided', () => {
    const opts = fundDetailBenchmarkOptions({
      benchmark_index: 'Nifty Smallcap 250 TRI',
      benchmark_index_symbol: '^NIFTYSMALLCAP250',
    });
    expect(opts[0].label).toBe('Nifty Smallcap 250 TRI');
  });

  it('synthesises a TRI label when the fund only has a PR display name', () => {
    const opts = fundDetailBenchmarkOptions({
      benchmark_index: 'Nifty 200',
      benchmark_index_symbol: '^NIFTY200',
    });
    expect(opts[0].label).toBe('Nifty 200 TRI');
  });
});

describe('BENCHMARK_DISCLOSURE', () => {
  it('is a non-empty single source of truth', () => {
    expect(BENCHMARK_DISCLOSURE.trim().length).toBeGreaterThan(20);
    expect(BENCHMARK_DISCLOSURE).toContain('total-return');
  });
});
