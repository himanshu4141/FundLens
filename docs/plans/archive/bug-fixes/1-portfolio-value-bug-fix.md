# Portfolio Value Inflation Bug Fix


## Goal

Fix a bug where importing a CAS statement causes the portfolio's total unit count and value to be higher than the actual invested position, making the portfolio appear more valuable than it really is.


## User Value

A user who imports their CAS PDF or forwards a CAS email sees an inflated portfolio value. The numbers they see do not match their actual holdings. After this fix, the imported portfolio value correctly reflects only real purchase, redemption, and switch transactions — tax line items and reversal entries no longer add phantom units.


## Context

CAS statements produced by CAMS and KFintech include transaction types beyond simple purchases and redemptions. The `CASParser` library (used to parse the PDF) emits the following uppercase type strings:

    PURCHASE, PURCHASE_SIP, REDEMPTION, SWITCH_IN, SWITCH_IN_MERGER,
    SWITCH_OUT, SWITCH_OUT_MERGER, DIVIDEND_PAYOUT, DIVIDEND_REINVEST,
    SEGREGATION, STAMP_DUTY_TAX, TDS_TAX, STT_TAX, MISC, REVERSAL, UNKNOWN

Before this fix, the shared import function `supabase/functions/_shared/import-cas.ts` handled only the first block of types. Anything else — including `REVERSAL` and all tax line items — fell through a default of `'purchase'`, causing the importer to add units for entries that should either subtract units (reversals of failed payments) or be skipped entirely (stamp duty, STT, TDS, etc.).

The shared function is used by two edge functions:

- `supabase/functions/cas-webhook/index.ts` — inbound email CAS flow
- `supabase/functions/parse-cas-pdf/index.ts` — manual PDF upload flow

Both flows were affected.

A separate but related Android bug caused the PDF upload to silently fail: `fetch()` does not support `file://` URIs on Android, so the PDF bytes were never read and the import never started.

A third issue caused mobile visitors on preview deployments to be redirected to the native app instead of completing their OAuth login in the browser.


## Assumptions

- `REVERSAL` represents a failed-payment undo: the original purchase was rejected, so the units were never actually allocated. Treating it as a redemption (subtract units) is the correct model for portfolio accounting.
- `SEGREGATION`, `STAMP_DUTY_TAX`, `TDS_TAX`, `STT_TAX`, `MISC`, and `UNKNOWN` carry no unit or NAV meaning that should affect portfolio holdings. They are skipped entirely.
- An empty or completely unrecognised type string is also skipped (returns `null`) rather than defaulting to `'purchase'`.
- Users who imported before this fix may have stale `purchase` rows for every `REVERSAL` transaction in their history. The fix cleans these up automatically on the next import.
- GitHub Actions runners use IPv4 only; the Supabase direct DB connection is now IPv6-only and must be avoided in CI.


## Definitions

- **CAS** — Consolidated Account Statement: a PDF from CAMS or KFintech listing every mutual fund transaction for a PAN.
- **REVERSAL** — A CASParser type for a failed-payment return. The purchase order was placed but payment failed, so no units were actually allocated. The transaction is the broker undoing the purchase entry.
- **`normaliseTxType`** — The function in `import-cas.ts` that maps CASParser type strings to the DB enum values (`purchase`, `redemption`, `switch_in`, `switch_out`, `dividend_reinvest`, `dividend`). Returns `null` for types that should be skipped.
- **Management API path** — `supabase db push` after `supabase link` uses HTTPS to the Supabase Management API rather than a direct Postgres connection, which avoids the IPv6 connectivity issue on GitHub runners.


## Scope

1. Fix `normaliseTxType` to return `null` for all non-accounting types and map `REVERSAL` to `redemption`.
2. Filter out `null`-typed transactions before the DB upsert.
3. On re-import, delete previously mis-imported `purchase` rows that correspond to `REVERSAL` entries.
4. Fix PDF upload on Android to use XHR (supports `file://` and `content://` URIs) instead of `fetch`.
5. Fix auth redirect to only bridge mobile browsers to the native app when on the production host, not on preview deployments.
6. Fix CI db push to use the Management API path (IPv4/HTTPS) instead of a direct DB URL connection.
7. Add comprehensive tests for `normaliseTxType`, `parseDate`, and `importCASData`, including all edge cases.
8. Ensure full quality gate passes: zero typecheck errors, zero lint warnings, all tests green, coverage thresholds met.
9. Deploy both affected edge functions (`cas-webhook`, `parse-cas-pdf`).


## Out of Scope

- Retroactively correcting existing portfolio totals already in the DB (the re-import flow in scope handles this for `REVERSAL` entries; other skipped types had zero unit impact so leave no residue).
- Replacing `CASParser` as the parsing library.
- Fixing unit calculation logic beyond the type-mapping error.
- Changes to the email-forwarding pipeline other than the shared import function.


## Approach

### Core fix — `normaliseTxType` return type change

Change the return type from `string` to `string | null`. Any caller that receives `null` must skip the transaction. The upsert pipeline already filters rows before insertion, so adding `.filter(tx => tx.transaction_type !== null)` is sufficient.

### REVERSAL cleanup on re-import

When the importer encounters `REVERSAL` entries, it issues a targeted `.delete()` to remove any `purchase` row that matches on `fund_id`, `transaction_date`, `units`, and `amount`. This is idempotent — if no such row exists the delete is a no-op. This corrects stale data for users who imported before the fix without requiring a migration.

### Android PDF upload

Replace `fetch(asset.uri)` with an `XMLHttpRequest` call. XHR's `responseType = 'arraybuffer'` works correctly with both `file://` (local filesystem picks) and `content://` (Android document provider URIs). The resulting `ArrayBuffer` is passed directly to `supabase.functions.invoke` as the body.

### Auth preview guard

Check `window.location.hostname === 'fund-lens.vercel.app'` before redirecting mobile browsers to the `fundlens://` scheme. Preview deployments use a different hostname and should complete the OAuth session in the browser.

### CI db push

Run `supabase link --project-ref` before `supabase db push --yes`. Linking sets the project context so `db push` uses the Management API rather than a direct DB connection.


## Milestones


### M1 — Core import fix (done)

Files: `supabase/functions/_shared/import-cas.ts`

Changes:
- `normaliseTxType` return type widened to `string | null`
- `REVERSAL` → `'redemption'`
- `SEGREGATION`, `STAMP_DUTY_TAX`, `TDS_TAX`, `STT_TAX`, `MISC`, `UNKNOWN`, empty string, and unrecognised strings → `null`
- REVERSAL cleanup delete loop added before upsert
- Upsert filter updated to exclude `null` transaction types
- `SupabaseClient` type extracted locally to avoid Deno-only JSR import in tests

Acceptance: `normaliseTxType('REVERSAL')` returns `'redemption'`; `normaliseTxType('STT_TAX')` returns `null`; a CAS with only tax-line transactions imports 0 rows.


### M2 — Platform fixes (done)

Files: `app/onboarding/pdf.tsx`, `app/auth/callback.tsx`, `app/auth/confirm.tsx`

Changes:
- PDF upload uses XHR with `arraybuffer` response type
- Auth callback/confirm check `isNativeBridgeHost` before redirecting to native scheme

Acceptance: PDF upload works on Android; preview-deployment mobile logins stay in-browser.


### M3 — CI fix (done)

File: `.github/workflows/supabase-deploy.yml`

Changes:
- `supabase link --project-ref` step added before `db push`
- `db push --db-url` replaced with `db push --yes`
- `SUPABASE_DB_URL` secret no longer required

Acceptance: `Deploy Supabase` workflow passes on main pushes.


### M4 — Tests (done)

Files: `supabase/functions/_shared/__tests__/import-cas.test.ts`, `jest.config.js`

Changes:
- 65 tests for `normaliseTxType` (all type families), `parseDate` (ISO, DD-Mon-YYYY, empty, invalid, unrecognised passthrough), and `importCASData` (zero transactions, AMFI missing, full happy path, benchmark mapping, fund/scheme/transaction upsert errors)
- Jest config: `testMatch` and `collectCoverageFrom` extended to include shared edge-function tests

Acceptance: `npx jest` — 65 tests pass, 0 failures.


### M5 — Coverage threshold enforcement (done)

File: `jest.config.js`

Changes:
- Added per-path coverage threshold for `supabase/functions/_shared/`:
  `{ lines: 100, statements: 100, branches: 80, functions: 100 }`
- Enforces regression prevention: any future code added to `import-cas.ts` without tests will fail CI

Acceptance: `npx jest --coverage` — no threshold failures for `_shared/`.


### M6 — Deploy edge functions (done)

Deployed via Supabase MCP tool:
- `cas-webhook` — v25
- `parse-cas-pdf` — v31

Both functions show a deployment timestamp after the date of the last commit on this branch.


### M7 — PR (done)

Full quality gate passed:
- `npm run typecheck` — zero errors
- `npm run lint` — zero warnings
- `npx jest --coverage` — all tests pass, thresholds met

PR raised from `claude/fix-portfolio-value-bug-2YLPO` → `main`.


## Validation


    # Full quality gate
    npm run typecheck
    npm run lint
    npx jest --coverage

    Expected:
    - tsc: no output (zero errors)
    - eslint: no output (zero warnings)
    - jest: 342+ tests pass, no threshold failures

    # Confirm edge function deploy timestamps (via Supabase Dashboard or MCP)
    # Both cas-webhook and parse-cas-pdf should show a timestamp >= the branch date.


## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| REVERSAL cleanup delete hits wrong rows (e.g., coincidental same date+units+amount for a real purchase) | Delete is scoped to `fund_id + transaction_date + units + amount`; a genuine coincidence is vanishingly unlikely given the four-column key. |
| Re-deploying edge functions interrupts live import in progress | Edge function deploys are atomic; in-flight requests complete on the old version. Risk is negligible. |
| Coverage threshold for `_shared/` is too tight | Set branch threshold at 80% (not 100%) to accommodate conditional paths that require complex mock setups. |


## Decision Log

- **2026-04-27** — Chose to treat REVERSAL as `redemption` rather than a distinct new DB enum value. Rationale: redemption correctly subtracts units in the existing accounting model; introducing a new enum value would require a DB migration and UI handling. The economic effect is identical.
- **2026-04-27** — Chose XHR over a React Native file-reading library for the Android PDF fix. Rationale: XHR is available in the existing RN WebView environment; no new dependency needed.
- **2026-04-27** — Chose to scope the auth host guard to `fund-lens.vercel.app` hardcoded rather than an env var. Rationale: the production bridge URL is stable; an env var would require Vercel config changes for every preview deployment.


## Progress

- [x] M1 — Core import fix (`normaliseTxType` return type, REVERSAL handling, null filter, cleanup delete)
- [x] M2 — Platform fixes (Android PDF XHR, auth host guard)
- [x] M3 — CI db push fix (Management API path)
- [x] M4 — Tests (65 tests, jest config extended)
- [x] M5 — Coverage threshold enforcement (`_shared/` threshold added to jest.config.js)
- [x] M6 — Deploy edge functions (cas-webhook v25, parse-cas-pdf v31)
- [x] M7 — PR raised


## Amendments

**Schema refactor (PR #57)**: After this plan was written, main merged a refactor splitting the `fund` table into `scheme_master` + `user_fund`. The core bug fix commits (M1–M3) were rebased and adapted as part of that PR. This plan documents the original intent; the actual implementation in main reflects the updated schema.

**Coverage tests already in main**: By the time this plan's PR was rebased, the three coverage-gap tests from M4 (benchmark mapping, transaction upsert error, `parseDate` passthrough) had already been merged to main via the test suite evolution accompanying PR #57. The unique contribution of this PR is the `_shared/` coverage threshold (M5) and this ExecPlan.
