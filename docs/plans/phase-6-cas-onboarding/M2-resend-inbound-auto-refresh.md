# Phase 6 / M2 — Resend Inbound Email + Per-User Auto-Refresh

## Goal

Replace the CASParser-based email forwarding flow with a self-hosted equivalent on `foliolens.in` using Resend receiving plus a production Vercel inbound router. Each user gets a unique inbound address; emails sent there are parsed by our Edge Function and imported automatically. Removes a paid third-party dependency, lands import notifications inside our own infrastructure, and unlocks one-tap (or fully-automatic, pending feasibility) refresh for users willing to forward their next CAS email.

## User Value

Today, refreshing a portfolio means re-running the entire upload flow once a month. Most users won't bother. After M2, a user who forwards their next CAMS / KFintech CAS email one time gets that import done without re-uploading; if their mail client supports a verified auto-forward filter, every future CAS lands automatically and the portfolio updates itself. We also retire the CASParser subscription, simplifying the bill and the codebase.

## Context

- **M1 must land first.** M2 adds the auto-refresh card to Step 3 of M1's wizard and a post-import nudge on Step 4.
- The domain `foliolens.in` is already verified with Resend for outbound transactional email (magic-link sign-in). Inbound is now also on the apex domain because the Resend free plan allows only one verified domain; subdomain-based dev/prod routing would require a paid plan.
- We have **one Resend account and one verified domain** (`foliolens.in`) but **two app environments** (dev + preview, prod). M2 must namespace inbound addresses so dev / prod don't share users' tokens or routing — see "Dev / prod environment differentiation" below.
- The current `cas-webhook` Edge Function on `main` accepts a CASParser-shaped payload and looks up the user via the `reference` field. Resend's payload shape is different and our webhook has to be rewritten.
- Two CASParser-coupled Edge Functions exist on `main`: `request-cas` (programmatically asks KFintech to email a CAS) and `create-inbound-session` (creates a per-user CASParser inbound mailbox). Both are called from the legacy onboarding screen which M1 retires.
- The `user_profile` table already has `pan`, `dob`, `kfintech_email`. M2 adds `cas_inbox_token`.
- **Theme + desktop reality.** Like M1, M2's UI surfaces (auto-refresh card on Step 3, post-import nudge on Step 4, Settings row) must read colors from `useClearLensTokens()`, define styles inside `makeStyles(tokens)`, and render correctly inside the desktop sidebar shell.

## Dev / prod environment differentiation

Single domain, single Resend account, and one Resend webhook endpoint. Resend owns the apex MX records for `foliolens.in` and POSTs every inbound `email.received` event to the Vercel router at `https://app.foliolens.in/api/resend-inbound-router`. The router verifies the Resend Svix signature, then routes by recipient local-part:

| Env  | User-facing address                | Resend Inbound pattern        | Webhook target                                 |
|------|-------------------------------------|-------------------------------|-------------------------------------------------|
| Dev  | `cas-dev-<token>@foliolens.in`      | all mail to `foliolens.in`    | Vercel router → `https://<dev-project-ref>.supabase.co/functions/v1/cas-webhook-resend` |
| Prod | `cas-<token>@foliolens.in`          | all mail to `foliolens.in`    | Vercel router → `https://<prod-project-ref>.supabase.co/functions/v1/cas-webhook-resend` |

The same router also replaces Cloudflare Email Routing for human aliases:

- `hello@foliolens.in`
- `support@foliolens.in`
- `privacy@foliolens.in`
- `security@foliolens.in`

Those aliases are forwarded to the owner Gmail using Resend's send API, with `reply_to` set to the original sender. Unknown recipients return 200 and are dropped.

The wizard / Settings UI still builds addresses from environment-aware helpers, but the environment marker now lives in the local-part (`cas-dev-…` for dev, `cas-…` for prod), not the domain. The Supabase Edge Function still reads `INBOUND_DOMAIN=foliolens.in` and verifies the original Resend `svix-*` signature forwarded by the router.

## Auto-forward feasibility discovery

The original M2 sketch leaned on a one-time Gmail / Outlook filter that auto-forwards every CAS email to the user's private CAS address. That assumed Gmail still allows arbitrary auto-forward filters. **It does not.** Since 2018, Gmail requires that the destination address either (a) be on a Google Workspace domain that has been allowlisted by the destination admin, or (b) confirm ownership by clicking a link Google emails to the destination address.

For our setup, option (a) is unavailable (we are not a Google Workspace tenant for `foliolens.in`). Option (b) means the confirmation email lands at `cas-<token>@foliolens.in` (or `cas-dev-<token>@foliolens.in` on dev) — i.e. it passes through the Vercel router and then hits our `cas-webhook-resend` Edge Function. We currently have no path to surface that confirmation link back to the user inside FolioLens.

Outlook (consumer + Microsoft 365), Apple Mail / iCloud, and Yahoo Mail likely have similar verification flows; we have not yet confirmed each.

### Discovery deliverables (M2.0, must complete before M2.4)

- **Document each major mail client's auto-forward verification flow** (Gmail consumer, Gmail Workspace, Outlook.com, Microsoft 365, iCloud, Yahoo). For each: does it require destination verification, and if so, how is the verification email delivered.
- **Decide one of three paths** based on what the discovery turns up:
  1. **Auto-forward path remains viable.** The Edge Function detects a verification email (sender pattern `forwarding-noreply@google.com` etc.), extracts the confirmation link, surfaces it to the user via the Settings → Auto-refresh row.
  2. **Manual-forward only.** Drop the auto-forward pitch entirely; M2.4's card pitches "Forward your next CAS email and your portfolio updates automatically — no auto-forward filter needed." User forwards each monthly CAS by hand. Still cheaper than re-uploading.
  3. **Hybrid.** Try auto-forward; if the user's client doesn't support it, fall back to manual-forward instructions.
- **Update the copy catalog in `00-onboarding-redesign.md` and the Settings hint copy** to match whichever path is chosen.

This discovery unblocks M2.4 (auto-refresh card UX) and M2.5 (Settings row copy). Until it's done, the M2 backend (M2.1–M2.3, already shipped) continues to work — it processes whatever CAS emails arrive, regardless of how the user got them there. We can begin manual-forward testing on dev today without finalising the discovery.

## Assumptions

- Resend Inbound is available on the existing FolioLens Resend account at no incremental cost for the volumes we expect (a few hundred users × ~1 email/month each). If it isn't, the same pattern works with Postmark, SendGrid Inbound Parse, or Cloudflare Email Routing — only the webhook adapter changes.
- Resend Inbound supports receiving on the existing verified apex domain and sending one `email.received` webhook per inbound message.
- The Vercel-hosted CAS PDF parser at `${APP_BASE_URL}/api/parse-cas-pdf` accepts raw PDF bytes (already true on main).
- We are willing to delete `request-cas` (RTA email is no longer triggered server-side; user requests CAS themselves via the M1 portal flow).
- Apex MX cutover from Cloudflare Email Routing to Resend is acceptable; the Vercel router takes over the four human aliases Cloudflare used to forward.

## Definitions

- **Inbox token** — an 8-character random opaque string per user (e.g. `A8K3Z9P2`). Drawn from a 32-char base32 alphabet that excludes visually ambiguous chars (`I L O 0 1`).
- **Inbound domain** — `foliolens.in` for both dev and prod. Environment is encoded in the local-part.
- **Resend Inbound Router** — Vercel function at `/api/resend-inbound-router`; verifies Resend signatures, forwards human aliases, and dispatches CAS emails to the right Supabase project.
- **Manual forward** — user opens the CAS email from CAMS/KFintech and taps Forward → pastes their `cas-<token>@…` or `cas-dev-<token>@…` address → sends. Works on every mail client without extra setup.
- **Auto-forward filter** — a Gmail / Outlook rule that auto-forwards matching emails to the inbox token address. Subject to client-side verification (see "Auto-forward feasibility discovery" above).

## Scope

- Add `cas_inbox_token` column to `user_profile` with a generation function + trigger + per-row backfill.
- Add Edge Function `cas-webhook-resend` that accepts Resend's inbound payload, decodes the inbox token from the To address, looks up the user, fetches attachment bytes through Resend's Receiving API, and calls `parse-cas-pdf` for each PDF.
- Configure Resend MX records and the Vercel inbound router (manual; documented inline in the PR description).
- Add Step 3 "auto-refresh" card to the M1 wizard (currently a placeholder).
- Add a post-import nudge ("Set this up once and never re-upload") that surfaces on Step 4 (Done) of M1.
- Add Settings → Account → "Auto-refresh inbox" row that shows the user's inbox address, a Copy button, and the last refresh timestamp.
- Delete `request-cas` and `create-inbound-session` Edge Functions and any remaining call sites in app code.
- Deprecate the `CASPARSER_API_KEY` environment variable on Supabase Edge runtime (manual on Supabase Dashboard).
- Theme: every UI surface added by M2 reads from tokens; styles live inside `makeStyles`. No `ClearLensColors` literals.

## Out of Scope

- Verifying that the user actually set up the Gmail filter — out of scope; we just show the address and rely on the user.
- Detecting and de-duplicating reimports of the same PDF — already handled by `import-cas.ts` via per-folio reconciliation.
- Any UI for users to disable / regenerate their inbox token — defer to a later milestone if it becomes a real issue.

## Approach

When a user completes M1, they have a portfolio. On the post-import screen we show a card. Its copy and CTA depend on the M2.0 discovery outcome (auto-forward viable / manual-only / hybrid) — but in every variant the card surfaces the user's forwarding address (`cas-<token>@foliolens.in` on prod or `cas-dev-<token>@foliolens.in` on dev) and a Copy button.

On the backend side, the Vercel router accepts Resend's webhook payload first. For CAS recipients it forwards the unchanged raw body and `svix-*` headers to `cas-webhook-resend` on the dev or prod Supabase project. The Edge Function parses the inbox token from `to`, resolves the user, then runs the same import path that M1's upload uses — namely POSTing the PDF bytes to the existing Vercel parser and handing the result to the shared `import-cas.ts` helper.

We deliberately keep the parsing path unified (one `parse-cas-pdf` Vercel endpoint, one `import-cas.ts` helper) so M1's upload and M2's email-in produce identical outcomes. Tests for the import path don't multiply.

The Vercel router verifies the Resend Svix signature before any side effects. The Supabase Edge Function also verifies the same original signature forwarded by the router, so direct calls to the Edge Function still fail unless they carry a valid Resend signature.

## Alternatives Considered

- **Cloudmailin** (PR #75's approach) — generic email-to-webhook tool. Works, but adds a second email vendor on top of Resend. Rejected.
- **Cloudflare Email Routing** — already used for human aliases, but it owns apex MX and cannot coexist with Resend receiving on the same domain. Replaced with Resend + Vercel router so one provider owns inbound mail.
- **Keep CASParser** — the existing flow already works. Rejected because the user explicitly wants to drop CASParser and consolidate on `foliolens.in`.

## Milestones

### M2.0 — Auto-forward feasibility discovery (precedes UI work)

- Document each major mail client's auto-forward verification flow (Gmail consumer, Gmail Workspace, Outlook.com, Microsoft 365, iCloud, Yahoo Mail).
- Decide between auto-forward, manual-forward-only, or hybrid (see "Auto-forward feasibility discovery" above).
- Update copy in `00-onboarding-redesign.md` to match the chosen path. Update M2.4's UX accordingly.
- **Acceptance**: a written discovery note in this plan + an explicit decision recorded in the Decision Log section.

### M2.1 — Schema + token generation [shipped on `feat/cas-resend-inbound-m2`]

- Migration `20260504020000_user_profile_cas_inbox_token.sql`:
  - Adds `cas_inbox_token text unique` to `user_profile`.
  - Adds a function `gen_cas_inbox_token()` returning a random 8-char base32 string from alphabet `[A-HJKMNP-Z2-9]` (excludes `I L O 0 1`). 32⁸ ≈ 10¹² unique tokens.
  - Adds a `BEFORE INSERT` trigger that fills the column when null on row insert.
  - Backfills existing rows: `update user_profile set cas_inbox_token = gen_cas_inbox_token() where cas_inbox_token is null`.
  - Locks down the function: `revoke ... from public, anon, authenticated` then `grant execute ... to supabase_auth_admin` only.
- `database.types.ts` updated.
- **Acceptance**: every existing and new user has a unique 8-char `cas_inbox_token`; `select count(distinct cas_inbox_token) = count(*) from user_profile` is true.

### M2.2 — Resend Inbound Router + DNS (manual, single endpoint)

- Merge and production-release the Vercel router endpoint `https://app.foliolens.in/api/resend-inbound-router`.
- Enable Resend receiving on the existing `foliolens.in` domain.
- Create one Resend `email.received` webhook pointing at the router endpoint.
- Replace Cloudflare Email Routing apex MX records with Resend's apex MX records. Keep outbound TXT/DKIM/SPF intact.
- Set Vercel production env vars: `RESEND_API_KEY`, `RESEND_INBOUND_ROUTER_SECRET`, `MAIL_FORWARD_TO`, `MAIL_FORWARD_FROM`, `SUPABASE_DEV_FUNCTION_URL`, `SUPABASE_PROD_FUNCTION_URL`.
- Set the same Resend Svix secret on both Supabase projects as `RESEND_INBOUND_SECRET`, and set `INBOUND_DOMAIN=foliolens.in`.
- Smoke test human forwarding: send to `hello@foliolens.in`; expect a forwarded email in owner Gmail.
- Smoke test CAS dispatch after PR #93 deploys: send to `cas-dev-TESTTOKEN@foliolens.in`; Resend calls Vercel router, router calls dev Supabase, function returns unknown token.
- **Acceptance**: one Resend webhook endpoint handles human aliases, dev CAS, and prod CAS without extra Resend domains or subdomains.

### M2.3 — Edge Function `cas-webhook-resend` [shipped on `feat/cas-resend-inbound-m2`]

- `supabase/functions/cas-webhook-resend/index.ts`:
  - Reads `INBOUND_DOMAIN=foliolens.in` from `Deno.env` and parses `cas-dev-<token>` / `cas-<token>` local-parts.
  - Verifies the original Svix signature using `RESEND_INBOUND_SECRET` (timing-safe HMAC).
  - Looks up `user_profile` by `cas_inbox_token`; rejects 404 if no match.
  - For each PDF attachment, fetches bytes from Resend's Receiving API → POSTs to `${APP_BASE_URL}/api/parse-cas-pdf` with the user's PAN as password (and `cdsl_password` for CDSL/NSDL fallback).
  - Runs `importCASData` from `_shared/import-cas.ts`.
  - Inserts a `cas_import` row with `import_source = 'email'`.
  - Returns 200 on either success or expected user errors so Resend doesn't retry.
- Deployed with `--no-verify-jwt` (Resend cannot send a Supabase JWT).
- Structured `[cas-webhook-resend]` logs at invocation, signature OK, user resolution, per-attachment, completion.
- **Acceptance**: dev test email with a real CAS PDF imports successfully; `cas_import` table reflects the run; tampered signature rejects with 401; the function works against both dev and prod with no code change (only `INBOUND_DOMAIN` differs).

### M2.4 — Wizard Step 3 forwarding card + post-import nudge

- Stack on top of M1; replace the placeholder card slot on Step 3 with the chosen flow (per M2.0 discovery).
- The card shows the user's address built from `EXPO_PUBLIC_INBOUND_DOMAIN`, a Copy button, and step-by-step instructions:
  - **Manual-forward path (default if M2.0 lands on that)**: "Each time CAMS / KFintech emails you a CAS, tap Forward and paste this address. Your portfolio updates automatically."
  - **Auto-forward path (if M2.0 confirms it works on a given client)**: explainer + a CTA that opens the client's filter UI in a new tab / in-app browser. The Edge Function surfaces the verification email's confirmation link to the user via the Settings row.
- After M1.5's Done step, show a single-card nudge with the same sheet.
- All colors via tokens; styles via `makeStyles(tokens)`. Verify in light + dark + system, on mobile + desktop.
- **Acceptance**: a user can copy the address, forward a CAS email (or set up the filter), and receive the import. Webhook fires; `cas_import` row appears with `import_source = 'email'`.

### M2.5 — Settings hook + last-refresh

- Add a Settings → Account → "Auto-refresh inbox" row that shows the address + Copy button.
- Surface the last `cas_import` row's status and timestamp on the same row ("Last refresh: 2 hours ago"). If `import_source = 'email'`, show "via auto-refresh"; otherwise "via upload".
- **Acceptance**: refreshing the row after sending a test email updates the timestamp.

### M2.6 — Retire CASParser

- Delete `supabase/functions/request-cas/`.
- Delete `supabase/functions/create-inbound-session/`.
- Remove all `supabase.functions.invoke('request-cas', ...)` and `supabase.functions.invoke('create-inbound-session', ...)` call sites — replace with a router push to the M1 import wizard. After M1 lands, these call sites already disappear from `app/onboarding/index.tsx`; M2 confirms there are no stragglers.
- Remove `CASPARSER_API_KEY` from `.env.example`; request that the user removes it from Supabase secrets manually.
- **Acceptance**: `grep -r "casparser\|request-cas\|create-inbound-session" src/ app/ supabase/` returns nothing in code (docs may still mention historical context).

### M2.7 — Tests + manual validation

- Unit tests for the inbox-token generator (uniqueness, character set).
- Unit tests for the To-header parser (handles `<cas-dev-ABC23456@foliolens.in>` and `cas-ABC23456@foliolens.in` and quoted forms).
- Edge function happy-path test using a recorded Resend payload fixture.
- Manual checklist:
  - Send a real CAS PDF email from CAMS to your token address — webhook fires, import succeeds.
  - Tamper with signature → webhook rejects with 401.
  - Token mismatch → webhook returns 404.
  - Settings row shows updated last-refresh timestamp.
  - Sign-out clears local state but token persists in DB.

## Validation

- `npm run typecheck` — zero errors.
- `npm run lint` — zero warnings.
- `npx jest --ci --coverage` — all suites pass; project floor and `src/utils/` thresholds hold.
- Migration applies cleanly to dev and prod via the existing `supabase-deploy-{dev,prod}.yml` workflows.
- One real CAMS email and one real KFintech email each round-trip end-to-end during M2.7 manual validation.

## Risks And Mitigations

- **Risk**: Resend Inbound has a delivery hiccup and emails are silently dropped. **Mitigation**: log every webhook fire to `cas_import` with the raw payload (hash) so we can reconcile against Resend's dashboard.
- **Risk**: User forwards an email that isn't a CAS (random PDF). **Mitigation**: parser already returns "no mutual fund data found" — webhook records this in `cas_import` with a clear error message; user sees it in Settings.
- **Risk**: Spam to the CAS local-parts on `foliolens.in`. **Mitigation**: only attachments with content-type `application/pdf` and size < 10 MB are processed; everything else returns 200 silently.
- **Risk**: User deletes the inbox token by accident (UI bug or manual SQL). **Mitigation**: token is generated by trigger on insert; provide a "Regenerate token" admin path later if this becomes a real issue.
- **Risk**: CASParser-using code paths are missed during M2.6 cleanup. **Mitigation**: the grep step in M2.6's acceptance is the gating check.

## Decision Log

- 2026-05-04 — Chose Resend Inbound over Cloudmailin to consolidate email vendors on the existing `foliolens.in` Resend account.
- 2026-05-04 — Initially chose plus-addressing (`cas+token@foliolens.in`) over wildcard subdomain (`cas-<token>@foliolens.in`) because plus-addressing required no DNS change beyond the one MX record set.
- 2026-05-04 — Decided not to verify Gmail filter completion (no programmatic way to detect it; would over-engineer the milestone).
- 2026-05-05 — Renumbered from Phase 5 to Phase 6 (Phase 5 is now Desktop Web). M2 ships strictly after M1; both must honour PR #95 + #97 design realities.
- 2026-05-06 — Revised inbound architecture after Resend free-plan testing: subdomains count as extra domains, so Resend now owns apex inbound for `foliolens.in`; a PROD Vercel router handles human aliases plus dev/prod CAS dispatch. CAS addresses are `cas-dev-<token>@foliolens.in` for dev and `cas-<token>@foliolens.in` for prod.

## Progress

- [x] M2.1 — Inbox-token schema + generation + backfill (PR #93)
- [x] M2.2 — Resend inbound router + DNS cutover — router PR, see SETUP.md
- [x] M2.3 — `cas-webhook-resend` Edge Function (PR #93)
- [ ] M2.4 — Auto-refresh card + post-import nudge (post-M1; theming + desktop pass)
- [ ] M2.5 — Settings row + last-refresh display
- [ ] M2.6 — Retire CASParser code paths
- [ ] M2.7 — Tests + real-email validation
