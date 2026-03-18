# Fix: CAS Import via CASParser Inbound Email API


## Goal

Replace the broken onboarding flow (which asked users to manually create a CASParser account and configure a webhook) with the correct CASParser inbound email API flow, where FundLens creates a unique forwarding address for each user and the user simply forwards their CAS email to it.


## User Value

Before: user had to sign up at casparser.in, configure a webhook URL, find a forwarding address — confusing multi-step setup outside the app.

After: user taps "Generate import address", gets a one-line email address, forwards their CAS email to it, done. No external accounts needed.


## Context

CASParser provides an Inbound Email API (POST /v4/inbound-email) that returns a unique email address per request. When an email is forwarded to that address, CASParser validates the sender (must be CAMS / NSDL / CDSL / KFintech), stores the attachment as a presigned URL, and POSTs a webhook to the callback URL we specified when creating the session.

Our webhook then downloads the raw PDF and calls CASParser's parse endpoint (POST /v4/smart/parse) to get structured transaction data. CAS PDFs are password-protected using the investor's PAN number, so we must collect PAN upfront.

This plan is a targeted rework of the onboarding and data ingestion path built in milestones 3 and 2. All other milestones are unaffected.


## Assumptions

- We have a CASParser API key stored as `CASPARSER_API_KEY` in Supabase Edge Function secrets.
- The CASParser callback URL is the `cas-webhook` Edge Function URL, which is already deployed.
- PAN is not sensitive enough to require encryption at rest for MVP (it appears on tax filings and is semi-public). We store it in plaintext and revisit if compliance requires encryption.
- Supabase service role key is available to Edge Functions via `SUPABASE_SERVICE_ROLE_KEY`.


## Definitions

- **Inbound email address**: A unique `ie_xyz@import.casparser.in` address that CASParser generates. Emails sent to it are processed by CASParser.
- **CAS (Consolidated Account Statement)**: A PDF sent by CAMS / KFintech / NSDL / CDSL summarising all mutual fund holdings and transactions for an investor.
- **PAN**: Permanent Account Number — a 10-character alphanumeric ID issued by India's Income Tax department. Used as the password for CAS PDFs.
- **Inbound session**: Our DB record of a user's CASParser inbound email address.
- **reference**: A field we pass to CASParser when creating an inbound email. CASParser echoes it back in the webhook payload. We use the user's UUID as the reference so we can look up the user on the webhook call.


## Scope

1. DB migration — add `user_profile(user_id, pan)` and `cas_inbound_session(user_id, inbound_email_id, inbound_email_address)`. Remove `webhook_token` table.
2. Edge Function: `create-inbound-session` — authenticated; calls CASParser API; upserts session row; returns inbound email address.
3. Edge Function: `cas-webhook` (replace) — receives CASParser inbound-email webhook; downloads PDF; calls `/v4/smart/parse`; imports transactions.
4. Hook: `useInboundSession` — replaces `useWebhookToken`.
5. Onboarding UI — new 3-step flow: enter PAN → generate address → forward instructions.
6. Deploy and validate.


## Out of Scope

- Multiple active inbound sessions per user.
- Webhook signature verification from CASParser (deferred until CASParser documents HMAC signing).
- Password-less CAS PDFs (CAMS/KFintech always password-protect with PAN; we require PAN).
- QR and PDF manual import screens (already stubbed; unchanged here).


## Approach

### Step 1 — DB changes

Migration `20260319000000_cas_inbound_flow.sql`:

    -- user profile for PAN
    create table user_profile (
      user_id  uuid primary key references auth.users(id) on delete cascade,
      pan      text not null check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    alter table user_profile enable row level security;
    create policy "owner" on user_profile using (auth.uid() = user_id) with check (auth.uid() = user_id);

    -- inbound email session (one active session per user; upsert replaces old)
    create table cas_inbound_session (
      user_id             uuid primary key references auth.users(id) on delete cascade,
      inbound_email_id    text not null,
      inbound_email_address text not null,
      created_at          timestamptz not null default now()
    );
    alter table cas_inbound_session enable row level security;
    create policy "owner" on cas_inbound_session using (auth.uid() = user_id);

    -- drop webhook_token (replaced by reference field in CASParser payload)
    drop table if exists webhook_token;

### Step 2 — create-inbound-session Edge Function

File: `supabase/functions/create-inbound-session/index.ts`

- Require `Authorization: Bearer <JWT>` header; verify with `supabase.auth.getUser()`.
- Read `CASPARSER_API_KEY` from `Deno.env`.
- POST to `https://api.casparser.in/v4/inbound-email` with body:
  `{ reference: user.id, callback_url: <CAS_WEBHOOK_URL> }`
  Header: `x-api-key: <CASPARSER_API_KEY>`
- Expect response: `{ inbound_email_id, email }` (or similar; adjust to actual response shape).
- Upsert into `cas_inbound_session`.
- Return `{ inboundEmail: "ie_xyz@import.casparser.in" }`.

`CAS_WEBHOOK_URL` is derived from `Deno.env.get('SUPABASE_URL')` + `/functions/v1/cas-webhook`.

### Step 3 — cas-webhook Edge Function (replace)

File: `supabase/functions/cas-webhook/index.ts`

Incoming POST body from CASParser:

    {
      "inbound_email_id": "ie_abc123",
      "reference": "<user_uuid>",
      "forwarded_by": "user@gmail.com",
      "files": [{ "url": "https://storage.casparser.in/...", "expires_in": 172800 }]
    }

Steps:
1. Parse `reference` as user_id. If absent, return 400.
2. Look up `user_profile` for this user_id to get PAN. If no profile, return 400 with message "user PAN not configured".
3. Create `cas_import` row with status `processing`.
4. For each file URL:
   a. Fetch raw bytes from the presigned URL.
   b. Build FormData with `file` (blob) and `password` (PAN).
   c. POST to `https://api.casparser.in/v4/smart/parse` with `x-api-key` header.
   d. On success, iterate `mutual_funds` array → upsert `fund` rows → upsert `transaction` rows.
5. Update `cas_import` row to `completed` or `failed`.
6. Return 200.

No token validation needed — user is identified by `reference`.

### Step 4 — useInboundSession hook

File: `src/hooks/useInboundSession.ts`

- `useQuery` that fetches `cas_inbound_session` for current user.
- `createSession` mutation that calls the `create-inbound-session` Edge Function.
- Returns `{ inboundEmail, loading, createSession }`.

### Step 5 — Onboarding UI

`app/onboarding/index.tsx` — 3 steps:

- **Step 1 — Enter PAN**: text input, validates format (`/^[A-Z]{5}[0-9]{4}[A-Z]$/`), saves to `user_profile` via supabase upsert.
- **Step 2 — Generate import address**: "Generate address" button → calls `createSession` → displays `ie_xyz@import.casparser.in` in a CopyBox.
- **Step 3 — Forward your CAS email**: instructions to request and forward CAS from CAMS/KFintech.

Step 2 and 3 are disabled until step 1 is complete.


## Milestones

### M1 — DB migration applied

Run `supabase db push`. Verify `user_profile` and `cas_inbound_session` tables exist in Supabase Studio. `webhook_token` table is gone.

### M2 — create-inbound-session deployed

Run `supabase functions deploy create-inbound-session`. Test with:

    curl -X POST <SUPABASE_URL>/functions/v1/create-inbound-session \
      -H "Authorization: Bearer <user_jwt>" \
      -H "Content-Type: application/json"

Expected: `{ "inboundEmail": "ie_...@import.casparser.in" }` and a row appears in `cas_inbound_session`.

### M3 — cas-webhook deployed and handles payload

Run `supabase functions deploy cas-webhook`. Send a simulated CASParser payload with curl to confirm the function reads `reference`, looks up PAN, and returns 200 (or 400 with clear error if PAN missing).

### M4 — Onboarding UI working end-to-end

Open app, complete onboarding: enter PAN → generate address → see inbound email. Address is copyable. Step 2 blocked until PAN is saved.

### M5 — Full import flow validated

Forward a real CAS email to the generated address. Confirm transactions appear on the Home screen.


## Validation

- `npm run typecheck` and `npm run lint` pass with 0 warnings.
- Supabase migration runs without errors.
- Both Edge Functions deploy successfully.
- Simulated webhook payload returns 200.
- Real CAS forward results in imported transactions.


## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| CASParser API shape differs from docs | Inspect actual response in M2 and adjust field mapping |
| CAS PDF password wrong (PAN mismatch) | Return clear error in cas_import.error_message; surface in UI |
| Presigned URL expires before processing | Edge Function fetches immediately on webhook receipt |
| CASParser webhook retries on non-200 | Return 200 always; log errors internally |


## Decision Log

- **2026-03-18**: Replaced webhook-token approach with CASParser inbound email API per actual API documentation. Old approach required users to create a CASParser account; new approach is fully invisible to users.
- **2026-03-18**: Chose to store PAN in plaintext for MVP. Revisit with column-level encryption if compliance requires it.
- **2026-03-18**: One active inbound session per user (upsert). Multiple sessions would complicate UX with no clear benefit.


## Progress

- [ ] DB migration written and pushed
- [ ] TypeScript types regenerated
- [ ] `create-inbound-session` Edge Function written and deployed
- [ ] `cas-webhook` Edge Function replaced and deployed
- [ ] `useInboundSession` hook written
- [ ] Onboarding UI rewritten
- [ ] typecheck + lint pass
- [ ] Commit, push, PR created
