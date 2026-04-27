# M8 — Google Login & Account Linking


## Goal


Let users sign in with their Google account as an alternative to magic-link email, allow existing magic-link users to connect their Google account from Settings, and handle the case where a Google sign-in email matches an existing magic-link account.


## User Value


Magic-link sign-in requires leaving the app, opening an email client, and tapping a link that expires in 10 minutes. With Google login, returning users can authenticate in two taps without switching apps. Users who already have an account can connect Google once and use either method interchangeably forever after.


## Context


FundLens uses Supabase Auth exclusively. Prior to this milestone, the only sign-in method is a magic link (OTP email). The app runs on three platforms — iOS, Android, and Web — and the auth flow differs meaningfully between them:

- **Web**: The browser can follow a redirect chain directly. Supabase handles the callback automatically when `detectSessionInUrl: true` is set in the client config.
- **Native (iOS/Android)**: The app cannot follow redirect chains through the system browser without losing the process. Instead, `expo-web-browser` opens a secure in-app browser session (`openAuthSessionAsync`) that monitors for a specific URL scheme and returns the callback URL to the calling code.

The existing magic-link flow uses the **implicit** OAuth flow (tokens in the URL hash fragment). Google OAuth in Supabase uses **PKCE** (Proof Key for Code Exchange), which returns a short-lived `code` in the query string instead of tokens. The app must exchange this code for a session using `supabase.auth.exchangeCodeForSession`. These two flows must coexist without interfering.

All packages needed (`expo-web-browser`, `expo-linking`) were already in the project before this milestone.


## Assumptions


1. The Supabase project exists and is accessible.
2. A Google Cloud Console project with OAuth 2.0 credentials has been created (or will be created as part of setup).
3. The production URL is `https://fund-lens.vercel.app`.
4. The `fundlens://` deep-link scheme is already registered in `app.json` (it is, under `expo.scheme`).
5. Vercel preview deployments use subdomains of `*.vercel.app`.


## Definitions


**Magic link** — A one-time, expiring URL emailed to the user. Clicking it signs them in without a password. Implemented via `supabase.auth.signInWithOtp`.

**PKCE (Proof Key for Code Exchange)** — A security extension to OAuth 2.0. Before the OAuth redirect, the app generates a random secret (the "code verifier") and stores it. After the user authenticates, the provider returns a short-lived `code`. The app exchanges this `code` plus the stored verifier for tokens. This prevents interception attacks because the verifier is never transmitted over the network.

**Code verifier** — The secret generated and stored by the Supabase JS client in AsyncStorage (native) or localStorage (web) at the start of an OAuth flow.

**`openAuthSessionAsync`** — An `expo-web-browser` function that opens a secure in-app browser (iOS: ASWebAuthenticationSession; Android: Chrome Custom Tab) and monitors for a specified URL scheme. When the browser redirects to that scheme, the function closes the browser and returns the redirect URL to the caller.

**Identity** — In Supabase Auth, a user can have multiple "identities" — one per sign-in provider (e.g., `email` for magic link, `google` for Google OAuth). They live on `session.user.identities`.

**Auto-linking** — When Supabase detects that a Google OAuth sign-in email matches an existing magic-link user, it automatically adds the Google identity to that user rather than creating a new account. Whether this happens depends on the Supabase project's "Automatic identity linking" setting.

**OTA update (Over The Air)** — A JavaScript-only app update deployed via `eas update`. No new native binary is built; JS bundles are replaced. OTA updates cannot change native code (like registered URL schemes).


## Scope


1. "Continue with Google" button on the sign-in screen (`app/auth/index.tsx`).
2. OAuth callback page (`app/auth/callback.tsx`) that handles the redirect on all three platforms.
3. "Connected Accounts" section in Settings (`app/(tabs)/settings.tsx`) showing linked providers and a "Connect" button for Google.
4. Existing-account detection: if Supabase auto-links an existing magic-link account to the Google identity, show a confirmation message on the callback screen.
5. Error state when the email already exists and cannot be auto-linked: clear guidance to sign in with email first, then connect Google from Settings.
6. Shared `parseOAuthCode` utility (`src/utils/authUtils.ts`) with 100% test coverage.


## Out of Scope


- Other OAuth providers (GitHub, Apple, etc.).
- Email/password authentication.
- Merging two separate Supabase user accounts (requires a backend Edge Function; instead, auto-linking handles this at the Supabase level when configured).
- Testing Google OAuth in Expo Go (not possible — Expo Go cannot intercept custom URL schemes).


## Approach


### Token flow

```
[auth/index.tsx]
  signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })
    → returns data.url (Google OAuth URL)

[native]
  openAuthSessionAsync(data.url, 'fundlens://')
    → embedded browser opens → user authenticates → Google redirects to
      https://fund-lens.vercel.app/auth/callback?code=...
    → callback page detects mobile UA → window.location.replace('fundlens://auth/callback?code=...')
    → openAuthSessionAsync sees fundlens:// → returns { type: 'success', url: 'fundlens://auth/callback?code=...' }
  parseOAuthCode(result.url) → code
  router.push('/auth/callback?code=...')

[app/auth/callback.tsx — native]
  supabase.auth.exchangeCodeForSession('fundlens://auth/callback?code=...')
    → Supabase retrieves code verifier from AsyncStorage
    → exchanges code for session
  check session.user.identities → detect auto-link
  AuthGate sees new session → routes to /(tabs)

[web]
  signInWithOAuth → window.location.href = data.url → full page redirect
  Google → /auth/callback?code=...
  Supabase detectSessionInUrl: true → auto-exchanges code
  AuthGate → /(tabs)
```

### Files changed

| File | Change |
|---|---|
| `src/components/GoogleIcon.tsx` | New — inline SVG Google "G" mark |
| `src/utils/authUtils.ts` | New — `parseOAuthCode(url)` |
| `src/utils/__tests__/authUtils.test.ts` | New — 9 tests, 100% coverage |
| `app/auth/callback.tsx` | New — OAuth callback handler |
| `app/auth/index.tsx` | Add Google button, `handleGoogleSignIn` |
| `app/(tabs)/settings.tsx` | Add Connected Accounts section, `handleLinkGoogle` |
| `app/_layout.tsx` | Comment clarifying PKCE does not flow through `handleAuthDeepLink` |
| `.env.example` | Document required Supabase redirect URLs |
| `.github/workflows/pr-preview.yml` | Remove Expo Go mention; add Vercel preview note |


## Alternatives Considered


**`expo-auth-session` instead of direct `expo-web-browser`**
`expo-auth-session` is a higher-level wrapper that provides `makeRedirectUri` and handles the browser session. Rejected because `expo-web-browser` is already installed and the lower-level API gives cleaner control over the callback URL. Supabase's own `skipBrowserRedirect` pattern pairs naturally with `openAuthSessionAsync`.

**Native Google Sign-In SDK (`@react-native-google-signin/google-signin`)**
Provides a native Google sign-in sheet on iOS/Android. Rejected because it requires a new native dependency (rebuilding the native binary), whereas the Supabase OAuth flow requires only JS changes and can be deployed via OTA update to any existing build.

**Implicit flow instead of PKCE**
Supabase defaults to PKCE for OAuth providers. Using implicit flow (tokens in hash fragment) would align with the existing magic-link handling but is less secure and deprecated in OAuth 2.1. Kept PKCE as the default.


## Milestones


### Milestone 1 — Core Google sign-in


Add the Google button and callback page. Users can sign in with Google on both web and native.

Files: `src/components/GoogleIcon.tsx`, `app/auth/callback.tsx`, `app/auth/index.tsx`

Acceptance criteria:
- "Continue with Google" button appears below the magic-link button on the sign-in screen.
- Tapping it on web opens Google's sign-in page and redirects back; user ends up in `/(tabs)`.
- On native, an in-app browser opens, authenticates, and closes; user ends up in `/(tabs)`.
- Cancelling the browser returns the user to the sign-in screen with no error.


### Milestone 2 — Account linking in Settings


Add the Connected Accounts section so existing magic-link users can connect Google.

Files: `app/(tabs)/settings.tsx`

Acceptance criteria:
- Settings → Connected Accounts shows "Email (magic link): Connected" always.
- Google shows "Connect" button when not linked; "Connected" + email when linked.
- Tapping "Connect" opens the OAuth flow and, on completion, updates the UI without a manual refresh.


### Milestone 3 — Existing account detection


After Google sign-in, detect whether Supabase auto-linked an existing account.

Files: `app/auth/callback.tsx`

Acceptance criteria:
- When `session.user.identities` contains both `email` and `google`, show "Google account connected to your existing FundLens account" message.
- When email already exists and OAuth fails, show "Account already exists" error with "Sign in with email instead" button.


### Milestone 4 — Tests and infrastructure


Extract shared URL-parsing logic, add tests, fix CI preview comment.

Files: `src/utils/authUtils.ts`, `src/utils/__tests__/authUtils.test.ts`, `.github/workflows/pr-preview.yml`, `.env.example`

Acceptance criteria:
- `npm test -- --coverage` passes with utils folder ≥ 95% line coverage.
- PR preview comment no longer says "Expo Go"; instead directs to the Vercel preview URL for web testing.


## Validation


### End-to-end: web (desktop browser)

1. Run `npm run web` — app opens at `http://localhost:8081`.
2. On the sign-in screen, tap "Continue with Google".
3. Browser navigates to Google. Sign in.
4. Browser returns to `http://localhost:8081/auth/callback`, shows "Completing sign-in…".
5. App redirects to `/(tabs)` (home screen).

Prerequisite: `http://localhost:8081/auth/callback` must be added to Supabase → Auth → URL Configuration → Redirect URLs AND to Google Cloud Console → Authorized Redirect URIs.


### End-to-end: native (dev build or installed app)

1. Install a native build that has `fundlens://` registered (any `eas build` output or the production app).
2. Apply the OTA update via `eas update --branch pr-{N}` or use the QR code from the PR comment.
3. Open the app → sign-in screen → "Continue with Google".
4. In-app browser opens. Sign in with Google.
5. Browser closes automatically. App shows `/(tabs)`.

Note: Expo Go cannot be used because it does not register the `fundlens://` scheme.


### Connect Google from Settings

1. Sign in via magic link.
2. Go to Settings → Connected Accounts.
3. Google row shows "Connect" button.
4. Tap "Connect" → OAuth flow → returns to app.
5. Google row now shows "Connected" and the Google account email.


### Existing account auto-link

1. Create an account via magic link with email `test@example.com`.
2. Sign out.
3. Tap "Continue with Google" with a Google account that uses `test@example.com`.
4. If Supabase auto-linking is enabled: callback screen briefly shows "Google account connected to your existing FundLens account", then `/(tabs)` loads with original data intact.


### Tests

    npm test -- --coverage --ci

Expected: all tests pass, utils folder ≥ 95% lines/statements, 85% branches, 100% functions.


## Risks And Mitigations


| Risk | Mitigation |
|---|---|
| Supabase redirect URL not configured | `.env.example` documents all three required redirect URLs (production, Vercel wildcard, `fundlens://`). The sign-in will fail with a Supabase error if the URL is missing from the allowlist — the error message surfaces in the UI. |
| PKCE verifier lost between `signInWithOAuth` and `exchangeCodeForSession` | `openAuthSessionAsync` keeps the native app alive throughout the OAuth browser session, so the app process is never killed mid-flow. The verifier survives in AsyncStorage. |
| Expo Go used for testing | PR preview comment explicitly warns that Expo Go does not support custom URL schemes and directs testers to use a native build or the Vercel web preview. |
| Vercel preview URL not in Supabase allowlist | `.env.example` documents the `https://*.vercel.app/auth/callback` wildcard entry required for preview deployments. |
| Auto-linking disabled in Supabase | The callback page handles this gracefully: shows "Account already exists" with a "Sign in with email instead" button and guidance to link from Settings. |
| `new URL()` polyfill absent on older React Native | `parseOAuthCode` uses only `String.indexOf`, `String.slice`, `String.split`, and `URLSearchParams` — all available in React Native's JS runtime without polyfills. |


## Decision Log


**2026-04 — Use PKCE, not implicit flow**
Supabase defaults to PKCE for OAuth providers and the Supabase JS v2 client enforces it. Using implicit flow would require downgrading security and going against library defaults. Kept PKCE.

**2026-04 — Bridge page pattern for native (same as existing magic-link)**
The existing magic-link flow uses `https://fund-lens.vercel.app/auth/confirm` as a bridge: the HTTPS page detects a mobile user agent and redirects to `fundlens://`. The same pattern is used for the OAuth callback (`/auth/callback`). This ensures the in-app browser (which only shows HTTPS URLs) can redirect to the native scheme.

**2026-04 — `skipBrowserRedirect: true` on all platforms**
Using `skipBrowserRedirect: true` means Supabase returns the OAuth URL without redirecting, giving the app explicit control. On web, the app then manually does `window.location.href = data.url`. On native, it opens the URL with `openAuthSessionAsync`. This uniform pattern makes the code easier to reason about.

**2026-04 — Extract `parseOAuthCode` to shared utility**
The URL code-extraction logic (`url.split('?')[1]` + `URLSearchParams.get('code')`) appeared in both `auth/index.tsx` and `settings.tsx`. Extracted to `src/utils/authUtils.ts` to eliminate duplication and enable unit testing in the Node Jest environment.

**2026-04 — No new native packages**
`@react-native-google-signin/google-signin` would provide a native sign-in sheet but requires rebuilding the native binary. The Supabase OAuth + `expo-web-browser` approach deploys via OTA update to any existing build. Chosen for faster iteration.


## Progress


- [x] Create `src/components/GoogleIcon.tsx`
- [x] Create `app/auth/callback.tsx`
- [x] Add Google sign-in button to `app/auth/index.tsx`
- [x] Add Connected Accounts section to `app/(tabs)/settings.tsx`
- [x] Add clarifying comment to `app/_layout.tsx`
- [x] Create `src/utils/authUtils.ts` with `parseOAuthCode`
- [x] Create `src/utils/__tests__/authUtils.test.ts` (9 tests, 100% coverage)
- [x] Refactor `auth/index.tsx` and `settings.tsx` to use `parseOAuthCode`
- [x] Update `.env.example` with all required Supabase redirect URLs
- [x] Update `pr-preview.yml` to remove Expo Go mention, add Vercel preview note
- [x] All 277 tests pass with coverage above thresholds
