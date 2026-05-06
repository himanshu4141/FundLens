# Phase 8 / M1 — TRI data ingestion and app-wide cutover


## Goal


Replace every benchmark surface in FolioLens — Portfolio chart, Portfolio header alpha, Fund Detail Performance tab, Leaderboard, Settings benchmark picker, and the in-flight Tools Hub stack — with total-return (TRI) index data. Use **NSE Indices direct as the primary source** and **EODHD as the fallback** so a single upstream outage doesn't blank our charts. Track the source per row in `index_history` so primary-source data wins on convergence and operators have diagnostic visibility. Backfill 25+ years of history from the primary. Wire daily sync. Drop BSE Sensex from `BENCHMARK_OPTIONS`. Add the **fund's SEBI-mandated benchmark** as a first-class option in the Fund Detail picker. Ship in a single PR off `main`.


## User Value


A FolioLens user asks "did my fund beat the market?" and gets an honest, factsheet-matched answer for the first time. Today's PR-shaped benchmark systematically understates the market by 1.5–2% per year compounding. Switching to TRI fixes the reported alpha across every surface that compares against an index, and surfacing the fund's own SEBI-mandated benchmark on Fund Detail makes the comparison the same one the fund itself reports. See `docs/product/total-return-benchmarks-prd.md` for product reasoning.


## Context


This work is a prerequisite for the Tools Hub stack currently in flight:

- PR #99 — Phase 4 M2 Past SIP Check (ships pointing at PR symbols today; will rebase onto this branch and consume TRI symbols)
- PR #100 — Phase 4 M3 Compare Funds (same)
- PR #101 — Phase 4 M4 Direct vs Regular Impact (benchmark-independent; rebases without conflict)

It also touches the already-shipped Portfolio, Fund Detail, and Leaderboard screens — they need their benchmark reads swapped in the same PR so the user never sees a half-converted app.


### Discovery summary (verified live, see PRD appendix for full results)

- **Yahoo Finance** does not serve any Indian TRI symbol — confirmed via 24 live probes; either 404 or 200-with-zero-rows.
- **EODHD** free tier could not be live-probed (daily quota exhausted at session start). Re-test after quota reset; we expect partial coverage of TRI variants. EODHD's role here is as a **paid backup**, not the primary source — even partial coverage is enough to keep the app working through an NSE outage.
- **NSE Indices** (`niftyindices.com/Backpage.aspx/getTotalReturnIndexString`) — POST endpoint, no auth, returns gross TRI **and** NTR for any Nifty equity index in a single JSON payload. Tested: returns 6,677 daily rows for Nifty 50 TRI from 1999-06-30 through 2026-05-05 in one ~1MB response.
- **BSE** APIs are bot-protected. No free TRI source. Decision: drop BSE Sensex from `BENCHMARK_OPTIONS` (migrate users to Nifty 50 TRI — see Step 2).
- **CRISIL debt indices** out of scope for this milestone — no debt-fund tools in flight.


### New / changed files (high-level)

```
supabase/functions/sync-index/index.ts        — NSE TRI primary fetcher + EODHD backup wiring; per-row source tagging
supabase/migrations/<ts>_index_history_source_and_ntr.sql
                                              — add `source` text column + `ntr_value` numeric column
src/store/appStore.ts                         — BENCHMARK_OPTIONS swap; persisted-state migration v6 (^BSESN → ^NSEITRI)
src/utils/benchmarkSymbolMap.ts               — new util: resolveTRI(), source priority enum, fund-benchmark resolver
src/utils/__tests__/benchmarkSymbolMap.test.ts
                                              — unit tests for symbol resolution + priority ordering
src/hooks/usePortfolioTimeline.ts             — read TRI symbols
src/hooks/useInvestmentVsBenchmarkTimeline.ts — read TRI symbols
src/hooks/usePortfolio.ts                     — market-XIRR cashflow set off TRI
src/hooks/useFundDetail.ts                    — exposes fund's SEBI-mandated benchmark TRI alongside global picks
src/hooks/useCompare.ts                       — Compare-screen benchmark column → TRI
src/components/clearLens/screens/clearLensFundDetailScreen.tsx
                                              — Performance tab benchmark dropdown gains the fund's own benchmark
                                                as the first option (default-selected)
src/components/clearLens/screens/             — chart legend label updates ("Nifty 50 TRI")
src/components/clearLens/screens/tools/       — Past SIP Check, Compare Funds tools (will rebase)
docs/product/total-return-benchmarks-prd.md   — PRD (Phase 8)
docs/plans/phase-8-total-return-benchmarks/   — this file
```


## Assumptions


1. NSE's `getTotalReturnIndexString` endpoint is stable infrastructure for niftyindices.com but can fail transiently. The backup fetcher (EODHD) absorbs that failure mode; we never assume NSE is always available.
2. TRI history start dates per index are fixed (NSE doesn't backfill further). We record the earliest date per index in code or a tiny migration so screens can detect "you asked for 30Y, this index only has 25Y of TRI."
3. The price-only series in `index_history` is left in place for reference but unread. No data is deleted. PR rows are left tagged `source = 'unknown'` since we don't know which fetcher historically supplied them — irrelevant since they're no longer consumed by UI.
4. We are pre-launch — friends-and-family only. No user migration cost. No release notes required externally.
5. The existing `sync-index` Edge Function is the right place to add TRI fetching (single function, deployed via MCP, scheduled daily by pg_cron). It already has an EODHD code path we'll extend.
6. EODHD covers at least the headline TRI symbols (Nifty 50 TRI, Nifty 100 TRI, Nifty 500 TRI). To be verified live in M1.2; if any specific symbol is uncovered, we ship without a backup for that symbol and accept the risk of an NSE-only failure mode for it.


## Definitions


- **PR (Price Return)** — the index level reflects only price change. Dividends are dropped.
- **TR / TRI (Total Return Index)** — index level reflects price change plus gross dividend reinvestment.
- **NTR / NTRI (Net Total Return)** — TRI minus a withholding-tax assumption. Persisted but not consumed yet.
- **Cutover** — the single-PR moment when every benchmark consumer in the app reads from TRI instead of PR.


## Scope


### In scope (this milestone)

- Backfill TRI for **10 Nifty equity indices**, all of which NSE serves: Nifty 50, Nifty 100, Nifty 200, Nifty 500, Nifty Next 50, Nifty Midcap 150, Nifty Smallcap 250, Nifty LargeMidcap 250, Nifty Bank, Nifty IT.
- **Primary + backup data sources:** NSE direct as the primary fetcher; EODHD as the paid fallback (already wired in the existing function). Per-row `source` column in `index_history` records which source supplied each row. On every successful primary sync, primary-source data overwrites backup-source data for the same `(symbol, date)`.
- Daily incremental sync for the same 10 indices, exercising both fetchers per symbol.
- Persisting NTR alongside gross TRI (NSE returns both — opportunistic capture).
- App-wide swap: every UI consumer of benchmark data reads TRI symbols.
- Drop BSE Sensex from `BENCHMARK_OPTIONS`. Migrate persisted preference `^BSESN → ^NSEITRI` (Nifty 50 TRI — Sensex's 30 large caps are closer to Nifty 50's 50 large caps than to the broader Nifty 100/500).
- **Fund Detail benchmark dropdown extended:** the fund's SEBI-mandated benchmark (resolved from `scheme_master.benchmark_index_symbol` to its TRI variant) is added as the first option and selected by default; the global picks remain available below it.
- One source-of-truth disclosure string under benchmark charts: *"Benchmark is the total-return variant — dividends reinvested, per SEBI factsheet convention."*
- Chart legend rename: "Nifty 50" → "Nifty 50 TRI" everywhere.


### Out of scope (this milestone)

- BSE Sensex / BSE 100 / BSE 500 TRI — no free source; not blocking any current feature.
- CRISIL debt indices — not used by any equity-tool in flight.
- Hybrid / Liquid / Arbitrage TRI — these indices have no PR/TR distinction by construction.
- Tracking-error modeling ("TRI minus 20bps"). See PRD risks section.
- Forward-looking surfaces (Wealth Journey assumed-return projections).


## Approach


### Step 1 — Data layer: primary NSE + EODHD backup, source-tagged

Update `supabase/functions/sync-index/index.ts` with two new fetcher paths and a per-row `source` tag so we know which feed supplied each row.


#### Schema changes

```sql
-- supabase/migrations/<ts>_index_history_source_and_ntr.sql
ALTER TABLE index_history
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ntr_value numeric;

-- 'nse' > 'eodhd' > 'yahoo' — checked in app code, not in DB.
```

NTR rides as a nullable column on the existing row (NSE returns it alongside TRI; we capture it opportunistically). `source` defaults to `'unknown'` for legacy PR rows so they stay readable without a backfill.


#### Symbol map

```ts
// supabase/functions/sync-index/index.ts (sketch)

const NSE_TRI_NAME_MAP: Record<string, string> = {
  '^NSEITRI':            'NIFTY 50',
  '^NIFTY100TRI':        'NIFTY 100',
  '^NIFTY200TRI':        'NIFTY 200',
  '^NIFTY500TRI':        'NIFTY 500',
  '^NIFTYNEXT50TRI':     'NIFTY NEXT 50',
  '^NIFTYMIDCAP150TRI':  'NIFTY MIDCAP 150',
  '^NIFTYSMALLCAP250TRI':'NIFTY SMALLCAP 250',
  '^NIFTYLMI250TRI':     'NIFTY LARGEMIDCAP 250',
  '^NSEBANKTRI':         'NIFTY BANK',
  '^CNXITTRI':           'NIFTY IT',
};

// EODHD codes for the same TRI universe — to be confirmed during M1.1
// (free quota was exhausted at discovery time). If a code returns nothing,
// that symbol simply has no backup; we log and continue.
const EODHD_TRI_SYMBOL_MAP: Record<string, string | null> = {
  '^NSEITRI':            'NIFTY50TR.INDX',     // best-guess; verify live
  '^NIFTY100TRI':        'NIFTY100TR.INDX',
  '^NIFTY500TRI':        'NIFTY500TR.INDX',
  // ... others to fill in after live probe
};

const SOURCE_PRIORITY = { nse: 30, eodhd: 20, yahoo: 10, unknown: 0 } as const;
```


#### Primary fetcher — NSE

```ts
async function fetchFromNSE(name: string, fromDateDDMMMYYYY: string, toDateDDMMMYYYY: string) {
  const body = JSON.stringify({
    cinfo: JSON.stringify({
      name, indexName: name,
      startDate: fromDateDDMMMYYYY,
      endDate: toDateDDMMMYYYY,
    }),
  });
  const res = await fetch('https://www.niftyindices.com/Backpage.aspx/getTotalReturnIndexString', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; FolioLens/1.0)',
      'Referer': 'https://www.niftyindices.com/',
    },
    body,
  });
  if (!res.ok) throw new Error(`NSE HTTP ${res.status}`);
  const wrapper = await res.json() as { d: string };
  const rows = JSON.parse(wrapper.d) as Array<{
    Date: string; TotalReturnsIndex: string; NTR_Value: string;
  }>;
  return rows.map((r) => ({
    date: parseDDMMMYYYY(r.Date),                 // "05 Jan 2024" → "2024-01-05"
    closeTri: parseFloat(r.TotalReturnsIndex),
    closeNtr: r.NTR_Value === '-' ? null : parseFloat(r.NTR_Value),
  })).filter((r) => Number.isFinite(r.closeTri));
}
```


#### Per-symbol orchestration: try primary, fall back, source-tag

For each TRI symbol, the function attempts primary, then backup, **independently** — a transient failure in one path must not block the other. Rows from each successful path are upserted with `ON CONFLICT (index_symbol, index_date)` semantics that respect source priority:

```sql
-- conceptual upsert: only overwrite if incoming source has equal or higher priority
INSERT INTO index_history (index_symbol, index_date, close_value, ntr_value, source)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (index_symbol, index_date) DO UPDATE
  SET close_value = EXCLUDED.close_value,
      ntr_value   = COALESCE(EXCLUDED.ntr_value, index_history.ntr_value),
      source      = EXCLUDED.source
  WHERE source_priority(EXCLUDED.source) >= source_priority(index_history.source);
```

`source_priority` is implemented in code (the function builds two batches — one to insert when no row exists, one to update when the new source ties or beats the existing one). This keeps the SQL portable and the priority table in TypeScript where it's easy to extend.


#### Backfill and daily refresh

Backfill is a one-call-per-symbol POST to NSE with `startDate = "01-Jan-1990"`. The endpoint clamps to the actual earliest TRI date per index. ~10 calls total; entire 25+ year dataset for our universe ingests in seconds.

Daily incremental sync runs the same POST with `startDate = today - 5 days` and upserts. The 5-day overlap covers weekends and any intermittent NSE outage. EODHD backup runs in the same loop, with rows tagged `source = 'eodhd'` — if NSE is up, the priority rule means the EODHD row never lands; if NSE is down, EODHD's row is the user-visible one until the next NSE-success day.


### Step 2 — App layer cutover

Single-PR swap of every benchmark symbol consumer:

```ts
// src/store/appStore.ts
export const BENCHMARK_OPTIONS: BenchmarkOption[] = [
  { symbol: '^NSEITRI',       label: 'Nifty 50 TRI' },
  { symbol: '^NIFTY100TRI',   label: 'Nifty 100 TRI' },
  { symbol: '^NIFTY500TRI',   label: 'Nifty 500 TRI' },
];
```

Add a persisted-state migration to `version: 6` that maps `^NSEI`, `^NIFTY100`, `^BSESN` to their TRI counterparts. **Sensex users migrate to `^NSEITRI`** (Nifty 50 TRI) — Sensex's 30 large caps are closer in profile to Nifty 50's 50 large caps than to the broader Nifty 100/500.

Every hook that resolves a benchmark symbol gets exactly one of two changes:
1. The default symbol it falls back to is now a TRI symbol.
2. If a fund's `benchmark_index_symbol` (in `scheme_master`) is a PR symbol, the hook maps to the TRI counterpart at read time. (This avoids touching `scheme_master` rows; the mapping is one-line and trivially testable.)

```ts
// src/utils/benchmarkSymbolMap.ts (new, ~30 lines including the dropdown helper)
const PR_TO_TRI: Record<string, string> = {
  '^NSEI':            '^NSEITRI',
  '^NIFTY100':        '^NIFTY100TRI',
  '^NIFTY500':        '^NIFTY500TRI',
  '^NIFTYMIDCAP150':  '^NIFTYMIDCAP150TRI',
  '^NIFTYSMALLCAP250':'^NIFTYSMALLCAP250TRI',
  '^NIFTYLMI250':     '^NIFTYLMI250TRI',
  '^NSEBANK':         '^NSEBANKTRI',
  '^CNXIT':           '^CNXITTRI',
  '^BSESN':           '^NSEITRI',     // Sensex → Nifty 50 TRI (closest large-cap equivalent)
};
export function resolveTRI(symbol: string | null | undefined): string {
  if (!symbol) return BENCHMARK_OPTIONS[0].symbol;
  return PR_TO_TRI[symbol] ?? symbol;
}

// Fund Detail dropdown — fund's own SEBI benchmark first, then the global picks
export function fundDetailBenchmarkOptions(
  fund: { benchmark_index: string | null; benchmark_index_symbol: string | null },
): BenchmarkOption[] {
  const fundOption = fund.benchmark_index_symbol
    ? { symbol: resolveTRI(fund.benchmark_index_symbol), label: triLabel(fund.benchmark_index, fund.benchmark_index_symbol) }
    : null;
  const globals = BENCHMARK_OPTIONS.filter((g) => g.symbol !== fundOption?.symbol);
  return fundOption ? [fundOption, ...globals] : globals;
}
```

Every place we currently pass `benchmarkSymbol` into a query (`fetchPortfolioData`, `fetchPerformanceTimeline`, `useFundDetail` benchmark loader, `useCompare`) calls `resolveTRI()` first. ~7 call sites; trivial diff.


### Step 3 — Fund Detail benchmark dropdown

Currently the Fund Detail Performance tab uses a single benchmark — the fund's `benchmark_index_symbol` from `scheme_master`. There is no user-facing picker at this surface; it's whatever the fund's own assignment says.

After this milestone:

- The Performance tab gains a small picker (segmented control or chip row, matching existing Clear Lens patterns), populated by `fundDetailBenchmarkOptions(fund)`.
- The first option is the fund's own SEBI-mandated benchmark TRI (e.g. `Nifty Midcap 150 TRI` for HDFC Mid Cap), **selected by default** — this is the same comparison the fund's own factsheet uses.
- The remaining options are the global picks from `BENCHMARK_OPTIONS` (Nifty 50 TRI / Nifty 100 TRI / Nifty 500 TRI), so a user can flip to a broader-market view if they want.
- The fund's benchmark already comes resolved-to-TRI through `resolveTRI()`; we don't need to touch `scheme_master` rows.
- Selection is **screen-scoped** (not persisted to the global `defaultBenchmarkSymbol`) — switching the comparison on Fund Detail does not change the Portfolio chart's benchmark.


### Step 4 — UI polish

- Chart legend label: "Nifty 50" → "Nifty 50 TRI" wherever benchmark name is rendered. Source the label from `BENCHMARK_OPTIONS` (or `fundDetailBenchmarkOptions` for Fund Detail) rather than hardcoding.
- Add the disclosure line under the benchmark chart on Portfolio and Fund Detail. One tokenised string in `src/utils/benchmarkSymbolMap.ts` for reuse.
- Past SIP Check (PR #99) already has a similar disclosure — replace its "price-only" sentence with the new canonical one.


## Alternatives Considered


### Buy EODHD for one month as the primary source

Considered (and partially adopted). NSE direct is free, public, and known to work for our exact equity-index list, so we keep NSE as **primary**. EODHD is repositioned as the **paid backup** — already wired in `sync-index`, with at least partial coverage of Indian TRI symbols (to be verified live during M1.2). The cheapest combination of (free canonical + always-on fallback) is exactly what we need.


### Use EODHD as the only source

Rejected. EODHD coverage of Indian TRI symbols is unverified at PRD time and would still leave us paying a recurring fee for data NSE serves for free.


### Compute TRI from PR + dividend yield assumption

Multiply price index by `(1 + 0.015 × t)` (Indian large-cap dividend yield assumption). Crude but trivially implementable.

Rejected. Requires picking a yield per index, would diverge from official TRI by 0.3–0.5% over a 5-year window, and would not match factsheet figures the user can independently verify. The whole point of this work is to *match what the user sees elsewhere*; an approximation defeats it.


### Per-symbol fork — keep PR for some surfaces, TR for others

E.g. use TR on Tools Hub but leave Portfolio chart on PR for "consistency with old screenshots."

Rejected. Half-converted app is worse than fully-converted app. Pre-launch makes the migration moment cheap. Doing it once is the right call.


### Add a Settings toggle for "PR vs TR view"

Considered. Solves the perfectionist tracking-error question. Adds a settings line nobody understands. Rejected — disclosure footnote does the same job at 1% of the UX surface.


## Milestones


### M1.1 — Data layer (primary)

**Scope.** Migration adds `source` and `ntr_value` columns to `index_history`. `sync-index/index.ts` gains an NSE TRI primary fetcher and the source-priority upsert. One-shot backfill of all 10 Nifty equity indices.

**Outcome.** `index_history` contains TRI rows tagged `source = 'nse'` for the 10 Nifty equity indices, with NTR persisted where NSE provides it.

**Commands.** Apply migration via MCP; deploy Edge Function via MCP; trigger one-shot backfill via the Supabase dashboard or `supabase functions invoke sync-index`.

**Acceptance.**
- `SELECT COUNT(*) FROM index_history WHERE index_symbol LIKE '%TRI'` returns ≥ 60,000 rows (10 indices × ~6,000 daily rows each, give or take).
- `SELECT MIN(index_date), MAX(index_date) FROM index_history WHERE index_symbol = '^NSEITRI'` shows `1999-06-30` and a recent date.
- `SELECT COUNT(*) FROM index_history WHERE index_symbol = '^NSEITRI' AND source = 'nse'` is ≥ 6,000 (every backfilled row tagged correctly).
- `SELECT COUNT(*) FROM index_history WHERE ntr_value IS NOT NULL AND index_symbol = '^NSEITRI'` ≥ 70% of total Nifty 50 TRI rows.


### M1.2 — Data layer (backup)

**Scope.** Verify EODHD coverage of TRI symbols (free quota having reset by now). Wire EODHD as the backup fetcher in `sync-index`. Run a side-by-side day to confirm priority logic — when both succeed, `source = 'nse'` wins.

**Outcome.** Daily sync runs both fetchers; the priority upsert keeps NSE rows as the user-visible value while EODHD rows land only when NSE has nothing for that date.

**Acceptance.**
- After a normal sync run: `SELECT source, COUNT(*) FROM index_history WHERE index_symbol LIKE '%TRI' GROUP BY source` shows `nse` dominant; `eodhd` only present for any symbol-date NSE missed.
- Synthetic test: temporarily disable the NSE fetcher in a dev run; confirm new dates land tagged `source = 'eodhd'`. Re-enable NSE; confirm the next run upgrades those rows back to `source = 'nse'` and overwrites the values.


### M1.3 — App cutover

**Scope.** `src/utils/benchmarkSymbolMap.ts` (with tests). All hook reads use `resolveTRI()`. `BENCHMARK_OPTIONS` updated. Persisted-state migration v6 (`^BSESN → ^NSEITRI`). Chart legend labels updated. Disclosure footnote added. Past SIP Check disclosure replaced. Fund Detail benchmark dropdown extended (see M1.4).

**Outcome.** Every benchmark surface in the app shows TRI. Demo user's Portfolio "ahead of benchmark" number is the right shape (TRI > PR for non-negative-yield equity).

**Acceptance.**
- `npm run typecheck && npm run lint` clean.
- `npm test` — coverage ≥ 95% for `src/utils/benchmarkSymbolMap.ts` (tests cover: PR→TRI mapping, unknown symbol passthrough, Sensex→Nifty 50 TRI specifically, fund-benchmark deduplication, source-priority enum).
- Manual probe in the running web build: Portfolio chart's benchmark line is visibly *above* what it was before for any window > 6 months.
- A persisted user state with `defaultBenchmarkSymbol = '^BSESN'` migrates to `^NSEITRI` on app open, no crash.


### M1.4 — Fund Detail benchmark dropdown

**Scope.** Extend the Fund Detail Performance tab with a benchmark picker populated by `fundDetailBenchmarkOptions(fund)`. Default-select the fund's own SEBI-mandated benchmark TRI. Selection is screen-scoped — does not persist to global state.

**Outcome.** A user on a Mid Cap fund's detail screen sees `Nifty Midcap 150 TRI` selected by default and can flip to the global picks via the same picker.

**Acceptance.**
- Picker renders for funds with a populated `benchmark_index_symbol`; falls back gracefully (just the global picks) when the field is null.
- Switching the picker re-renders the chart with the new benchmark line.
- Switching does not change the Portfolio screen's benchmark on next visit.
- Picker label reads "Nifty Midcap 150 TRI" (not "Nifty Midcap 150"), since the resolved symbol is TRI.


### M1.5 — Validation against external references

**Scope.** Reconcile our app's reported TRI XIRR for Nifty 50 over a 3Y SIP against ≥ 2 independent public sources.

**Outcome.** Numbers match within ±0.5pp. If they don't, root-cause before merging.

**Acceptance.** Document the reconciliation in the Decision Log section of this file before merging.


### M1.6 — Tools Hub stack rebase

**Scope.** Once this PR merges, rebase `feat/tools-hub-m2-fresh` onto main. Resolve the `BENCHMARK_OPTIONS` symbol-swap conflict. Verify Past SIP Check now reports a Nifty 50 TRI XIRR matching public references. Force-push the M3 / M4 branches in turn.

**Outcome.** The Tools Hub stack is back on main, with TRI plumbed through.


## Validation


### Pre-merge checklist (this PR)

```
npm run typecheck                   # zero errors
npm run lint                        # zero warnings
npx jest --coverage                 # all pass; src/utils ≥ 95%
```

Plus manual:

- Open the Portfolio screen on the demo user with an existing benchmark. Confirm the "How your money grew" benchmark line renders above where it used to. Read the legend — should say "Nifty 50 TRI" or whichever option is selected.
- Open Fund Detail for one user-held fund whose category maps to a non-Nifty-50 benchmark (e.g. a Mid Cap fund). Performance tab benchmark picker shows the fund's own SEBI benchmark TRI ("Nifty Midcap 150 TRI") selected by default, with global picks listed below.
- Switch the Fund Detail picker to "Nifty 50 TRI" — chart redraws. Navigate to Portfolio — its benchmark is unchanged (Fund Detail picker is screen-scoped).
- Open Settings → Benchmark picker. Should list 3 TRI options. No "BSE Sensex".
- Open Past SIP Check (M2 stack post-rebase). Nifty 50 TRI 3Y SIP shows annualised return matching publicly-quoted figures.
- Toggle dark mode. All benchmark surfaces still render correctly.
- Re-render at desktop width 1280px and mobile 390px. No layout regression.
- DB diagnostic: `SELECT source, COUNT(*) FROM index_history WHERE index_symbol LIKE '%TRI' GROUP BY source` shows all-or-nearly-all rows tagged `nse`, with `eodhd` only present for any symbol-date NSE didn't supply.

### External reconciliation (before merging)

For Nifty 50 TRI 3Y SIP ending today, our reported XIRR must match within ±0.5pp:
- NSE Indices' own SIP calculator (https://www.niftyindices.com/sip-calculator), AND
- A reputable financial-news site (Moneycontrol or Value Research)

Record the comparison in this plan's Decision Log.


## Risks And Mitigations


| Risk | Mitigation |
|---|---|
| NSE changes the endpoint URL or payload shape | Existing `sync-index` already has structured logging on every step. EODHD backup fetcher carries the daily sync until we patch. Operators can spot the source-distribution shift via `SELECT source, COUNT(*) FROM index_history`. |
| EODHD doesn't actually carry the TRI variants we need | Confirmed during M1.2 by live probing each TRI symbol against the post-quota-reset key. If a symbol is uncovered, we still ship — that symbol simply has no backup, and an NSE outage on that symbol would freeze its data until NSE is back. Acceptable for non-headline indices. |
| Backfill blows the request body size on Edge Function memory | Fetch in chunks (e.g. one calendar year per call) if the single-call response trips Edge Function memory limits. ~6,700 rows × ~150 bytes/row = ~1MB; well within limits, but worth monitoring on first run. |
| TRI start dates per index differ — Tools Hub assumes uniform availability | Record per-index earliest date in a small reference (`PHASE8_TRI_INCEPTION_DATES` constant) so the simulation in `pastSipCheck.ts` can mark `shortHistory: true` when a 25Y window asks for 30Y of data. |
| Rebase conflicts with the in-flight Tools Hub stack | Symbol-swap is mechanical (`^NSEI` → `^NSEITRI`). Conflict resolution is grep-and-replace. Coordinated by force-pushing the stack after merge. |
| BSE Sensex users complain about the drop | Pre-launch, friends and family only. The persisted-state migration hand-rolls them onto Nifty 50 TRI (closest large-cap match — Sensex is 30 large caps, Nifty 50 is 50 large caps); they don't see a broken state. Slack message at release time covers the rest. |
| Source-priority upsert silently swallows good data because of an off-by-one in the priority enum | Unit-test the priority comparison directly (`benchmarkSymbolMap.test.ts` includes a matrix: `{nse, eodhd, yahoo, unknown} × {nse, eodhd, yahoo, unknown}` for incoming vs existing). Synthetic test in M1.2 also exercises the disable-NSE-then-re-enable path. |


## Decision Log


- *2026-05-05* — picked NSE direct as the **primary** source. Free, verified-live for our entire equity index universe, with 27 years of history in a single call.
- *2026-05-05* — chose to add `ntr_value` as a nullable column on `index_history` rather than create a sibling table for NTR. Single-row read pattern preserved; NTR is opportunistic.
- *2026-05-05* — chose to ship cutover in a single PR rather than feature-flag PR-vs-TR. Pre-launch makes a clean cutover cheap; the flag would itself be a future deletion task.
- *2026-05-05* — rejected tracking-error modeling ("TRI minus 20bps"). SEBI convention is raw TRI; departing creates more confusion than it removes.
- *2026-05-06* — added EODHD as a **paid backup** alongside NSE. Per review feedback: a single-source dependency on niftyindices.com is fragile; we keep NSE as canonical but write through both fetchers and tag every row with its `source`, with priority `nse > eodhd > yahoo`. Primary-source data wins on every successful sync, so once NSE recovers from any outage the data converges back automatically.
- *2026-05-06* — changed BSE Sensex migration target from `^NIFTY100TRI` to `^NSEITRI` (Nifty 50 TRI). Per review feedback: Sensex is 30 large caps, much closer to Nifty 50 (50 large caps) than Nifty 100 (which dilutes with mid-caps).
- *2026-05-06* — added Fund Detail benchmark dropdown showing the fund's own SEBI-mandated benchmark TRI as the first/default option. Per review feedback: the most useful comparison on a fund detail screen is the same one the fund's factsheet uses, not the user's globally-chosen index.


## Progress

- [ ] PRD reviewed and merged in this PR alongside this ExecPlan
- [ ] Branch `feat/total-return-benchmarks` opened off `main`
- [ ] Plan reviewed by stakeholders (you)
- [ ] M1.1 — Data layer (primary): migration adds `source` + `ntr_value` columns; NSE TRI fetcher; one-shot backfill
- [ ] M1.2 — Data layer (backup): EODHD live coverage probe; backup fetcher wired with priority upsert; synthetic disable-and-recover test
- [ ] M1.3 — App cutover: `benchmarkSymbolMap.ts` + tests, hook reads via `resolveTRI()`, `BENCHMARK_OPTIONS`, persisted-state migration v6 (^BSESN → ^NSEITRI), legend labels, disclosure footnote
- [ ] M1.4 — Fund Detail benchmark dropdown: fund's SEBI-mandated benchmark TRI as default, global picks below
- [ ] M1.5 — External reconciliation against NSE / news source figures, recorded in Decision Log
- [ ] M1.6 — Rebase Tools Hub stack (PRs #99 / #100 / #101) onto main; force-push
- [ ] Type / lint / test gates pass
- [ ] Cross-screen QA pass — Portfolio, Fund Detail, Leaderboard, Tools Hub stack, light + dark, mobile + desktop
- [ ] Friends-and-family Slack note explaining the benchmark numbers will look different
