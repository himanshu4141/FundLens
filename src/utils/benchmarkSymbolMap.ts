/**
 * Phase 8 — Total Return benchmark symbol resolution.
 *
 * Mutual fund NAVs are inherently total-return. Comparing a fund's NAV to a
 * price-return index is structurally unfair to the index. SEBI mandates TRI
 * on every fund factsheet, so the rest of the app needs to follow suit.
 *
 * The data layer (Edge Function `sync-index`) ingests TRI rows under
 * dedicated symbol keys (see `NSE_TRI_NAME_MAP` in the function for the full
 * list). This module is the app-side mapping that lets every benchmark
 * consumer call `resolveTRI(symbolFromDB)` and get the correct TRI symbol
 * to query, without each hook needing to know the mapping.
 *
 * Exported helpers:
 *   - `resolveTRI(symbol)` — maps a PR or unknown symbol to its TRI
 *     counterpart. TRI symbols pass through untouched.
 *   - `triLabel(name, symbol)` — formats the user-visible label so we can
 *     consistently show "Nifty 50 TRI" everywhere.
 *   - `fundDetailBenchmarkOptions(fund)` — for the Fund Detail Performance
 *     tab picker: returns the fund's own SEBI-mandated benchmark TRI as the
 *     first option (the same comparison the fund's factsheet uses), followed
 *     by the global picks from `BENCHMARK_OPTIONS`.
 *   - `BENCHMARK_DISCLOSURE` — single source of truth for the chart footnote.
 */
import { BENCHMARK_OPTIONS, type BenchmarkOption } from '@/src/store/appStore';

const PR_TO_TRI: Record<string, string> = {
  '^NSEI':              '^NSEITRI',
  '^NIFTY100':          '^NIFTY100TRI',
  '^NIFTY200':          '^NIFTY200TRI',
  '^NIFTY500':          '^NIFTY500TRI',
  '^NIFTYNEXT50':       '^NIFTYNEXT50TRI',
  '^NIFTYMIDCAP150':    '^NIFTYMIDCAP150TRI',
  '^NIFTYSMALLCAP250':  '^NIFTYSMALLCAP250TRI',
  '^NIFTYLMI250':       '^NIFTYLMI250TRI',
  '^NSEBANK':           '^NSEBANKTRI',
  '^CNXIT':             '^CNXITTRI',
  // BSE has no free TRI source — Sensex's 30 large caps are closest in
  // profile to Nifty 50 (50 large caps), so we route legacy ^BSESN
  // selections to Nifty 50 TRI.
  '^BSESN':             '^NSEITRI',
  // Yahoo's '^CNX100' alias for Nifty 100 PR — same target.
  '^CNX100':            '^NIFTY100TRI',
};

const TRI_SYMBOL_SET = new Set(Object.values(PR_TO_TRI));

/**
 * Returns the TRI symbol for the given input.
 *  - PR symbol with a known mapping → corresponding TRI symbol.
 *  - TRI symbol → returned unchanged.
 *  - Anything else (null, unknown PR symbol, debt index) → returned unchanged
 *    so callers reading from `index_history` still get an answer for whatever
 *    they have. Hooks that need a guaranteed-TRI symbol should fall back to
 *    `BENCHMARK_OPTIONS[0].symbol` themselves.
 */
export function resolveTRI(symbol: string | null | undefined): string {
  if (!symbol) return BENCHMARK_OPTIONS[0].symbol;
  if (TRI_SYMBOL_SET.has(symbol)) return symbol;
  return PR_TO_TRI[symbol] ?? symbol;
}

/**
 * Formats the user-visible label for a TRI benchmark.
 *
 * Strategy:
 *  1. If the canonical name already contains "TRI" or "(TRI)", use it as-is.
 *  2. If it contains "TRI" inside another phrase (e.g. "TRI" already there),
 *     trust it.
 *  3. Otherwise, strip any trailing "Index" suffix and append " TRI".
 *
 * Examples:
 *   - "Nifty 50 TRI" → "Nifty 50 TRI"
 *   - "Nifty 50" → "Nifty 50 TRI"
 *   - "Nifty Midcap 150 Index" → "Nifty Midcap 150 TRI"
 */
export function triLabel(rawName: string | null | undefined): string {
  const name = (rawName ?? '').trim();
  if (!name) return '';
  if (/\bTRI\b/i.test(name)) return name;
  const stripped = name.replace(/\s+Index$/i, '').trim();
  return `${stripped} TRI`;
}

interface FundLike {
  benchmark_index?: string | null;
  benchmark_index_symbol?: string | null;
}

/**
 * Returns the picker options for the Fund Detail Performance tab benchmark
 * dropdown. The fund's own SEBI-mandated benchmark (resolved to TRI) is the
 * first option; the global picks follow, deduplicated against it.
 *
 * If the fund has no `benchmark_index_symbol` we fall back to the global
 * picks alone — same behaviour the screen had before this picker existed.
 */
export function fundDetailBenchmarkOptions(fund: FundLike | null | undefined): BenchmarkOption[] {
  const fundSymbolRaw = fund?.benchmark_index_symbol ?? null;
  if (!fundSymbolRaw) return BENCHMARK_OPTIONS;

  const fundSymbol = resolveTRI(fundSymbolRaw);
  const fundLabel = triLabel(fund?.benchmark_index ?? fundSymbolRaw);
  const fundOption: BenchmarkOption = { symbol: fundSymbol, label: fundLabel };

  const globals = BENCHMARK_OPTIONS.filter((g) => g.symbol !== fundSymbol);
  return [fundOption, ...globals];
}

/**
 * Single source of truth for the disclosure footnote rendered under any
 * benchmark chart. Wired in Portfolio, Fund Detail, and Past SIP Check.
 */
export const BENCHMARK_DISCLOSURE =
  'Benchmark is the total-return variant — dividends reinvested, per SEBI factsheet convention.';
