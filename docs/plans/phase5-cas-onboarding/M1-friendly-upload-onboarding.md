# M1 — Friendly Upload-First Onboarding


## Goal


Replace today's onboarding with the redesign in `00-onboarding-redesign.md`, optimised for the 80% case where a user uploads a CAS PDF they already have or get one fresh in 2 minutes via an in-app browser. No WebView, no CASParser dependency for this milestone.


## User Value


Beta testers reported uploading a CAS PDF as the most friction-laden step today. They abandon the flow because it isn't obvious what a CAS is, where to get one, or that they have to switch back to the app to upload it. After M1 they should be able to go from "logged in" to "portfolio loaded" in under three minutes without external help.


## Context


- The codebase is a React Native + Expo app using expo-router; entry-points are `app/onboarding/index.tsx` and `app/onboarding/pdf.tsx`
- The local-PDF upload pipeline already exists end-to-end: client picks a file via `expo-document-picker`, sends it to the `parse-cas-pdf` Supabase Edge Function, which calls a Vercel-hosted Python parser, and the function persists results to the `cas_import` table. Do not change this pipeline.
- `expo-web-browser` is already a dependency and is used by the auth flow. We will use it again here to open CAMS/KFintech/MFCentral.
- A previous attempt (PR #75) tried to wrap CAMS Online inside `react-native-webview`. It hung the app on startup. Do not use a WebView for this; use the in-app browser only.
- The `user_profile` table already has `pan` and `dob` columns (latter added by the CDSL/NSDL import PR #84).


## Assumptions


- The Vercel-hosted CAS PDF parser at `${EXPO_PUBLIC_APP_BASE_URL}/api/parse-cas-pdf` works for CAMS, KFintech, and CDSL/NSDL PDFs (this is already true on main).
- Beta users have an Indian PAN and at least one mutual fund holding registered with CAMS or KFintech.
- The user's email account is on a phone they can switch back from (true on iOS and Android — `expo-web-browser` returns to the calling app on dismiss).


## Definitions


- **In-app browser** — a tab presented inside the app via SFSafariViewController (iOS) or Chrome Custom Tab (Android), launched via `WebBrowser.openBrowserAsync(...)`. Distinct from a WebView, which embeds a web page inside a React Native view. The in-app browser preserves the user's existing browser session (cookies, autofill).
- **Portal** — one of CAMS Online (`mycams.camsonline.com`), KFintech (`mfs.kfintech.com`), MFCentral (`mfcentral.com`), CDSL (`cas.cdslindia.com`), NSDL (`nsdlcas.nsdl.com`).


## Scope


- Rewrite `app/onboarding/index.tsx` as a 4-step wizard following `00-onboarding-redesign.md`
- Add a "Get a fresh CAS" sub-screen with portal cards that open the in-app browser
- Polish `app/onboarding/pdf.tsx` to be cohesive with the wizard styling (it's the actual upload step)
- Add an `AppState` listener that detects return-to-foreground after dismissing the in-app browser and shows a "Did you receive your CAS? Upload it now" banner inline
- Do not delete or change any Edge Function in this milestone


## Out of Scope


- Auto-refresh / Resend Inbound / per-user inbox tokens — that is M2
- MFCentral OAuth — separate milestone, partner agreement required
- CASParser code paths in `request-cas` and `create-inbound-session` Edge Functions remain on disk but are not invoked from any onboarding screen after M1. M2 will delete them; M1 leaves them dormant.


## Approach


Build the new onboarding as four screens that share a common wizard shell. The wizard owns navigation, progress, and form state; each step is a stateless component. State is held in a `useReducer` so we can persist drafts to AsyncStorage cheaply and resume mid-onboarding.


For "Get a fresh CAS", the sub-screen is a list of portal cards. Tapping a card calls `WebBrowser.openBrowserAsync`. When the browser closes, we listen for the next `AppState` `active` transition to surface the upload nudge.


The actual upload step reuses the existing `pdf.tsx` flow. We move the file picker into a wizard step and wrap the result page with the wizard's done state.


## Alternatives Considered


- **Embed the portals via WebView** — rejected; PR #75 proved this hangs and CAMS has anti-embedding protection
- **Auto-detect the user's browser-downloaded PDF via a share extension** — would be the lowest friction but requires building an iOS/Android share extension, weeks of native work
- **Drop the wizard and just show one big screen** — too dense for a first-run; users skip to the wrong primary CTA


## Milestones


### M1.1 — Wizard shell


- Create `src/components/onboarding/Wizard.tsx` with progress pills, header, body slot, footer with primary/secondary CTAs
- Create `src/components/onboarding/useWizardState.ts` (reducer) that persists draft to AsyncStorage under key `foliolens-onboarding-draft-v1`
- Replace `app/onboarding/index.tsx`'s default export with a `<Wizard>` containing four placeholder steps
- Acceptance: app starts, signing-in lands on the wizard, can advance/retreat between empty steps, draft survives a force-quit and relaunch


### M1.2 — Step 1 (Welcome) and Step 2 (Identity)


- Welcome step: copy from `00-onboarding-redesign.md`, primary CTA "Get started"
- Identity step: PAN field (auto-uppercase, regex `^[A-Z]{5}[0-9]{4}[A-Z]$`), DOB field (date picker, optional), email field (pre-filled from `supabase.auth.getUser()`, editable)
- On Identity step Continue, `upsert` into `user_profile` table with `{ pan, dob, kfintech_email: email }`. Block advance if PAN invalid.
- Acceptance: end-to-end PAN saves to `user_profile`; refresh confirms persistence; invalid PAN inline-errors; DOB hint visible


### M1.3 — Step 3 (Import — Upload path)


- Three import cards as described in the redesign doc
- "Upload a CAS PDF" card → open `expo-document-picker` with `type: ['application/pdf']`, `multiple: false`
- On file picked: navigate to a sub-step inside the same step that shows file name + "Importing…" spinner
- Call `supabase.functions.invoke('parse-cas-pdf', { body: pdfBytes, headers: { 'x-file-name': name } })` (existing path)
- On success advance to Step 4. On failure show inline error with retry.
- Acceptance: dropping in a known-good CAMS PDF imports the same number of folios as today's `app/onboarding/pdf.tsx` flow. CDSL PDF works because user supplied DOB in step 2.


### M1.4 — Step 3 (Import — Request path)


- "Get a fresh CAS" card opens a sub-screen with three portal options: MFCentral (recommended), CAMS, KFintech
- Each card has: portal logo, one-line description, "Open" button that calls `WebBrowser.openBrowserAsync(portalUrl, { presentationStyle: 'pageSheet' })`
- Below the cards: a stationary instruction block "1) Log in. 2) Find 'Statements' or 'CAS'. 3) Request statement to your registered email. 4) Come back here."
- On `AppState` returning to `active` after a browser session, mount a banner inside the same screen "Got the email? Upload your CAS now" with a CTA that triggers the upload flow from M1.3
- Acceptance: tapping a portal opens the in-app browser; closing the browser surfaces the upload banner; tapping the banner runs the document-picker flow


### M1.5 — Step 4 (Done) and entry-point cleanup


- Done step shows imported fund count, transaction count, "Open portfolio" CTA → `router.replace('/(tabs)')`
- Update entry-point logic so users with `pan` set who reopen the app land on the home screen, not the wizard
- Add a "Restart import" link in Settings → Account for users who want to redo onboarding (small, but unblocks support cases)
- Delete the old single-screen `app/onboarding/index.tsx` content; keep `app/onboarding/pdf.tsx` only as a deprecated direct route (settings → "import another statement" still calls it)
- Acceptance: completed user does not see the wizard on relaunch; "Restart import" reopens the wizard; profile fields persist


### M1.6 — Tests and validation


- Unit tests for `useWizardState` (PAN regex, draft persistence, advance/retreat)
- Snapshot test for each step rendering at empty / partially-filled / valid states
- Integration: existing `parse-cas-pdf` tests stay green
- Manual checklist:
  - PAN validation rejects `ABCDE12345` (length wrong) and accepts `ABCDE1234A`
  - DOB date picker writes ISO string to draft
  - In-app browser opens MFCentral and returns
  - Banner appears after browser dismiss
  - Force-quit + relaunch resumes at the same step
  - Import success page reflects actual fund counts
  - Coverage on `src/utils` stays ≥95% (project floor)


## Validation


- `npm run typecheck` — zero errors
- `npm run lint` — zero warnings
- `npx jest --ci` — all suites pass
- Manual smoke as listed in M1.6
- One real beta tester on Android plus one on iOS upload a real CAS without external help


## Risks And Mitigations


- **Risk**: PAN regex rejects edge cases (e.g., HUF PANs ending with `H` are valid). Mitigation: use `^[A-Z]{5}[0-9]{4}[A-Z]$` which already accepts H/F/C/P/T/B/L/J/G — covers all assessee categories.
- **Risk**: `expo-web-browser` returns the user but they can't tell whether they got the email yet. Mitigation: the banner appears regardless and is dismissible; user can re-trigger via the same import card.
- **Risk**: `expo-document-picker` returns a content:// URI on Android that is not directly readable as bytes. Mitigation: today's `pdf.tsx` already handles this — reuse the same upload helper.
- **Risk**: AsyncStorage draft conflicts with sign-in/sign-out. Mitigation: clear the draft on sign-out and on a successful Done step.


## Decision Log


- 2026-05-04 — Chose 4-step wizard over single-page after PR #75 feedback that long single screens overwhelm new users.
- 2026-05-04 — Chose `expo-web-browser` over `react-native-webview` after PR #75's hang issues.
- 2026-05-04 — Order of import cards is upload-first because beta users with existing CAS PDFs have the lowest friction path.


## Progress


- [ ] M1.1 — Wizard shell + draft persistence
- [ ] M1.2 — Welcome + Identity steps
- [ ] M1.3 — Upload path
- [ ] M1.4 — Request-fresh-CAS path with in-app browser
- [ ] M1.5 — Done step + entry-point routing + Settings re-import link
- [ ] M1.6 — Tests + manual validation + beta tester run-throughs

---

## Amendments

### 2026-05-04 — Pause for desktop shell + dark mode rebase

PR #92 is parked as **draft** until PR #97 (dark mode + classic-theme retirement) merges into `main`. Two pieces of work that landed (or will land) on `main` since this branch was cut materially change the scope of the wizard's UI:

1. **Desktop shell** (already on `main`) — the app now renders a sidebar layout at viewports ≥1024 px instead of bottom tabs, with new responsive primitives in `src/components/responsive/` (`DesktopShell`, `DesktopSidebar`, `DesktopContainer`, `DesktopFormFrame`, `ResponsiveRouteFrame`, `useResponsiveLayout`).
2. **Dark mode + retire classic theme** (PR #97) — single Clear-Lens-only theming with light / dark / system selector. Hardcoded colour literals will stop working once classic theme is deleted; everything must read from the new theme tokens.

#### Post-#97 redesign checklist for the wizard rebase

Before un-drafting #92:

- **Theming.** Replace every literal colour reference in the wizard (`#…`, `ClearLensColors.*` if those are renamed/removed) with the new theme accessor (`useTheme()` / new tokens). Verify the wizard renders correctly in light, dark, and system mode. Pay special attention to: progress pills (active vs idle), portal cards, the green CTA, error banners, KAV background.
- **Desktop layout.** At ≥1024 px the wizard currently scrolls a phone-sized column inside the sidebar shell. Wrap each step's body in `DesktopFormFrame` (or whichever centred-form primitive ships with #97) so the wizard sits in a 480–560 px column with breathing room. Welcome + Done steps may benefit from a hero/illustration on the left at desktop widths — decide during rebase.
- **Sidebar coexistence.** Onboarding must hide the desktop sidebar (no nav while the user is signing up). Confirm the `(tabs)` group / route guard pattern from the desktop shell merge already does this; if not, add an explicit suppress in `app/onboarding/_layout.tsx`.
- **Portal cards on desktop.** The "Open KFinTech / CAMS" cards open `expo-web-browser` on native. On web desktop this should open in a new tab via `Linking.openURL` (or the equivalent that the desktop shell adopted) and the AppState return-to-foreground banner becomes a no-op — replace with a "Done? Click to refresh" affordance.
- **KeyboardAvoidingView.** With desktop shell, KAV is a no-op above 1024 px. Confirm no layout regressions at the breakpoint crossing.
- **Coverage.** Coverage commit for `casPdfUpload` + `onboardingDraft` storage helpers landed 2026-05-04 (`f4a5454`). Re-run after rebase — new theme tokens may pull other files into coverage.

#### Out-of-scope for this milestone

- Redesigning the four-step shape itself. The reducer + step model is solid; the rebase is purely a presentation-layer pass.
- Dark-mode tuning of the standalone `app/onboarding/pdf.tsx` re-import screen — covered under M1.5 routing work, but treat as a follow-up if PR #97's review surfaces theme work elsewhere.
