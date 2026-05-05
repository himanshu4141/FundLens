# Phase 6 — CAS Onboarding Redesign (Overview)

> Shared reference for **M1** (`M1-friendly-upload-onboarding.md`) and **M2** (`M2-resend-inbound-auto-refresh.md`). Read this first; each milestone plan only describes the implementation slice it owns.

## Why This Phase

The CAS onboarding shipped with Phase 1 was a single linear page with three numbered steps (PAN → inbound address → request CAS). It worked but it threw three decisions at the user before the portfolio appeared, hid the simplest path (PDF upload) under "alternative", and never explained what a CAS is. Phase 6 replaces it with a friendly four-step wizard that leads with the fastest option (upload), explains the jargon in plain language, and treats the email-forwarding inbox as an optional advanced setup rather than the default route.

## Phase Numbering Note

Phase 5 is now **Desktop Web** (shipped via PR #95). The CAS onboarding redesign — originally drafted as Phase 5 in earlier branches — has been renumbered to **Phase 6** to reflect the actual repo state. Plans live under `docs/plans/phase-6-cas-onboarding/`.

## What "CAS" Means In Plain Language

CAS stands for Consolidated Account Statement. India has two registrar-and-transfer agents (RTAs): CAMS and KFintech. Between them they run accounting for ~95% of mutual fund AMCs. A CAS is a free PDF a user can request from either RTA (or from MFCentral / CDSL / NSDL) that lists every mutual fund holding the user owns across every AMC, plus every transaction.

The PDF is password-protected. CAMS/KFintech use the user's PAN as the password. CDSL/NSDL use PAN + DDMMYYYY of birth.

There is no API for CAS. The user must request it through one of the portals and it lands in their email a minute or two later.

## The User Journey (target end state)

1. New user opens FolioLens, signs in.
2. Sees a 4-step onboarding wizard.
3. **Step 1 — Welcome**: tells them what a CAS is, why we need it, what stays private.
4. **Step 2 — Identity**: PAN (required), DOB (optional, with hint about CDSL/NSDL), email (pre-filled from auth).
5. **Step 3 — Import**: two cards in priority order.
   - **Upload a CAS PDF** (recommended, fastest)
   - **Get a fresh CAS** (guides to CAMS / KFintech / MFCentral via in-app browser)
6. **Step 4 — Done**: portfolio loaded; nudges to set up auto-refresh.

A third "Set up auto-refresh" card on Step 3 lands in **M2** alongside the Resend Inbound backend.

No WebView wrapping a third-party portal at any point. The Phase 4 attempt at that (PR #75) was closed. We use `expo-web-browser` (SFSafariViewController on iOS, Chrome Custom Tab on Android) for portals on native, and `Linking.openURL` for web — both return the user to FolioLens cleanly.

## Visual Hierarchy

- Each onboarding step is a full-bleed `ClearLensScreen`.
- Top: progress indicator — 4 pills, the current one filled emerald.
- Body: one focused decision per screen (no walls of text).
- Bottom: primary CTA (filled emerald), secondary CTA when applicable (outlined).

## Theme & Layout Reality (post-PR #95 + #97)

The wizard ships into a codebase that now has **dark mode** and a **desktop shell**. Both M1 and M2 must honour:

### Theming (PR #97 — dark mode, classic theme retired)

- The token source of truth is `src/constants/clearLensTheme.ts`. It exports `ClearLensLightTokens`, `ClearLensDarkTokens`, and a `getClearLensTokens(scheme)` factory.
- Components consume tokens via `useClearLensTokens()` (or `useTheme()` for the full context) from `src/context/ThemeContext`.
- **No hardcoded color literals.** Reaching for `ClearLensColors.X` (the legacy light-only constant) breaks dark mode silently — the import still resolves but the value is fixed to the light scheme. Use `tokens.colors.X` instead.
- Module-level `StyleSheet.create({...})` captures tokens once and cannot react to a scheme flip. Wrap styles in `function makeStyles(tokens)` and call via `useMemo(() => makeStyles(tokens), [tokens])`. The route stack already remounts on toggle via `key={resolvedScheme}`, so any module-scope styles still in flight will reset cleanly — but the wizard should not rely on that.
- Test every screen in light, dark, and system mode before raising the PR. Watch for: progress pills (active vs idle), portal cards on the dark scheme (`heroSurface` instead of `navy`), hero badge backgrounds, error banners, success banners, the green CTA.

### Desktop layout (PR #95 — desktop shell)

- At ≥1024 px the app renders a Clear Lens sidebar instead of bottom tabs. New responsive primitives live in `src/components/responsive/`.
- The wizard wraps in `<DesktopFormFrame>`. On desktop this centers the wizard in a 720 px column inside the sidebar shell; on mobile it renders the children unchanged.
- `app/onboarding/_layout.tsx` already suppresses the Stack header on desktop (the wizard provides its own hero). No change needed there.
- The wizard's `KeyboardAvoidingView` is a no-op above 1024 px. Confirm no layout regression at the breakpoint crossing.

## Copy Catalog (canonical)

- Welcome title: "Let's pull in your portfolio"
- Welcome body: "We need your Consolidated Account Statement (CAS) — a free statement from CAMS or KFintech that lists every mutual fund you own. We'll calculate your real return, sector exposure, and a money trail across all your investments."
- Privacy line: "Read-only. Stored encrypted. Never shared."
- Identity title: "Tell us who you are"
- Identity body: "Your PAN unlocks the CAS PDF. Date of birth is only needed if you import a CDSL or NSDL statement."
- Import title: "How would you like to start?"
- Upload card title: "Upload a CAS PDF"
- Upload card body: "Got one already? Upload it now and we'll do the rest."
- Request card title: "Get a fresh CAS"
- Request card body: "We'll show you exactly what to do. Takes about 2 minutes."
- Auto-refresh card title: "Set up auto-refresh (advanced)"
- Auto-refresh card body: "Forward CAS emails to your private FolioLens address and never re-upload."
- Done title: "Your portfolio is ready"

## Out of Scope

- Native push notifications when a CAS arrives in the inbound webhook (post-Phase 6 nice-to-have).
- Tax-statement parsing or capital-gains reporting.
- Broker / demat integration.
- Re-introducing a WebView around any portal.
- Onboarding-only A/B testing — the wizard ships as the only path.

## Cross-References

- **M1** implements Steps 1–4 minus auto-refresh (Upload + Request paths only).
- **M2** implements the auto-refresh card on Step 3, the post-import nudge, the per-user inbox token, and the Resend Inbound webhook.
