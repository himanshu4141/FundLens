# M2 — Resend Inbound Email + Per-User Auto-Refresh


## Goal


Replace the CASParser-based email forwarding flow with a self-hosted equivalent on `foliolens.in` using Resend's Inbound Routes. Each user gets a unique inbound address; emails sent there are parsed by our Edge Function and imported automatically. Removes a paid third-party dependency, lands import notifications inside our own infrastructure, and unlocks set-and-forget refresh for users willing to set up a Gmail filter once.


## User Value


Today, refreshing a portfolio means re-running the entire upload flow once a month. Most users won't bother. After M2, a user who completes a 30-second one-time Gmail filter setup never has to think about CAS again — every monthly RTA email lands in our webhook and the portfolio updates itself. We also retire the CASParser subscription, simplifying the bill and the codebase.


## Context


- M1 (the upload-first onboarding) must land first. M2 adds the auto-refresh card to Step 3 of that wizard and a post-import nudge.
- The domain `foliolens.in` is already verified with Resend for outbound transactional email (magic-link sign-in). Inbound is a separate Resend product on the same domain — DNS adds two MX records, no other infra change.
- The current `cas-webhook` Edge Function on `main` accepts a CASParser-shaped payload (`{ reference, files: [{ url }] }`) and looks up the user via the `reference` field (which CASParser populates from the inbound-session metadata). Resend's payload shape is different and our webhook has to be rewritten.
- Two CASParser-coupled Edge Functions exist on `main`: `request-cas` (programmatically asks KFintech to email a CAS) and `create-inbound-session` (creates a per-user CASParser inbound mailbox). Both are called from at least 7 sites in the app today. M2 replaces them with our own equivalents and removes their callers.
- The `user_profile` table already has `pan`, `dob`, `kfintech_email`. We will add `cas_inbox_token`.


## Assumptions


- Resend Inbound is available on the existing FolioLens Resend account at no incremental cost for the volumes we expect (a few hundred users × ~1 email/month each). If it isn't, the same pattern works with Postmark, SendGrid Inbound Parse, or Cloudflare Email Routing — only the webhook adapter changes.
- Resend Inbound supports plus-addressing or wildcard routing (`cas+anything@foliolens.in` → one webhook). Confirmed by Resend docs.
- The Vercel-hosted CAS PDF parser at `${APP_BASE_URL}/api/parse-cas-pdf` accepts raw PDF bytes (this is already true).
- We are willing to delete `request-cas` (RTA email is no longer triggered server-side; user requests CAS themselves via the M1 portal flow).


## Definitions


- **Inbox token** — an 8-character random opaque string per user, e.g. `cas+a8k3z9p2@foliolens.in`. Used by Resend's plus-addressing to route inbound emails. Distinct from the user's UUID so it's safe to expose to Gmail filter UI.
- **Resend Inbound Route** — a Resend dashboard configuration that points an inbound address (or pattern) at a webhook URL. We register one route: `cas+*@foliolens.in` → `https://<project>.supabase.co/functions/v1/cas-webhook-resend`.
- **Auto-forward filter** — a Gmail / Outlook filter the user creates that automatically forwards messages from `donotreply@camsonline.com` (etc.) to their inbox token address.


## Scope


- Add `cas_inbox_token` column to `user_profile` with a generation trigger
- Add Edge Function `cas-webhook-resend` that accepts Resend's inbound payload, decodes the inbox token from the To address, looks up the user, decodes attachments, and calls `parse-cas-pdf` for each PDF
- Configure Resend MX records and Inbound Route (manual; documented inline)
- Add Step 3 "auto-refresh" card to the M1 wizard (currently a placeholder)
- Add a post-import nudge ("Set this up once and never re-upload") that surfaces on Step 4 (Done) of M1
- Add Settings → Account → "Auto-refresh status" row that shows the user's inbox address and a "Copy" button
- Delete `request-cas` and `create-inbound-session` Edge Functions and their call sites in the app code
- Deprecate the `CASPARSER_API_KEY` environment variable on Supabase Edge runtime (manual)


## Out of Scope


- Verifying that the user actually set up the Gmail filter — out of scope; we just show the address and rely on the user
- Detecting and de-duplicating reimports of the same PDF — already handled by `import-cas.ts` via per-folio reconciliation
- Any UI for users to disable / regenerate their inbox token — defer to M3 if needed


## Approach


When a user completes M1, they have a portfolio. On the post-import screen we show a card "Set up auto-refresh". Tapping it surfaces a sheet with their personal forwarding address `cas+abc123@foliolens.in`, a Copy button, and a "Show me how" link that opens an explainer with platform-specific instructions for Gmail (auto-forward + filter) and Outlook (rule).


On the backend side, a new Edge Function `cas-webhook-resend` accepts Resend's webhook payload, parses out the inbox token from `to`, resolves the user, then runs the same import path that M1's upload uses — namely POSTing the PDF bytes to the existing Vercel parser and handing the result to the shared `import-cas.ts` helper.


We deliberately keep the parsing path unified (one `parse-cas-pdf` Vercel endpoint, one `import-cas.ts` helper) so M1's upload and M2's email-in produce identical outcomes. Tests for the import path don't multiply.


## Alternatives Considered


- **Cloudmailin** (PR #75's approach) — generic email-to-webhook tool. Works, but adds a second email vendor on top of Resend. Rejected.
- **Cloudflare Email Routing** — free, but limited to forwarding (not webhooking). Could chain it to a Cloudflare Worker, but that is a third infra silo.
- **Keep CASParser** — the existing flow already works. Rejected because the user explicitly wants to drop CASParser and consolidate on `foliolens.in`.


## Milestones


### M2.1 — Schema + token generation


- New migration `<timestamp>_user_feedback_inbox_token.sql`:
  - Adds `cas_inbox_token text unique` to `user_profile`
  - Adds a function `gen_cas_inbox_token()` returning a random 8-char base32 string (not 0/O/1/l)
  - Adds a `BEFORE INSERT` trigger that fills the column when null on row insert
  - Backfills existing rows: `update user_profile set cas_inbox_token = gen_cas_inbox_token() where cas_inbox_token is null`
- Update `database.types.ts`
- Acceptance: `select cas_inbox_token from user_profile where user_id = ...` returns a unique 8-char string for every existing and new user


### M2.2 — Resend Inbound Route + DNS (manual, documented)


- Add MX records for `foliolens.in` per Resend's inbound docs
- Create a Resend Inbound Route: pattern `cas+*@foliolens.in`, webhook `https://<project-ref>.supabase.co/functions/v1/cas-webhook-resend`, signing secret `RESEND_INBOUND_SECRET`
- Set the secret on the prod and dev Supabase Edge runtime
- Smoke test: send an email with a small PDF attachment to `cas+TESTTOKEN@foliolens.in`, observe the webhook fire (function will 404 because user lookup fails — that's OK for smoke)
- Acceptance: Resend dashboard shows the route receiving the test email and POSTing to the webhook


### M2.3 — Edge function `cas-webhook-resend`


- Create `supabase/functions/cas-webhook-resend/index.ts`:
  - Verify Resend signature using `RESEND_INBOUND_SECRET`
  - Parse the To header, extract the `+token` portion
  - Look up `user_profile` by `cas_inbox_token`; reject 404 if no match
  - For each PDF attachment, decode base64 → POST to `${APP_BASE_URL}/api/parse-cas-pdf` with the user's PAN as password (and `cdsl_password` for CDSL/NSDL fallback)
  - Run `importCASData` from `_shared/import-cas.ts`
  - Insert a `cas_import` row with `import_source = 'email'`
  - Return 200 on either success or expected user errors so Resend doesn't retry
- Deploy with `--no-verify-jwt` (Resend cannot send a Supabase JWT)
- Add structured logs at invocation, user-resolution, per-attachment, and completion (per existing project convention)
- Acceptance: dev test email with a real CAS PDF imports successfully, `cas_import` table reflects the run


### M2.4 — Wizard Step 3 auto-refresh card + post-import nudge


- Replace the placeholder "auto-refresh" card in M1's Step 3 with the real flow
- Tapping opens a bottom sheet showing the user's address `cas+abc123@foliolens.in`, a copy button, and a "Set up Gmail forwarding" CTA that opens an in-app browser to the Gmail filter URL `https://mail.google.com/mail/u/0/#settings/filters` with on-screen instructions
- After M1.5's done step, show a single-card nudge "Set this up once and we'll keep your portfolio fresh" with the same sheet
- Acceptance: a user can copy the address, set up a Gmail filter manually, and receive the auto-refresh next time CAMS emails them. Devtools / dashboard shows the inbound webhook firing.


### M2.5 — Settings hook + analytics


- Add a Settings → Account → "Auto-refresh inbox" row that shows the address + copy button
- Surface the last `cas_import` row's status and timestamp on the same row ("Last refresh: 2 hours ago")
- Acceptance: refreshing the row after sending a test email updates the timestamp


### M2.6 — Retire CASParser


- Delete `supabase/functions/request-cas/`
- Delete `supabase/functions/create-inbound-session/`
- Remove all `supabase.functions.invoke('request-cas', ...)` and `supabase.functions.invoke('create-inbound-session', ...)` call sites — replace with a router push to the M1 import wizard
- Remove `CASPARSER_API_KEY` from `.env.example`, request that the user removes it from Supabase secrets manually
- Acceptance: `grep -r "casparser\|request-cas\|create-inbound-session" src/ app/ supabase/ docs/` returns nothing in code (docs may still mention historical context)


### M2.7 — Tests + manual validation


- Unit tests for the inbox-token generator (uniqueness, character set)
- Unit tests for the To-header parser (handles `<cas+abc@foliolens.in>` and `cas+abc@foliolens.in` and quoted forms)
- Edge function happy-path test using a recorded Resend payload fixture
- Manual checklist:
  - Send a real CAS PDF email from CAMS to your token address — webhook fires, import succeeds
  - Tamper with signature → webhook rejects with 401
  - Token mismatch → webhook returns 404
  - Settings row shows updated last-refresh timestamp
  - Sign-out clears local state but token persists in DB


## Validation


- `npm run typecheck` — zero errors
- `npm run lint` — zero warnings
- `npx jest --ci` — all suites pass
- Migration applies cleanly to dev and prod via the existing `supabase-deploy-{dev,prod}.yml` workflows
- One real CAMS email and one real KFintech email each round-trip end-to-end during M2.7 manual validation


## Risks And Mitigations


- **Risk**: Resend Inbound has a delivery hiccup and emails are silently dropped. Mitigation: log every webhook fire to `cas_import` with the raw payload (hash) so we can reconcile against Resend's dashboard.
- **Risk**: User forwards an email that isn't a CAS (random PDF). Mitigation: parser already returns "no mutual fund data found" — webhook records this in `cas_import` with a clear error message, user sees it in Settings.
- **Risk**: Spam to `cas+*@foliolens.in`. Mitigation: only attachments with content-type `application/pdf` and size < 10 MB are processed; everything else returns 200 silently.
- **Risk**: User deletes the inbox token by accident (UI bug or manual SQL). Mitigation: token is generated by trigger on insert; provide a "Regenerate token" admin path in M3 if it becomes a real issue.
- **Risk**: CASParser-using code paths are missed during M2.6 cleanup. Mitigation: the grep step in M2.6's acceptance is the gating check.


## Decision Log


- 2026-05-04 — Chose Resend Inbound over Cloudmailin to consolidate email vendors on the existing `foliolens.in` Resend account.
- 2026-05-04 — Chose plus-addressing (`cas+token@foliolens.in`) over wildcard subdomain (`cas-<token>@foliolens.in`) because plus-addressing requires no DNS change beyond the one MX record set.
- 2026-05-04 — Decided not to verify Gmail filter completion (no programmatic way to detect it; would over-engineer the milestone).


## Progress


- [ ] M2.1 — Inbox-token schema + generation + backfill
- [ ] M2.2 — Resend Inbound Route + DNS
- [ ] M2.3 — `cas-webhook-resend` Edge Function
- [ ] M2.4 — Auto-refresh card + post-import nudge
- [ ] M2.5 — Settings row + last-refresh display
- [ ] M2.6 — Retire CASParser code paths
- [ ] M2.7 — Tests + real-email validation

---

## Amendments

### 2026-05-04 — Pause for desktop shell + dark mode rebase

PR #93 is parked as **draft** alongside #92 while PR #97 (dark mode + classic-theme retirement) is in flight. Most of M2 is backend (Edge Function, migration, token utility) and is **unaffected** by #97 / desktop shell. The UI pieces (auto-refresh card, Settings row, banners) need a theming pass.

#### Post-#97 rebase checklist for M2

Backend (no change):

- `cas_inbox_token` migration, `gen_cas_inbox_token()` helper, BEFORE INSERT trigger, per-row backfill — independent of UI work.
- `cas-webhook-resend` Edge Function — independent of UI work.
- `casInboxToken.ts` parser/formatter helpers + tests — independent of UI work.

UI (rebase + reskin):

- **Auto-refresh card** (M2.4). Re-skin against new theme tokens; verify light + dark + system. Confirm the card looks right inside `DesktopContainer` at ≥1024 px (it currently assumes a phone-width column).
- **Settings row + last-refresh display** (M2.5). Same theming pass — Settings hub already has a desktop max-width frame, so layout-wise this should drop in cleanly.
- **Post-import nudge banner.** Verify it still renders correctly above any new desktop chrome that #97 introduces (top bar, theme toggle, etc.).
- **`useInboundSession` hook.** No theming surface, but if #97 adds a `useTheme()` hook the consuming UI will need to be touched.

#### Sequencing recommendation

If the rebase proves cheap (UI-only and small), keep M2 as a single PR. If desktop + dark mode forces meaningful rework on the auto-refresh card, consider splitting:

1. **M2-backend** — migration + Edge Function + token utility (mergeable independent of #97).
2. **M2-ui** — auto-refresh card + Settings row + banner (rebased on top of #97 + M1).

This split would let beta testers exercise the inbound webhook end-to-end before the wizard rebase lands.
