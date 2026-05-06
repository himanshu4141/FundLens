# PRD — Total Return benchmarks across FolioLens

> **Phase 8** — foundational data fix that replaces every benchmark surface in the app with total-return (TR / TRI) indices. Implementation tracked in `docs/plans/phase-8-total-return-benchmarks/M1-tri-data-and-app-cutover.md`.


## What this is


A product requirements document for switching every benchmark surface in the app from price-return (PR) indices to total-return (TR / TRI) indices, sourced primarily from NSE Indices' free public endpoint, with a paid fallback so a single upstream outage doesn't blank the app.


## TL;DR


- FolioLens currently compares user funds and portfolios to **price-return** index series (`^NSEI`, `^BSESN`, etc.). Mutual fund NAVs are inherently total-return — they reflect dividends paid by underlying stocks. Comparing a TR-shaped fund NAV to a PR-shaped index is structurally unfair to the index by 1.5–2% per year compounding.
- Every fund factsheet in India reports performance against TRI (SEBI mandate, October 2018 onward). Our app shows users a different number than what their fund's own marketing materials show.
- Over 10 years this hides 16% of the index's true return; over 20 years, ~35%. On a Wealth Journey screen, that's the difference between "your portfolio crushed the market" and "your portfolio roughly matched it." Users have been receiving the wrong story.
- Free TRI data for all the Nifty equity indices we care about is available directly from NSE's public endpoint (verified live during discovery). Backfill of 27 years takes one HTTP call. Daily refresh is three calls. No paid feed required.
- This is a prerequisite for the Tools Hub work-in-flight (Past SIP Check, Compare Funds) and a foundational fix for the Portfolio + Fund Detail + Leaderboard screens that already shipped.


## Why this matters now


The Past SIP Check tool (Phase 4 M2, PR #99) was about to ship with a benchmark comparison that confused our pilot user — they expected a Nifty 50 SIP to return ~16% per year over the last three years (the figure every popular finance source quotes). FolioLens reported 3.5%. The math was correct given our data; the data was the wrong shape. This PRD is the structural fix.

We are pre-launch. Friends-and-family users only. There is no migration cost, no support load, no regulatory comms required. The cheapest moment to fix a foundational data model is *now*.


## Audience and goal alignment


### Who this affects

- **Users on every screen that shows benchmark data.** Portfolio "How your money grew" chart, Portfolio header alpha, Fund Detail Performance tab, Leaderboard alpha cards, every Tools Hub tool that takes a benchmark input.
- **The Phase 4 Tools Hub roadmap.** M2 Past SIP Check, M3 Compare Funds, M4 Direct vs Regular all consume the same `index_history` table. Fixing the data once unblocks all three.
- **Future surfaces.** Wealth Journey "vs benchmark" if/when we add it; debt-tools later (these need a different fix — see Out of Scope).


### Why a user cares

A FolioLens user asks "did my fund beat the market?" and expects an honest answer. The honest answer requires comparing two like-for-like measures of return. Today we compare an apple (NAV with dividends) to an orange (index without dividends), and the apple looks bigger. Users notice when our number disagrees with what the fund itself prints — they stop trusting our number, and rightly so.


### Out of scope for this PRD

- **BSE Sensex TRI.** No free source. Recommendation: drop BSE Sensex from `BENCHMARK_OPTIONS` and replace with a Nifty TRI variant. ~95% of equity funds benchmark to Nifty anyway.
- **CRISIL debt indices.** No free source. Debt fund tooling is a separate Phase. We do not need debt benchmarks for any current or planned Tools Hub milestone.
- **Tracking-error caveat.** A TRI-tracking index fund underperforms TRI by ~0.10–0.20% (its own expense ratio). For absolute correctness, comparing fund NAV to "TRI minus 20bps" is the most fair number. We are not modelling this — SEBI's standard, every other tool, and every fund factsheet uses raw TRI; going off-standard creates more confusion than it removes. We will mention the caveat in a single tokenised footnote.
- **Hybrid / Liquid / Arbitrage indices.** These are total-return by construction (debt coupons and short-term yields are baked into the level). No PR/TR distinction exists.
- **Forward-looking surfaces.** Wealth Journey projects with assumed annual returns; the historical-benchmark choice is irrelevant to it.


## Product principles applied

From `VISION.md` — "lead with the answer," "use live portfolio data," "explain unavoidable terms in place," "avoid color-only meaning, pair positive/negative color with arrow/sign text."

This change is squarely in service of *lead with the answer*. We have been leading with a misleading answer. Every other principle (live data, plain-language disclosure, paired explanations) is preserved by the rollout plan in the ExecPlan.


## Requirements


### Functional

| # | Requirement | How a user sees it |
|---|---|---|
| F1 | Every benchmark line / number / comparison in the app uses total-return data. | The user sees a number that matches their fund's factsheet. |
| F2 | The benchmark picker (Settings, Past SIP Check, Compare Funds tools) lists TRI variants by default. | Picker reads "Nifty 50 TRI", "Nifty 100 TRI", "Nifty 500 TRI". |
| F3 | A short, tokenised disclosure appears on the Portfolio chart and Fund Detail Performance tab: *"Benchmark is total-return — dividends reinvested, per SEBI factsheet convention."* | The user is one tap away from understanding why our number now matches their factsheet. |
| F4 | TRI history is backfilled from the earliest available NSE TRI date (varies per index — Nifty 50 starts 1999-06-30) through today's market close. | A 25-year SIP simulation works correctly. |
| F5 | Daily incremental sync keeps the latest market close fresh in `index_history` within 24 hours. | Today's portfolio "ahead of benchmark" reflects yesterday's close. |
| F6 | The price-only series remains in `index_history` for historical reproducibility and bug-investigation purposes, but is not consumed by any UI surface. | No regression, no orphaned data. |
| F7 | BSE Sensex is removed from `BENCHMARK_OPTIONS`. Users with the saved preference `defaultBenchmarkSymbol = '^BSESN'` are migrated to `^NSEITRI` (Nifty 50 TRI — the closest large-cap equivalent) on next app open via persisted-state migration. | If the user had picked BSE Sensex, they see Nifty 50 TRI selected on next launch; we don't crash on a missing symbol. |
| F8 | A **backup data source** is wired alongside NSE direct so that an NSE outage doesn't blank our benchmark numbers. The backup is consulted only when NSE returns no rows for that symbol-and-date. | A user opening the app on the morning after a 24-hour NSE outage still sees up-to-date benchmark numbers. |
| F9 | Each row in `index_history` records **which source it came from** (NSE / EODHD / etc.). On every subsequent successful NSE sync, NSE-sourced data wins and overwrites any backup-sourced row for the same date. | Once the primary source is healthy again the data converges back to the canonical NSE figures; backup-sourced rows are visible to operators (via the source column) for diagnostics. |
| F10 | The Fund Detail benchmark picker shows the fund's **own SEBI-mandated benchmark** (resolved to its TRI variant) as a first-class option, alongside the global benchmark picks. The fund-specific benchmark is selected by default. | A user on the HDFC Mid Cap fund detail screen sees "Nifty Midcap 150 TRI" as the default chart line — the same benchmark the fund's own factsheet uses — without losing the ability to switch to Nifty 50 TRI / Nifty 500 TRI for a broader-market view. |


### Non-functional

| # | Requirement |
|---|---|
| N1 | Backfill cost is ₹0 in the steady-state path (NSE direct). Backup source is permitted to be a paid feed, used only as a fallback. |
| N2 | Single Edge Function, with a primary path (NSE) and a fallback path (existing EODHD wiring); no new third-party services beyond what's already configured. |
| N3 | Cross-app cutover ships in **one** PR so the user never sees a half-converted app. |
| N4 | The Tools Hub stack (PRs #99 / #100 / #101) rebases cleanly on top of this work; no merge conflicts beyond the `BENCHMARK_OPTIONS` swap and `index_history` reads. |
| N5 | When primary and backup sources both have data for the same `(symbol, date)`, the higher-priority source wins on every subsequent write. Operators can audit which source supplied each row via the `source` column for diagnostics. |


### Data integrity

| # | Requirement |
|---|---|
| D1 | TRI rows are stored under distinct `index_symbol` keys (proposal: `^NSEITRI`, `^NIFTY100TRI`, etc.) so PR and TR series never silently mix. |
| D2 | Where NSE returns NTR alongside gross TRI, both are persisted; the app uses gross TRI by default. NTR is available for future "after-tax view" features. |
| D3 | The earliest TRI date per index is recorded in a small `index_metadata` reference (or comment in source) so screens can detect "you asked for 30Y, but TRI for this index only goes back 25Y." |
| D4 | A `source` column on `index_history` records the origin of every row (`'nse'`, `'eodhd'`, etc.). Source priority is fixed in code: `nse > eodhd > yahoo`. Daily sync attempts the primary first; if a row already exists from a higher-priority source for the same `(symbol, date)`, the lower-priority insert is skipped; if a higher-priority row arrives later, it overwrites the lower one. |
| D5 | The NSE TRI fetcher and the backup fetcher are **independent paths** in the same Edge Function — a transient failure in one must not block the other from running. Errors per source per symbol are logged and surfaced in the function's response payload for ops review. |


## User-visible surfaces and explicit changes

| Surface | Today | After |
|---|---|---|
| Portfolio "How your money grew" chart | benchmark line uses `^NSEI` PR | benchmark line uses `^NSEITRI` |
| Portfolio header — "X.X% ahead/behind" | market XIRR computed off PR series | market XIRR off TRI series |
| Fund Detail — Performance tab fund vs benchmark | benchmark line uses single PR series, picker shows global benchmarks only | benchmark line uses TRI series; **picker now lists the fund's own SEBI-mandated benchmark TRI as the first and default option, followed by the global picks** (e.g. for HDFC Mid Cap: `Nifty Midcap 150 TRI` (fund's benchmark, default) / `Nifty 50 TRI` / `Nifty 100 TRI` / `Nifty 500 TRI`) |
| Fund Detail — benchmark name in chart legend | "Nifty 50" | "Nifty 50 TRI" (or whichever picker option is active) |
| Leaderboard alpha card | alpha vs PR | alpha vs TRI |
| Tools Hub → Past SIP Check (M2, in-flight) | Nifty 50 PR ⇒ 3.54% XIRR | Nifty 50 TRI ⇒ ~5% XIRR (closer to user expectation) |
| Tools Hub → Compare Funds (M3, in-flight) | trailing returns vs PR | vs TRI |
| Tools Hub → Direct vs Regular (M4, in-flight) | not benchmark-relevant | unchanged |
| Settings → Benchmark picker | `Nifty 50`, `Nifty 100`, `BSE Sensex` | `Nifty 50 TRI`, `Nifty 100 TRI`, `Nifty 500 TRI` (BSE Sensex dropped — see persisted-state migration below) |


## Disclosure and copy

A single source of truth string, used wherever a benchmark line is drawn:

> "Benchmark is the total-return variant — dividends reinvested, per SEBI factsheet convention."

That sentence is the entire user-facing rationale. It pre-empts every "why is the number different" question without requiring an in-app explainer.

In the disclaimer footer of Tools Hub screens, the existing "Past performance is not indicative of future returns" line stays. No additional caveats.


## Data resilience — primary + backup source policy


### The shape

NSE's `getTotalReturnIndexString` is the **canonical source of truth**. It's free, public, and matches what every SEBI-regulated fund factsheet uses — so it should drive every number a user sees in steady state.

But it is also a single ASP.NET endpoint on `niftyindices.com`. It can break for any of the usual reasons (DDoS protection, schema change, upstream cert issue, Indian internet weather). When it does, we cannot show users a stale or empty benchmark for two days while we fix it.

Therefore: **NSE is primary. EODHD is the backup.** The existing `sync-index` Edge Function already has EODHD wired for some of our PR symbols (`^NIFTY500`, `^BSE100`, etc.) — we extend the same wiring for TRI.


### Source priority and convergence

Each row in `index_history` carries its `source` (`'nse'`, `'eodhd'`, etc.). Daily sync runs both fetchers per symbol, then upserts according to a fixed priority:

> `nse > eodhd > yahoo`

When both succeed for the same `(symbol, date)`, NSE wins. When only the backup succeeds (NSE outage), the backup row is written and the `source` column reflects that. **Every subsequent successful NSE sync overwrites lower-priority rows with the canonical data** — so once NSE is healthy again, the data converges back automatically. No operator intervention needed.


### Diagnostic visibility

Operators can run

    SELECT source, COUNT(*) FROM index_history GROUP BY source;

and see at a glance how much of our benchmark data is canonical vs from a backup. A spike in `'eodhd'` rows is a leading indicator that NSE has been flaky.


### Cost

Steady state: ₹0 (NSE only). Outage state: backup feed cost (whatever EODHD tier we're on at the time). Backfill: ₹0 — we run the NSE backfill once and EODHD backfill is not necessary, since NSE's 25+ year history is already canonical.


## Success criteria


### Pre-merge

- The benchmark XIRR shown for a 3Y / 5Y SIP into Nifty 50 TRI in Past SIP Check matches publicly-quoted figures from at least two independent sources (e.g. NSE's own SIP calculator and a reputable financial news site) within ±0.5pp.
- The Portfolio chart's benchmark line, when rendered for the demo user, lies *above* the same window's PR line (TRI is always > PR for a non-negative-yield equity index — this is a visual sanity check).
- Every screen listed in the surface table renders without a crash on the demo data, in light and dark themes, on mobile and desktop layouts.


### Post-merge sanity

- A friends-and-family user, three days after release, does not file a "benchmark wrong" issue. (Active anti-success: if anyone *does* file one, that's a meaningful signal.)
- The Tools Hub stack (PRs #99 / #100 / #101) merges with only the trivial `BENCHMARK_OPTIONS` symbol-swap conflict.


## Risks and counter-arguments


### "What if NSE changes their endpoint or goes down?"

NSE Indices' `getTotalReturnIndexString` is stable infrastructure for niftyindices.com itself, but it's still a single endpoint. If it ever changes payload shape, throws back a CAPTCHA, or just goes offline for a day, our daily sync would emit errors and benchmark numbers would freeze.

Mitigated by the **primary + backup policy** (see "Data resilience" above). When NSE fails for a given `(symbol, date)`, the existing EODHD path supplies the row instead and tags the `source` column. The next successful NSE sync overwrites the backup-sourced row with canonical data. Users never see a blanked chart; operators see a `source` distribution shift on the diagnostics dashboard.


### "What if a user's specific benchmark isn't covered?"

Today's BENCHMARK_OPTIONS has 3 entries. After this PR it has 3 different entries, all covered by NSE's TRI feed. Indices in `benchmark_mapping` we do not currently expose to users (Nifty Bank, Nifty IT, etc.) will gain TRI coverage as a free side effect of the same backfill, and become exposable in any future picker without further data work.


### "Should we model tracking error?"

Counter-argument from a perfectionist read: comparing fund NAV to TRI overstates how well an index fund could have done, because index funds also charge fees. Adding a synthetic "TRI minus 20bps" is more accurate.

We rejected this. The benchmark is *the index's return*, not *the cheapest tracking fund's return*. SEBI's convention, every fund factsheet, every news source uses raw TRI. Departing from that convention buys us 0.2% of theoretical accuracy and introduces a "why is FolioLens using a different number than my factsheet" question that costs more than 0.2% of trust to answer. Out of scope.


### "Why not just buy EODHD for a month and use them as the single source?"

Considered (see ExecPlan Alternatives). NSE direct is free, public, and known to work for our exact equity-index list, with 27 years of history available in a single call. EODHD upgrade would still need to be reverified for each TRI symbol's actual coverage and would commit us to a paid dependency forever. Best of both: NSE primary, EODHD backup.

EODHD remains an option later as a *primary* source for BSE TRI and CRISIL debt feeds where NSE doesn't help — those are out of scope for this milestone.


### "Will this break existing screenshots in our Slack or PR threads?"

Yes — old screenshots will show different numbers than the new rendering. We are pre-launch with friends-and-family. Not a real cost.


## Appendix — definitions

- **PR (Price Return)** — the index level reflects only the price change of constituent stocks. Dividends are dropped on the floor.
- **TR / TRI (Total Return / Total Returns Index)** — the index level reflects price change *plus* gross dividends, treated as if reinvested in the index immediately on the ex-date.
- **NTR / NTRI (Net Total Return)** — TRI minus a withholding-tax assumption on dividends. Used by some institutional benchmarks. Available alongside TRI from NSE; we persist it but don't use it yet.
- **Tracking error** — the gap between an index fund's return and its underlying index's TRI. Caused by the fund's own expenses, cash drag, sampling, etc. Out of scope for this work.
