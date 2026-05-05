# M1 — TRI data ingestion and app-wide cutover


## Goal


Replace every benchmark surface in FolioLens — Portfolio chart, Portfolio header alpha, Fund Detail Performance tab, Leaderboard, Settings benchmark picker, and the in-flight Tools Hub stack — with total-return (TRI) index data sourced from NSE's free public endpoint. Backfill 25+ years of history. Wire daily sync. Drop BSE Sensex from `BENCHMARK_OPTIONS`. Ship in a single PR off `main`.


## User Value


A FolioLens user asks "did my fund beat the market?" and gets an honest, factsheet-matched answer for the first time. Today's PR-shaped benchmark systematically understates the market by 1.5–2% per year compounding. Switching to TRI fixes the reported alpha across every surface that compares against an index. See `00-prd-total-return-benchmarks.md` for product reasoning.


## Context


This work is a prerequisite for the Tools Hub stack currently in flight:

- PR #99 — Phase 4 M2 Past SIP Check (ships pointing at PR symbols today; will rebase onto this branch and consume TRI symbols)
- PR #100 — Phase 4 M3 Compare Funds (same)
- PR #101 — Phase 4 M4 Direct vs Regular Impact (benchmark-independent; rebases without conflict)

It also touches the already-shipped Portfolio, Fund Detail, and Leaderboard screens — they need their benchmark reads swapped in the same PR so the user never sees a half-converted app.


### Discovery summary (verified live, see PRD appendix for full results)

- **Yahoo Finance** does not serve any Indian TRI symbol — confirmed via 24 live probes; either 404 or 200-with-zero-rows.
- **EODHD** free tier could not be live-probed (daily quota exhausted at session start). The cost-of-information argument is moot now anyway because NSE direct works.
- **NSE Indices** (`niftyindices.com/Backpage.aspx/getTotalReturnIndexString`) — POST endpoint, no auth, returns gross TRI **and** NTR for any Nifty equity index in a single JSON payload. Tested: returns 6,677 daily rows for Nifty 50 TRI from 1999-06-30 through 2026-05-05 in one ~1MB response.
- **BSE** APIs are bot-protected. No free TRI source. Decision: drop BSE Sensex from `BENCHMARK_OPTIONS`.
- **CRISIL debt indices** out of scope for this milestone — no debt-fund tools in flight.


### New / changed files (high-level)

```
supabase/functions/sync-index/index.ts        — add NSE TRI fetcher; new symbol map
supabase/migrations/<ts>_nse_tri_symbols.sql  — optional: seed metadata + index_metadata table
src/store/appStore.ts                         — BENCHMARK_OPTIONS swap; persisted-state migration v6
src/hooks/usePortfolioTimeline.ts             — read TRI symbols
src/hooks/useInvestmentVsBenchmarkTimeline.ts — read TRI symbols
src/hooks/usePortfolio.ts                     — market-XIRR cashflow set off TRI
src/hooks/useFundDetail.ts                    — benchmarkSymbol resolution → TRI
src/hooks/useCompare.ts                       — Compare-screen benchmark column → TRI
src/components/clearLens/screens/             — chart legend label updates ("Nifty 50 TRI")
src/components/clearLens/screens/tools/       — Past SIP Check, Compare Funds tools (will rebase)
docs/plans/phase-7-total-return-benchmarks/   — this file + the PRD
```


## Assumptions


1. NSE's `getTotalReturnIndexString` endpoint stays at its current URL and payload shape for the next 12+ months. (It is core infrastructure for niftyindices.com and has been stable for years.)
2. TRI history start dates per index are fixed (NSE doesn't backfill further). We record the earliest date per index in code or a tiny migration so screens can detect "you asked for 30Y, this index only has 25Y of TRI."
3. The price-only series in `index_history` is left in place for reference but unread. No data is deleted.
4. We are pre-launch — friends-and-family only. No user migration cost. No release notes required externally.
5. The existing `sync-index` Edge Function is the right place to add TRI fetching (single function, deployed via MCP, scheduled daily by pg_cron).


## Definitions


- **PR (Price Return)** — the index level reflects only price change. Dividends are dropped.
- **TR / TRI (Total Return Index)** — index level reflects price change plus gross dividend reinvestment.
- **NTR / NTRI (Net Total Return)** — TRI minus a withholding-tax assumption. Persisted but not consumed yet.
- **Cutover** — the single-PR moment when every benchmark consumer in the app reads from TRI instead of PR.


## Scope


### In scope (this milestone)

- Backfill TRI for **10 Nifty equity indices**, all of which NSE serves: Nifty 50, Nifty 100, Nifty 200, Nifty 500, Nifty Next 50, Nifty Midcap 150, Nifty Smallcap 250, Nifty LargeMidcap 250, Nifty Bank, Nifty IT.
- Daily incremental sync for the same 10 indices.
- Persisting NTR alongside gross TRI (single endpoint returns both — opportunistic capture).
- App-wide swap: every UI consumer of benchmark data reads TRI symbols.
- Drop BSE Sensex from `BENCHMARK_OPTIONS`. Migrate persisted preference `^BSESN → ^NIFTY100TRI`.
- One source-of-truth disclosure string under benchmark charts: *"Benchmark is the total-return variant — dividends reinvested, per SEBI factsheet convention."*
- Chart legend rename: "Nifty 50" → "Nifty 50 TRI" everywhere.


### Out of scope (this milestone)

- BSE Sensex / BSE 100 / BSE 500 TRI — no free source; not blocking any current feature.
- CRISIL debt indices — not used by any equity-tool in flight.
- Hybrid / Liquid / Arbitrage TRI — these indices have no PR/TR distinction by construction.
- Tracking-error modeling ("TRI minus 20bps"). See PRD risks section.
- Forward-looking surfaces (Wealth Journey assumed-return projections).


## Approach


### Step 1 — Data layer first

Update `supabase/functions/sync-index/index.ts` with a new fetcher path. The function already supports a primary (Yahoo) + fallback (EODHD) per-symbol model; we add a third path: NSE TRI direct, used as the sole source for the new TRI symbols.

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

Storage proposal: keep the existing `index_history` table shape but **add a nullable `ntr_value` column** so NTR comes for free without a sibling table. The TRI value lands in the existing `close_value` column. This keeps every existing reader unchanged and avoids a schema fork.

```sql
-- supabase/migrations/<ts>_index_history_add_ntr.sql
ALTER TABLE index_history
  ADD COLUMN IF NOT EXISTS ntr_value numeric;
```

Backfill is a one-call-per-symbol POST to NSE with `startDate = "01-Jan-1990"`. The endpoint clamps to the actual earliest TRI date per index. ~10 calls total; entire 25+ year dataset for our universe ingests in seconds.

Daily incremental sync runs the same POST with `startDate = today - 5 days` and upserts on `(index_symbol, index_date)` with `ignoreDuplicates`. The 5-day overlap covers weekends and any intermittent NSE outage.


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

Add a persisted-state migration to `version: 6` that maps `^NSEI`, `^NIFTY100`, `^BSESN` to their TRI counterparts (`^BSESN → ^NIFTY100TRI` since there's no Sensex TRI).

Every hook that resolves a benchmark symbol gets exactly one of two changes:
1. The default symbol it falls back to is now a TRI symbol.
2. If a fund's `benchmark_index_symbol` (in `scheme_master`) is a PR symbol, the hook maps to the TRI counterpart at read time. (This avoids touching `scheme_master` rows; the mapping is one-line and trivially testable.)

```ts
// src/utils/benchmarkSymbolMap.ts (new, ~10 lines)
const PR_TO_TRI: Record<string, string> = {
  '^NSEI':            '^NSEITRI',
  '^NIFTY100':        '^NIFTY100TRI',
  '^NIFTY500':        '^NIFTY500TRI',
  '^NIFTYMIDCAP150':  '^NIFTYMIDCAP150TRI',
  '^NIFTYSMALLCAP250':'^NIFTYSMALLCAP250TRI',
  '^NIFTYLMI250':     '^NIFTYLMI250TRI',
  '^NSEBANK':         '^NSEBANKTRI',
  '^CNXIT':           '^CNXITTRI',
  '^BSESN':           '^NIFTY100TRI',  // closest equivalent we have
};
export function resolveTRI(symbol: string): string {
  return PR_TO_TRI[symbol] ?? symbol;
}
```

Every place we currently pass `benchmarkSymbol` into a query (`fetchPortfolioData`, `fetchPerformanceTimeline`, `useFundDetail` benchmark loader, `useCompare`) calls `resolveTRI()` first. ~7 call sites; trivial diff.


### Step 3 — UI polish

- Chart legend label: "Nifty 50" → "Nifty 50 TRI" wherever benchmark name is rendered. Source the label from `BENCHMARK_OPTIONS` rather than hardcoding.
- Add the disclosure line under the benchmark chart on Portfolio and Fund Detail. One tokenised string in `src/utils/benchmarkSymbolMap.ts` for reuse.
- Past SIP Check (PR #99) already has a similar disclosure — replace its "price-only" sentence with the new canonical one.


## Alternatives Considered


### Buy EODHD for one month, backfill, cancel

Plausible, but unnecessary now that NSE direct is verified. Estimated cost: $20 once. Risks: (a) we hadn't verified EODHD actually carries Indian TRI symbols (couldn't probe due to free-tier quota); (b) introduces a paid dependency that isn't actually cheaper than the free path. Rejected.


### Compute TRI from PR + dividend yield assumption

Multiply price index by `(1 + 0.015 × t)` (Indian large-cap dividend yield assumption). Crude but trivially implementable.

Rejected. Requires picking a yield per index, would diverge from official TRI by 0.3–0.5% over a 5-year window, and would not match factsheet figures the user can independently verify. The whole point of this work is to *match what the user sees elsewhere*; an approximation defeats it.


### Per-symbol fork — keep PR for some surfaces, TR for others

E.g. use TR on Tools Hub but leave Portfolio chart on PR for "consistency with old screenshots."

Rejected. Half-converted app is worse than fully-converted app. Pre-launch makes the migration moment cheap. Doing it once is the right call.


### Add a Settings toggle for "PR vs TR view"

Considered. Solves the perfectionist tracking-error question. Adds a settings line nobody understands. Rejected — disclosure footnote does the same job at 1% of the UX surface.


## Milestones


### M1.1 — Data layer

**Scope.** `sync-index/index.ts` gains an NSE TRI path. Migration adds `ntr_value` column. One-shot backfill run.

**Outcome.** `index_history` contains TRI rows for the 10 Nifty equity indices, with NTR persisted where NSE provides it.

**Commands.**

    # Apply migration via MCP
    # (see Validation for the exact tool call)

    # Deploy edge function
    # (see Validation; deploy via MCP per AGENTS.md)

    # Trigger one-shot backfill
    # POST to /sync-index from the Supabase dashboard or CLI

**Acceptance.**
- `SELECT COUNT(*) FROM index_history WHERE index_symbol LIKE '%TRI'` returns ≥ 60,000 rows (10 indices × ~6,000 daily rows each, give or take).
- `SELECT MIN(index_date), MAX(index_date) FROM index_history WHERE index_symbol = '^NSEITRI'` shows `1999-06-30` and a recent date.
- `ntr_value IS NOT NULL` for at least 70% of rows on `^NSEITRI`.


### M1.2 — App cutover

**Scope.** All hook reads switched to TRI. `BENCHMARK_OPTIONS` updated. Persisted-state migration v6. Chart legend labels updated. Disclosure footnote added.

**Outcome.** Every benchmark surface in the app shows TRI. Demo user's Portfolio "ahead of benchmark" number drops by the dividend-yield × time delta (visual sanity check).

**Acceptance.**
- `npm run typecheck && npm run lint` clean.
- `npm test` — coverage ≥ 95% for `src/utils/benchmarkSymbolMap.ts`.
- Manual probe in the running web build: Portfolio chart's benchmark line is visibly *above* what it was before for any window > 6 months (TRI > PR for non-negative-yield equity).


### M1.3 — Validation against external references

**Scope.** Reconcile our app's reported TRI XIRR for Nifty 50 over a 3Y SIP against ≥ 2 independent public sources.

**Outcome.** Numbers match within ±0.5pp. If they don't, root-cause before merging.

**Acceptance.** Document the reconciliation in the Decision Log section of this file before merging.


### M1.4 — Tools Hub stack rebase

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
- Open Fund Detail for one user-held fund. Performance tab shows fund vs TRI; legend label updated.
- Open Settings → Benchmark picker. Should list 3 TRI options. No "BSE Sensex".
- Open Past SIP Check (M2 stack post-rebase). Nifty 50 TRI 3Y SIP shows annualised return matching publicly-quoted figures.
- Toggle dark mode. All benchmark surfaces still render correctly.
- Re-render at desktop width 1280px and mobile 390px. No layout regression.

### External reconciliation (before merging)

For Nifty 50 TRI 3Y SIP ending today, our reported XIRR must match within ±0.5pp:
- NSE Indices' own SIP calculator (https://www.niftyindices.com/sip-calculator), AND
- A reputable financial-news site (Moneycontrol or Value Research)

Record the comparison in this plan's Decision Log.


## Risks And Mitigations


| Risk | Mitigation |
|---|---|
| NSE changes the endpoint URL or payload shape | Existing `sync-index` already has structured logging on every step; failures appear in the next day's run and can be patched without user impact (TRI doesn't move much between sync runs). |
| Backfill blows the request body size on Edge Function memory | Fetch in chunks (e.g. one calendar year per call) if the single-call response trips Edge Function memory limits. ~6,700 rows × ~150 bytes/row = ~1MB; well within limits, but worth monitoring on first run. |
| TRI start dates per index differ — Tools Hub assumes uniform availability | Record per-index earliest date in a small reference (`PHASE7_TRI_INCEPTION_DATES` constant) so the simulation in `pastSipCheck.ts` can mark `shortHistory: true` when a 25Y window asks for 30Y of data. |
| Rebase conflicts with the in-flight Tools Hub stack | Symbol-swap is mechanical (`^NSEI` → `^NSEITRI`). Conflict resolution is grep-and-replace. Coordinated by force-pushing the stack after merge. |
| BSE Sensex users complain about the drop | Pre-launch, friends and family only. The persisted-state migration hand-rolls them onto Nifty 100 TRI; they don't see a broken state. Slack message at release time covers the rest. |


## Decision Log


- *2026-05-05* — picked NSE direct over EODHD upgrade. Free, verified-live for our entire equity index universe, simpler to operate. EODHD remains a candidate later if/when we need BSE TRI or CRISIL debt feeds.
- *2026-05-05* — chose to drop BSE Sensex from `BENCHMARK_OPTIONS` rather than reverse-engineer BSE's bot-protected API. ~95% of equity funds benchmark to Nifty anyway; the cost is a one-line persisted-state migration.
- *2026-05-05* — chose to add `ntr_value` as a nullable column on `index_history` rather than create a sibling table for NTR. Single-row read pattern preserved; NTR is opportunistic.
- *2026-05-05* — chose to ship cutover in a single PR rather than feature-flag PR-vs-TR. Pre-launch makes a clean cutover cheap; the flag would itself be a future deletion task.
- *2026-05-05* — rejected tracking-error modeling ("TRI minus 20bps"). SEBI convention is raw TRI; departing creates more confusion than it removes.


## Progress

- [ ] PRD reviewed and merged in this PR alongside this ExecPlan
- [ ] Branch `feat/total-return-benchmarks` opened off `main`
- [ ] Plan reviewed by stakeholders (you)
- [ ] M1.1 — Data layer (migration + sync-index NSE TRI path + backfill)
- [ ] M1.2 — App cutover (BENCHMARK_OPTIONS, hook reads, chart legend, disclosure)
- [ ] M1.3 — External reconciliation against NSE / news source figures, recorded in Decision Log
- [ ] M1.4 — Rebase Tools Hub stack (PRs #99 / #100 / #101) onto main; force-push
- [ ] Type / lint / test gates pass
- [ ] Cross-screen QA pass — Portfolio, Fund Detail, Leaderboard, Tools Hub stack, light + dark, mobile + desktop
- [ ] Friends-and-family Slack note explaining the benchmark numbers will look different
