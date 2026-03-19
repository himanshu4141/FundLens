# ExecPlan — Milestone 8: UX Polish & Brand

## Goal

Transform FundLens from a working MVP into a polished, professional product. The
login experience especially felt like a hobby project. This milestone establishes a
consistent visual language, introduces the FundLens brand mark, and upgrades every
screen's design quality — without changing any behaviour or data model.

## What changed

### New files

| File | Purpose |
|------|---------|
| `src/constants/theme.ts` | Design tokens — colours, spacing, radii, typography |
| `src/components/Logo.tsx` | FundLens SVG logo mark + optional wordmark |

### Updated files

| File | Changes |
|------|---------|
| `app/auth/index.tsx` | Full redesign: gradient hero panel, logo, value props, magic-link explainer |
| `app/auth/confirm.tsx` | New illustration, tip cards, professional copy, resend flow |
| `app/(tabs)/_layout.tsx` | Cleaner tab bar; better icons; flat border |
| `app/(tabs)/index.tsx` | Logo in header; gradient portfolio header; category-coloured fund cards; icon-enriched empty/error states |
| `app/(tabs)/compare.tsx` | Icon-enhanced UI; redesigned modal search bar; better empty state |
| `app/(tabs)/settings.tsx` | Avatar + account badge; icon-labelled rows; "Live" data status indicator |
| `app/fund/[id].tsx` | Pill-style back button; XIRR outperform/underperform chip; richer chart legend |

## Design decisions

### Colour palette
- Primary: `#1a56db` (brand blue) — unchanged from M1–7, now codified as a token.
- Portfolio header: `#1341a8 → #1a56db` linear gradient — adds depth without changing
  the brand colour; avoids clashing with fund-card colours.
- Fund card accent bars: category-matched (large-cap = blue, mid-cap = purple, small-cap
  = red, ELSS = green) — surfaces information without adding new data fields.
- All hard-coded colour strings replaced with `Colors.*` references.

### Logo
- Lens circle with upward sparkline inside — directly encodes the product's purpose
  (clarity + portfolio tracking).
- Built entirely with `react-native-svg` (already in deps, no new package).
- Accepts `size`, `showWordmark`, and `light` (for dark backgrounds) props.
- Two-tone wordmark: "Fund" in neutral weight, "Lens" in bold + primary colour.

### Auth screen redesign
- **Before**: white screen, plain text, single input, "Send magic link" button.
- **After**:
  - Dark gradient hero (`#0f172a → #1e3a5f`) showing the logo + 3 value propositions.
  - Rounded modal sheet lifts from hero (uses `borderTopLeftRadius: 24` + upward shadow).
  - "What is a magic link?" accordion answers the most common new-user question.
  - Security note at the bottom reinforces trust without adding friction.
  - Error state resets on every keystroke (better than sticky red text).
  - `onSubmitEditing` on the email field triggers send (keyboard UX).

### Confirm screen redesign
- **Before**: emoji 📬 + plain text + one link.
- **After**:
  - Purpose-built illustration using View primitives (no image asset dependency).
  - Tip cards: expiry, spam folder, same-device usage — the top 3 magic-link support
    queries answered proactively.
  - `useState` on "Use a different email" for future resend-without-navigation support.

### General patterns
- Ionicons used consistently across all screens (already installed via `@expo/vector-icons`).
- Shadows standardised: `elevation: 2, shadowOpacity: 0.05–0.06` for cards;
  `elevation: 1, shadowOpacity: 0.04` for subtle elements.
- `activeOpacity: 0.75–0.85` on all `TouchableOpacity` to reduce default 20% grey flash.
- Empty states: icon in a coloured circle + title + body + CTA — consistent pattern.

## Out of scope for this milestone

- Animation (Reanimated v3) — deferred to a future polish pass.
- Dark mode — requires theming architecture; out of scope now.
- Haptic feedback — minor; can be added alongside animations.
- Onboarding screens — left as-is; addressed in a future onboarding redesign pass.

## Testing notes

- `tsc --noEmit` passes — all new props typed, no `any` escapes.
- `eslint .` passes — no new warnings.
- Logo renders correctly in both light and dark (white) variants.
- Auth screen tested on web (redirect URL logic unchanged).
- No behaviour changes — all hooks, queries, and Supabase calls are identical.
