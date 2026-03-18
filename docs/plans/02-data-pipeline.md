# ExecPlan: Milestone 2 — Data Pipeline


## Status
Complete


## Goal

Populate `nav_history` and `index_history` with fresh data every trading day so the app can show current NAV values, daily movement, and benchmark comparisons without any manual user action.


## User Value

Every time the user opens the app, their portfolio values and benchmark comparison charts reflect the most recent market close. They do not have to manually refresh or re-import data.


## Context

Builds on Milestone 1 (foundation). The schema for `nav_history`, `index_history`, and `benchmark_mapping` exists. No rows exist in `nav_history` or `index_history` yet. `benchmark_mapping` is seeded with 25 AMFI category → benchmark index mappings.

Data sources:
- **mfapi.in** — free, unauthenticated REST API for Indian mutual fund NAV data. `GET https://api.mfapi.in/mf/{scheme_code}` returns full NAV history as `{ data: [{ date: "DD-MM-YYYY", nav: "123.45" }] }`.
- **Yahoo Finance chart API** — `GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=max` returns Unix timestamps and daily closing prices. No API key required but rate limits apply.

Both functions run as Supabase Edge Functions (Deno runtime). They are triggered on a cron schedule via the Supabase Dashboard and can also be invoked manually via authenticated HTTP POST.


## Branch

`milestone/2-data-pipeline` → targets `milestone/1-foundation`


## Assumptions

- Supabase project is running and schema from Milestone 1 is applied.
- Edge Functions are deployed via `supabase functions deploy`.
- Cron schedule is configured in the Supabase Dashboard (not in `config.toml`, as pg_cron-based scheduling requires the Dashboard UI for new projects).
- Yahoo Finance returns price index data (not Total Return Index). TRI is not publicly available via any free API. The difference is acknowledged and accepted.
- CRISIL indices and some niche Nifty sub-indices have no Yahoo Finance equivalent. These are skipped gracefully.


## Definitions

- **scheme_code** — the integer identifier used by mfapi.in to identify a mutual fund scheme. Also stored in `fund.scheme_code`. Example: `100033` for Axis Bluechip Fund.
- **NAV (Net Asset Value)** — the per-unit price of a mutual fund. Updated by SEBI-registered RTAs each trading day by ~6 PM IST.
- **TRI (Total Return Index)** — a variant of a benchmark index that includes dividends reinvested. More accurate for fund comparison but not publicly available.
- **benchmark_index_symbol** — the Yahoo Finance query symbol for the benchmark (e.g. `^NSEI` for Nifty 50, `^CNX100` for Nifty 100).
- **upsert** — insert new rows; if a row with the same unique key exists, skip it (`ignoreDuplicates: true`).


## Scope

- Edge Function `sync-nav`: fetch NAV history for all active funds, upsert into `nav_history`.
- Edge Function `sync-index`: fetch index history for all benchmark symbols, upsert into `index_history`.
- Shared utility `supabase/functions/_shared/supabase-client.ts`: `createServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY`.
- Additional DB indexes migration for sync query performance.


## Out of Scope

- Triggering sync from the mobile app UI.
- Sending push notifications when sync completes.
- Historical backfill beyond what mfapi.in and Yahoo Finance already return.
- TRI data (not available via free APIs).


## Approach

Both Edge Functions follow the same pattern:
1. Query the DB to find which scheme codes / index symbols are needed.
2. Fetch data from the external API for each.
3. Batch-upsert into the history table with `ignoreDuplicates: true` (idempotent — safe to re-run).
4. Return a JSON summary `{ success, rowsUpserted, errors[] }`.

Batching: upsert in chunks of 500 rows to stay within Supabase's request size limits.

Date conversion: mfapi returns `DD-MM-YYYY`; Yahoo Finance returns Unix timestamps. Both are normalised to `YYYY-MM-DD` ISO strings before insert.

Symbol mapping: a `YF_SYMBOL_MAP` constant in `sync-index` maps internal benchmark symbols to Yahoo Finance query symbols. Symbols mapped to `null` are silently skipped.


## Alternatives Considered

- **Python Cloud Run job for yfinance** — TECH-DISCOVERY.md flagged this as a fallback if Deno can't call Yahoo Finance. Deno `fetch()` works fine against the Yahoo Finance REST endpoint, so no Cloud Run job is needed.
- **pg_cron via `config.toml`** — Supabase's local cron config. Not used because the remote project requires Dashboard-based schedule creation for Edge Function triggers.


## Milestones

### M2.1 — Shared client utility
Create `supabase/functions/_shared/supabase-client.ts` with `createServiceClient()`. This is imported by both sync functions.

File: `supabase/functions/_shared/supabase-client.ts`

    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

    export function createServiceClient() {
      return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
    }

### M2.2 — sync-nav Edge Function
File: `supabase/functions/sync-nav/index.ts`

Steps:
1. Query `fund` for distinct `scheme_code` values where `is_active = true`.
2. For each scheme code, `GET https://api.mfapi.in/mf/{schemeCode}`.
3. Convert dates: `DD-MM-YYYY` → `YYYY-MM-DD`.
4. Filter out rows where NAV is NaN.
5. Batch-upsert 500 rows at a time into `nav_history(scheme_code, nav_date, nav)` with `onConflict: 'scheme_code,nav_date'` and `ignoreDuplicates: true`.

### M2.3 — sync-index Edge Function
File: `supabase/functions/sync-index/index.ts`

Steps:
1. Query `benchmark_mapping` for distinct `benchmark_index_symbol` values.
2. Map each symbol through `YF_SYMBOL_MAP`. Skip if mapped to `null`.
3. `GET https://query1.finance.yahoo.com/v8/finance/chart/{yfSymbol}?interval=1d&range=max`.
4. Extract `result[0].timestamp[]` and `result[0].indicators.quote[0].close[]`.
5. Convert Unix timestamps to `YYYY-MM-DD`. Pair with close values; skip nulls.
6. Batch-upsert into `index_history(index_symbol, index_name, index_date, close_value)`.

### M2.4 — Performance indexes migration
File: `supabase/migrations/20260318000000_sync_performance_indexes.sql`

Indexes added:
- `nav_history(scheme_code, nav_date desc)` — fast "latest NAV for scheme" query.
- `index_history(index_symbol, index_date desc)` — fast "latest close for symbol" query.
- `fund(user_id, is_active) where is_active = true` — partial index for home screen fund list.
- `transaction(fund_id, transaction_date asc)` — XIRR cashflow fetch per fund.
- `transaction(user_id, transaction_date asc)` — portfolio-level XIRR.


## Validation

Run after deploying both functions:

    # Deploy
    supabase functions deploy sync-nav
    supabase functions deploy sync-index

    # Invoke manually (requires service role key in Authorization header)
    curl -X POST https://<project>.supabase.co/functions/v1/sync-nav \
      -H "Authorization: Bearer <service_role_key>"

    # Expected response
    { "success": true, "navRowsUpserted": 12345, "errors": [] }

    # Verify rows in DB
    select count(*) from nav_history;   -- should be > 0
    select count(*) from index_history; -- should be > 0

    # Typecheck + lint
    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings

Schedule validation: set cron to run 1 minute from now in Supabase Dashboard → observe `nav_history.created_at` timestamps updated.


## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| mfapi.in rate limits | Functions fetch schemes sequentially, not in parallel. If rate-limited, errors[] captures failures without breaking the whole run. |
| Yahoo Finance returns null close values on holidays | Null values are filtered out before upsert. |
| CRISIL/obscure symbols have no YF equivalent | `YF_SYMBOL_MAP` maps them to `null`; silently skipped with a log entry. |
| Edge Function timeout (50s default) | For large fund lists, the function may timeout. Mitigation: increase timeout in Supabase Dashboard, or split into chunked invocations in a future iteration. |


## Decision Log

- **Yahoo Finance over NSE direct API** — NSE's direct data API requires institutional access. Yahoo Finance works unauthenticated and returns sufficient historical data.
- **Price index not TRI** — TRI unavailable via any free public API. Price index is a good approximation for relative performance comparison. Documented in TECH-DISCOVERY.md.
- **ignoreDuplicates: true** — makes every sync run idempotent. Re-running the function on the same day does not create duplicate rows.


## Progress

- [x] Create `supabase/functions/_shared/supabase-client.ts`
- [x] Implement `supabase/functions/sync-nav/index.ts`
- [x] Implement `supabase/functions/sync-index/index.ts`
- [x] Add `YF_SYMBOL_MAP` for all 25 benchmark symbols
- [x] Write `supabase/migrations/20260318000000_sync_performance_indexes.sql`
- [x] Deploy both functions
- [x] Configure cron schedule in Supabase Dashboard
- [x] Verify `nav_history` and `index_history` rows populated
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings


## Amendments (post-implementation)

### Scheduling: pg_cron migration instead of Dashboard UI

The original plan assumed cron schedules would be configured via the Supabase Dashboard. In practice, the `schedule` key in `supabase/config.toml` is not supported by Supabase CLI v2.78.1 and causes parse errors on `supabase functions deploy` and `supabase db push`. The cron schedule is now managed entirely via a SQL migration (`20260319000002_enable_cron_and_sync_schedules.sql`) using `pg_cron` + `pg_net`.

Both sync functions are deployed with `--no-verify-jwt` so `pg_net.http_post` can call them from the database without needing a stored service role key.

The `config.toml` still contains the `schedule` key for documentation purposes; the GitHub Actions deploy workflow strips those lines via `sed` before invoking the Supabase CLI.

### CI/CD: GitHub Actions deploy workflow

Added `.github/workflows/supabase-deploy.yml` (committed in this milestone) to automatically deploy edge functions and run migrations on push to `main` when `supabase/functions/**` or `supabase/migrations/**` change.

Required GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`.

### Deno VS Code support

Added `supabase/functions/deno.json` to fix TypeScript errors shown by VS Code's language server for edge function files (Deno-specific APIs like `Deno.serve`, `jsr:`, `npm:` were flagged as unknown). VS Code workspace settings scope the Deno language server to `supabase/functions/` only via `.vscode/settings.json` (gitignored; each developer sets this up locally).
