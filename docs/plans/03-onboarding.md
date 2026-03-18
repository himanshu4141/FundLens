# ExecPlan: Milestone 3 — Onboarding & CAS Import


## Status
Complete


## Goal

Enable a user to connect their mutual fund portfolio to FundLens by forwarding a CAS email through CASParser.in. After setup, every future CAS email they forward will automatically import their transactions — no manual data entry required.

Also provides two manual fallback paths: MFcentral QR code (instructions) and PDF upload (instructions, parser TBD).


## User Value

The user has funds spread across CAMS, Karvy, and MFcentral. They want to see everything in one place without typing in each transaction by hand. After a one-time 5-minute setup, their portfolio stays current automatically every time they get a CAS email.


## Context

Builds on Milestones 1 and 2. Schema has `fund`, `transaction`, `cas_import`, and `benchmark_mapping`. NAV data is being synced daily. This milestone adds:

- A `webhook_token` table for per-user authentication of incoming webhook calls.
- A `cas-webhook` Supabase Edge Function that receives and processes CASParser.in payloads.
- Real onboarding UI (replacing the stubs from Milestone 1).

**What is CASParser.in?** A third-party service that parses Indian CAS (Consolidated Account Statement) emails from CAMS, Karvy, and MFcentral. When a user forwards a CAS email to CASParser.in, it extracts the structured fund and transaction data and POSTs it as JSON to a user-configured webhook URL.

**What is a webhook?** An HTTP endpoint that receives data pushed by another service. In this case, CASParser.in calls our Supabase Edge Function URL when it finishes parsing a CAS email.


## Branch

`milestone/3-onboarding` → targets `milestone/2-data-pipeline`


## Assumptions

- The user has a CASParser.in account.
- CASParser.in supports user-configurable webhook URLs with JSON output.
- The webhook payload matches the documented shape in `cas-webhook/index.ts`.
- `expo-clipboard` is available in Expo SDK 55 for copy-to-clipboard functionality.
- Each user has at most one webhook token (enforced by `unique(user_id)` constraint).


## Definitions

- **CAS (Consolidated Account Statement)** — a monthly statement issued by CAMS, Karvy (KFintech), or MFcentral listing all mutual fund transactions and current holdings across all AMCs (Asset Management Companies).
- **folio** — a unique account number assigned by an AMC when a user first invests. One user may have multiple folios across different AMCs.
- **scheme_code / AMFI code** — a unique integer that identifies a mutual fund scheme nationally. Used by mfapi.in to fetch NAV data.
- **webhook token** — a UUID that uniquely identifies a user's webhook endpoint. Included as `?token=<uuid>` in the webhook URL. Acts as a secret — anyone with the URL can post to it on the user's behalf.
- **upsert** — insert a row; if a row with the same unique key already exists, update it instead of failing.


## Scope

- `webhook_token` DB table + RLS migration.
- `cas-webhook` Supabase Edge Function.
- `useWebhookToken` React hook (generate, display, regenerate token).
- `app/onboarding/index.tsx` — real UI for the email forwarding setup flow.
- `app/onboarding/qr.tsx` — MFcentral QR instructions.
- `app/onboarding/pdf.tsx` — PDF upload instructions.


## Out of Scope

- In-app QR code scanning (camera integration deferred).
- PDF parsing (server-side parser deferred).
- CASParser.in account creation flow (external service).
- Email forwarding rule setup (user action in Gmail/Outlook).


## Approach

### Authentication
Each user gets a unique UUID `token` stored in `webhook_token`. The webhook URL is:
`https://<project>.supabase.co/functions/v1/cas-webhook?token=<uuid>`

The Edge Function looks up the token to find the `user_id`. This avoids needing Supabase Auth headers in the incoming CASParser.in request.

### Import flow
1. CASParser.in POSTs JSON to the user's webhook URL.
2. Edge Function validates the token → looks up `user_id`.
3. Creates a `cas_import` record (audit log) with `import_status: 'pending'`.
4. Iterates `payload.folios[].schemes[]`:
   - Parses `amfi` (string) to `scheme_code` (int).
   - Looks up benchmark from `benchmark_mapping` using `scheme.type` (scheme category).
   - Upserts into `fund(user_id, scheme_code, ...)` with `onConflict: 'user_id,scheme_code'`.
   - Maps transactions → upserts into `transaction` with dedup constraint.
5. Updates `cas_import` record with final status, counts, and any error message.

### Date parsing
CASParser.in sends dates as `DD-MMM-YYYY` (e.g. `17-Mar-2026`). The function converts these to ISO `YYYY-MM-DD` using a `MONTHS` lookup table.

### Transaction type normalisation
CASParser.in may send free-text types or descriptions. The `normalizeTxType()` function maps these to our enum: `purchase | redemption | switch_in | switch_out | dividend_reinvest`.

### Token regeneration
Regenerating a token: delete the existing row, insert a new one. The old webhook URL immediately stops working. Users must update CASParser.in with the new URL.


## Alternatives Considered

- **Shared API key in request header** — rejected because it requires CASParser.in to support custom headers, which is not guaranteed. Query parameter token is more universally compatible.
- **Supabase Auth JWT in webhook** — rejected because CASParser.in cannot obtain a Supabase JWT. Per-user token table is the correct pattern for webhook authentication.
- **One shared webhook URL with user identifier in payload** — rejected because it would expose all users' data to anyone who can POST to the shared URL. Per-user tokens give individual revocability.


## Milestones

### M3.1 — webhook_token migration
File: `supabase/migrations/20260318000001_webhook_token.sql`

    create table webhook_token (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid not null references auth.users(id) on delete cascade,
      token      uuid not null default gen_random_uuid(),
      created_at timestamptz not null default now(),
      unique(user_id),
      unique(token)
    );

Enable RLS: users can read and manage their own token only. Add an index on `token` for fast Edge Function lookup (no auth context available there).

Run: `supabase db push`

### M3.2 — cas-webhook Edge Function
File: `supabase/functions/cas-webhook/index.ts`

Accepts `POST /?token=<uuid>`. Validates token, creates import record, processes folios/schemes/transactions, updates import record. Returns `{ success, fundsUpdated, transactionsAdded }`.

Deploy: `supabase functions deploy cas-webhook`

### M3.3 — useWebhookToken hook
File: `src/hooks/useWebhookToken.ts`

TanStack Query hook. Fetches existing token. Exposes `createToken` mutation (insert) and `regenerateToken` mutation (delete + insert). Computes `webhookUrl` from env var + token.

### M3.4 — Onboarding screens (real UI)
- `app/onboarding/index.tsx` — 3-step guide: (1) generate webhook URL with copy button, (2) CASParser.in setup instructions, (3) email forwarding instructions. Alternative import cards linking to QR and PDF screens.
- `app/onboarding/qr.tsx` — step-by-step MFcentral QR instructions + "coming soon" scanner notice.
- `app/onboarding/pdf.tsx` — instructions for downloading CAS PDFs from CAMS/Karvy/MFcentral + "coming soon" upload notice.

Install `expo-clipboard` for copy-to-clipboard:

    npx expo install expo-clipboard


## Validation

    # Apply migration
    supabase db push

    # Regenerate types (webhook_token table now exists)
    npm run gen:types

    # Deploy function
    supabase functions deploy cas-webhook

    # Test with curl (use a real token from the app)
    curl -X POST "https://<project>.supabase.co/functions/v1/cas-webhook?token=<uuid>" \
      -H "Content-Type: application/json" \
      -d '{ "folios": [{ "folio": "123456/01", "schemes": [{ "scheme": "Axis Bluechip Fund", "amfi": "120503", "type": "Large Cap Fund", "transactions": [{ "date": "01-Jan-2025", "amount": 10000, "units": 100, "nav": 100 }] }] }] }'

    # Expected: { "success": true, "fundsUpdated": 1, "transactionsAdded": 1 }
    # Check DB: select * from fund; select * from transaction; select * from cas_import;

    # Typecheck + lint
    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings


## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| CASParser.in payload schema changes | Defensive type casting with fallbacks; `cas_import.raw_payload` stores the full JSON for debugging |
| User regenerates token, breaks existing forwarding setup | Alert dialog warns the user before regenerating |
| Webhook token exposed in URL (appears in server logs) | Acceptable trade-off for CASParser.in compatibility; token can be regenerated if compromised |
| Duplicate transactions on re-import | `unique(fund_id, transaction_date, transaction_type, units, amount)` constraint + `ignoreDuplicates: true` |


## Decision Log

- **Token in query param not header** — CASParser.in supports configuring a webhook URL but not custom headers. Query param is the only viable option.
- **Per-user token table** — gives each user an individually revocable credential. A shared secret would require revoking all users.
- **cas_import raw_payload** — storing the full payload as JSONB enables debugging when parsing fails without losing data.
- **Date format DD-MMM-YYYY** — CASParser.in uses month abbreviations (Jan, Feb, ...) not zero-padded numbers. The `MONTHS` map handles this explicitly.


## Progress

- [x] Write and apply `supabase/migrations/20260318000001_webhook_token.sql`
- [x] Regenerate `src/types/database.types.ts`
- [x] Implement `supabase/functions/cas-webhook/index.ts`
- [x] Deploy `cas-webhook` Edge Function
- [x] Implement `src/hooks/useWebhookToken.ts`
- [x] Install `expo-clipboard`
- [x] Rewrite `app/onboarding/index.tsx` with real 3-step UI
- [x] Write `app/onboarding/qr.tsx` with MFcentral QR instructions
- [x] Write `app/onboarding/pdf.tsx` with PDF upload instructions
- [x] Exclude `supabase/functions/` from `tsconfig.json` and `eslint.config.js`
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings
