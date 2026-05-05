# Phase 6 — Manual Setup & Testing Guide

This file is the operator-facing checklist for taking Phase 6 from "PRs landed" to "I can test it on dev preview". It mirrors what the M1 (#92) and M2 (#93) PR descriptions cover but lives in the repo so reviewers don't have to scroll PR threads to find it.

> Two app environments share one Resend account and one verified registered domain (`foliolens.in`). M2 uses **`dev.foliolens.in` for dev/preview** and **`foliolens.in` for prod** so a CAS forwarded by a tester never lands on a prod user. Mind the `dev.` prefix when you copy/paste addresses.

## 1 — Test M1 (the wizard)

No backend setup required. Once CI on PR #92 is green, you can:

### a. Web (Vercel `foliolens-dev`)

- Open the Vercel preview URL from the PR comment (`foliolens-dev-…vercel.app`).
- Sign in. If your `user_profile.pan` is already set, you'll land on the home tabs instead of the wizard. To test the first-run flow, clear it via the dev Supabase SQL editor:

  ```sql
  -- DEV Supabase SQL Editor
  update user_profile
     set pan = null, dob = null, kfintech_email = null
   where user_id = '<your-uuid>';

  delete from cas_import where user_id = '<your-uuid>';
  ```

- Drag the browser between mobile (`<1024 px`) and desktop (`≥1024 px`) widths to verify the layout switches: mobile shows a full-width column, desktop centres the wizard inside the sidebar shell.
- Settings → Preferences → Appearance → toggle Light / Dark / Follow system. Every wizard surface should react without a remount.
- Returning-user flow: after PAN + DOB are saved, sign out and back in (or re-run from Settings → Restart import). The wizard should drop you on Step 3 (Import), skipping Welcome + Identity.
- PAN/DOB immutability: confirm Settings → Account shows PAN as read-only (no Edit button); DOB shows Add only while null; the wizard's Identity step never re-prompts a saved PAN.

### b. Native (EAS `preview-pr` build)

- Install via the link in the PR comment (Expo dashboard → Builds → preview-pr profile → install link / QR).
- Force-quit + reopen at any wizard step → confirm draft persistence.
- Verify the "Get a fresh CAS" cards launch the in-app browser (SFSafariViewController on iOS, Chrome Custom Tab on Android), and the AppState banner appears after dismiss.

## 2 — Test M2 backend (one-time dev setup)

Do these once on dev. Repeat on prod when the beta is ready to ship.

### a. Apply the migration to dev Supabase

- GitHub → Actions → **Supabase Deploy (dev)** → Run workflow → on the M2 branch (or `main` after #93 merges).
- Or locally with the dev project linked: `supabase db push`.
- Verify in dev SQL editor:

  ```sql
  select user_id, cas_inbox_token from user_profile;
  -- every row should show an 8-char token
  ```

### b. Add MX records for `dev.foliolens.in`

- Cloudflare DNS → `foliolens.in` → add Resend's two MX records as a host on `dev` (so the records target `dev.foliolens.in`, not the apex). Resend's onboarding modal gives the exact host / value pair.
- Wait for DNS propagation (`dig MX dev.foliolens.in` should return Resend's MX targets within ~2 minutes).

### c. Configure the dev Resend Inbound Route

- Resend Dashboard → Inbound → **Create route**.
- **Pattern**: `cas+*@dev.foliolens.in`
- **Webhook URL**: `https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/cas-webhook-resend`
- Copy the **signing secret** Resend generates (you'll need it in step d).

### d. Set the secrets on dev Supabase Edge runtime

- Supabase Dashboard → DEV project (`imkgazlrxtlhkfptkzjc`) → Edge Functions → Manage secrets.
- Add **two** secrets:
  - `RESEND_INBOUND_SECRET` = the signing secret from step c.
  - `INBOUND_DOMAIN` = `dev.foliolens.in`.
- Verify locally (optional): `supabase secrets list --project-ref imkgazlrxtlhkfptkzjc`.

### e. Smoke test (function only)

- From your personal email (Gmail / iCloud / whatever you have), send a message **with a real CAS PDF attached** to `cas+ZZZZZZZZ@dev.foliolens.in` (use any 8-char placeholder in the alphabet `[A-HJKMNP-Z2-9]`).
- Watch: Resend Dashboard → Inbound → Logs. Should show 200 within ~5 sec.
- Watch: Supabase Dashboard → DEV → Edge Functions → `cas-webhook-resend` → Logs. Expect `[cas-webhook-resend]` lines: invocation, signature OK, user resolution **failed (404)** because no `cas_inbox_token = ZZZZZZZZ`. That's a successful smoke — the webhook reached the function, signature matched, lookup worked, no row inserted.

### f. End-to-end test (your real token)

- Find your token in dev SQL: `select cas_inbox_token from user_profile where user_id = '<your-uuid>'`.
- Send a real CAS PDF email from CAMS / KFintech (or forward an old one) to `cas+<your-token>@dev.foliolens.in`.
- Watch the same logs as step e — this time user resolution succeeds, parser fires, `import-cas` runs.
- Verify:

  ```sql
  select id, status, import_source, created_at
    from cas_import
   where user_id = '<your-uuid>'
   order by created_at desc
   limit 1;
  -- expect import_source = 'email' and a recent timestamp
  ```

- Open the dev app → Portfolio should reflect the imported funds and transactions.

### g. Negative tests

- **Tampered signature**: replay the same Resend webhook from the dashboard with a corrupted `Svix-Signature` header. Expect a 401 from the Edge Function and no `cas_import` row.
- **Unknown token**: send to `cas+NOTAREAL@dev.foliolens.in` (with a placeholder that's still alphabet-valid). Expect a 404 in the function logs and no row inserted.
- **Non-PDF attachment**: forward a random email with a `.txt` attachment. Expect the Edge Function to log "no PDF attachment" and return 200 silently.

## 3 — Promote to prod

Same five steps as section 2, but for prod:

| Concern | Dev | Prod |
|---|---|---|
| Supabase project ref | `imkgazlrxtlhkfptkzjc` | `ohcaaioabjvzewfysqgh` |
| Inbound subdomain | `dev.foliolens.in` | `foliolens.in` (apex) |
| MX target host | `dev` | `@` |
| Resend route pattern | `cas+*@dev.foliolens.in` | `cas+*@foliolens.in` |
| Webhook URL | `https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/cas-webhook-resend` | `https://ohcaaioabjvzewfysqgh.supabase.co/functions/v1/cas-webhook-resend` |
| Edge runtime secrets | `RESEND_INBOUND_SECRET` (dev value) + `INBOUND_DOMAIN=dev.foliolens.in` | `RESEND_INBOUND_SECRET` (prod value, **separate**) + `INBOUND_DOMAIN=foliolens.in` |
| Migration deploy | `supabase-deploy-dev.yml` | `supabase-deploy-prod.yml` (workflow_dispatch only) |
| App env var | `EXPO_PUBLIC_INBOUND_DOMAIN=dev.foliolens.in` (preview / preview-pr) | `EXPO_PUBLIC_INBOUND_DOMAIN=foliolens.in` (production) |

The two routes are administratively isolated in Resend; a misconfigured dev route can never accidentally swallow prod inbound mail. The signing secrets are independent — a leaked dev secret cannot sign a prod webhook.

## 4 — Quick reference: what runs where

| Layer | Dev | Prod |
|---|---|---|
| Web | `foliolens-dev.vercel.app` | `app.foliolens.in` |
| Native build channel | `foliolens-pr` (per-PR) and `foliolens-main` (main) | `foliolens-production` |
| Supabase project | `imkgazlrxtlhkfptkzjc` | `ohcaaioabjvzewfysqgh` |
| Inbound address (Phase 6 / M2) | `cas+<token>@dev.foliolens.in` | `cas+<token>@foliolens.in` |

If `EXPO_PUBLIC_INBOUND_DOMAIN` is unset on the client, the app falls back to `foliolens.in` so a missing env var keeps prod working. Setting it explicitly to `dev.foliolens.in` for dev / preview is mandatory.

## 5 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Resend logs the webhook but Edge Function never gets called | Missing `--no-verify-jwt` flag at deploy time | Re-deploy via `supabase functions deploy cas-webhook-resend --no-verify-jwt --project-ref <ref>` |
| Function logs show "INBOUND_DOMAIN not set" | Edge runtime secret missing | Add `INBOUND_DOMAIN` in Supabase Dashboard → Edge Functions → Manage secrets |
| App shows the prod address (`foliolens.in`) on dev | `EXPO_PUBLIC_INBOUND_DOMAIN` not set on the EAS / Vercel env | Set it to `dev.foliolens.in` and redeploy / republish |
| Function returns 401 on every request | Signing secret mismatch | Re-copy from Resend Dashboard → Inbound → your route → Reveal secret; update Supabase secret |
| Function returns 404 for a real user | Token typo in the email's To address, or the user's `cas_inbox_token` is null | Check the To header in Resend logs; check the user's profile row |
| `cas_import` row inserted but Portfolio empty | Parser returned 0 funds | Check function logs for the parser's response body; common cause: wrong PAN saved on the profile (immutable, so requires SQL update) |
