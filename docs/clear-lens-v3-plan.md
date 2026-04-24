# Clear Lens (V3) — Full UX Refresh Plan

## Brand Guide Analysis

### Colour Palette (from zoomed swatch image)

| # | Hex | Role |
|---|-----|------|
| 1 | `#0B132B` | Near-black navy — header gradient start, darkest text |
| 2 | `#1E293B` | Dark slate — gradient end, secondary text |
| 3 | `#12B886` | Vivid emerald — **primary brand colour**, all positive values |
| 4 | `#A7F3D0` | Pale mint — primaryLight, banners, card footer tint |
| 5 | `#E5E7EB` | Cool light grey — borders, surfaceAlt |
| 6 | `#F8FAFC` | Cool off-white — page canvas (NOT warm, NOT teal) |

### Logo Mark (from brand guide detail)
- **Broken arc** (partial circle open at bottom-left): stroke, does not fully close
- **Trend sparkline** polyline inside the arc: vivid emerald `#12B886`, 3-point up-right zigzag
- **Small filled dot** at the top-right tip of the arc, also emerald
- **App icon**: dark navy (`#0B132B`) rounded-square background, white arc, emerald sparkline + dot
- **Wordmark**: dark navy arc, emerald sparkline + dot, "FundLens" in dark navy

### Typography
- **Font family: Inter** — Light, Regular, Medium, Semibold, Bold
- Currently the app uses system fonts (SF Pro / Roboto). V3 needs Inter loaded explicitly.

### UI Style Language (from style snippets image)

**Card layout — NOT a gradient hero:**
- Clean white rounded cards on cool off-white canvas
- No full-bleed gradient hero for content — gradient only in the `PrimaryShellHeader` bar

**Information disclosure with ℹ️ icon:**
- The "Return (SIP-aware) ℹ️" card shows primary metric prominently (`18.7% p.a.`) with a "Good" badge
- Secondary details (methodology, benchmark breakdown) hidden by default, revealed on tapping ℹ️
- This pattern applies to XIRR and other metric cards

**Area chart (Portfolio Overview card):**
- Embedded area chart in the card bottom half — emerald line + pale mint gradient fill below
- No visible axes — chart fills the card width, cropped to the card

**Line chart (Fund vs Benchmark):**
- Two lines only — NO area fill, NO visible axes or grid
- Fund line: thick solid emerald `#12B886`
- Benchmark line: thin, grey/lighter colour
- Time selector at the **bottom** of the chart: `1M  6M  1Y  3Y  ALL` pills
- Active pill: dark navy `#0B132B` filled rounded rectangle, white text
- Inactive pills: plain text, `textTertiary`

**Verdict / badge system:**
- `+3.2%` in emerald with "Outperformed" label — no background, just colour + label
- "Good" badge on XIRR: small mint-tinted pill (`primaryLight` background, `primary` text)
- "You're ahead of your benchmark" — mint-tinted footer strip on portfolio card with medal icon

**Collapsible cards:**
- "vs Benchmark" card has a collapse/expand chevron — sections can be toggled

---

## Branch

New branch off **`origin/main`** — clean slate, all V3 code is net-new.

---

## Files To Create / Modify

### CREATE: `src/constants/theme_v3.ts`

```typescript
export const ColorsV3 = {
  primary: '#12B886',
  primaryDark: '#0E9970',
  primaryLight: '#A7F3D0',

  positive: '#12B886',
  negative: '#EF4444',
  warning: '#F59E0B',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#E5E7EB',

  border: '#E5E7EB',
  borderLight: '#F1F5F9',

  textPrimary: '#0B132B',
  textSecondary: '#1E293B',
  textTertiary: '#64748B',
  textOnDark: '#FFFFFF',

  gradientHero: ['#0B132B', '#1E293B'] as [string, string],
  gradientHeader: ['#0B132B', '#1E293B'] as [string, string],
};
```

### MODIFY: `src/store/appStore.ts`
Add `'v3'` to `DesignVariant` union type.

### MODIFY: `src/context/ThemeContext.tsx`
Import `ColorsV3`; map `variant === 'v3'` → `ColorsV3`.

### MODIFY: `app/(tabs)/settings.tsx`
Add **Clear Lens** radio with tagline "Clarity. Comparison. Confidence."

---

### REWRITE: `src/components/Logo.tsx`

Replace existing SVG with the brand guide mark using `react-native-svg`:

- `Path` — broken circle arc, stroke only, does not close at bottom-left gap
- `Polyline` — 3-point up-right sparkline inside the arc
- `Circle` — small filled dot at top-right arc tip

**Colour modes:**
- Default (on light background): arc + dot → `colors.textPrimary`; sparkline → `colors.primary`
- `light=true` (on dark header gradient): arc + dot → white; sparkline → `#12B886` (stays vivid)

**Wordmark:** "FundLens" text next to mark.

---

### INSTALL: Inter font

```bash
npx expo install @expo-google-fonts/inter expo-font
```

In `app/_layout.tsx` root layout: load `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` via `useFonts`. Block splash screen until loaded.

Add font family constants to `src/constants/theme.ts`:
```typescript
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
```
Apply Inter globally via a root-level Text default style.

---

### REDESIGN: Portfolio Home — `app/(tabs)/index.tsx`

**V3 renders a completely different hero layout** (single `designVariant === 'v3'` branch at the top of
the screen component). V1/V2 gradient hero is untouched.

**V3 layout:**

```
[ #F8FAFC screen background ]
[ PrimaryShellHeader — dark navy gradient, logo + menu ]

Card 1: Portfolio Overview (#FFFFFF, rounded, shadow)
┌─────────────────────────────────────────────┐
│ [●logo] Portfolio Overview         [⋯ menu] │
│                                             │
│ Current Value                               │
│ ₹8,24,560                                  │  ← textPrimary 32px bold Inter
│                                             │
│ Invested (SIP)      SIP-aware Return (XIRR) │
│ ₹6,18,000           ▲ 18.7% p.a.          │  ← XIRR in emerald
│                                             │
│ [==area chart, emerald line+mint fill===]   │  ← gifted-charts areaChart
│                                             │
│ [🏅 You're ahead of your benchmark]         │  ← primaryLight tinted footer strip
└─────────────────────────────────────────────┘

Card 2: vs Benchmark (collapsible with ∨ chevron)
┌─────────────────────────────────────────────┐
│ vs Benchmark  Nifty Midcap 150 ∨       [∨] │  ← benchmark selector inline
│ +3.2%                        [sparkline]    │  ← emerald large number
│ Outperformed                                │
└─────────────────────────────────────────────┘

Card 3: Return (SIP-aware)  [ℹ️ toggles details]
┌─────────────────────────────────────────────┐
│ Return (SIP-aware)  ℹ️                      │
│ 18.7% p.a.          [Good]                 │  ← Good badge: primaryLight bg
│ XIRR                                        │
│ Benchmark  15.5% p.a. ∨                    │  ← only shown when ℹ️ expanded
└─────────────────────────────────────────────┘

Card 4: Fund vs Benchmark (line chart)
┌─────────────────────────────────────────────┐
│ Fund vs Benchmark                           │
│ — Your Fund  18.7%   — Nifty Midcap 150  15.5% │
│                                             │
│  [clean two-line chart, no axes]            │  ← gifted-charts LineChart
│                                             │
│        1M  6M  [1Y]  3Y  ALL               │  ← time selector at bottom
└─────────────────────────────────────────────┘
```

**Area chart props** (Portfolio Overview card):
```typescript
<LineChart
  areaChart
  data={navData}
  color="#12B886"
  startFillColor="#A7F3D0"
  endFillColor="#F8FAFC"
  startOpacity={0.4}
  endOpacity={0.0}
  hideAxesAndRules
  hideDataPoints
  curved
/>
```

**Line chart props** (Fund vs Benchmark card):
```typescript
<LineChart
  data={fundData}
  data2={benchmarkData}
  color="#12B886"    // fund — emerald
  color2="#94A3B8"   // benchmark — muted slate
  thickness={3}
  thickness2={2}
  hideAxesAndRules   // no grid lines, no axis labels
  hideDataPoints
  curved
/>
// Time selector BELOW the chart — dark navy active pill
```

**ℹ️ info disclosure:**
- `const [showReturnDetail, setShowReturnDetail] = useState(false)`
- Tapping ℹ️ icon toggles `showReturnDetail`
- When hidden: shows only "18.7% p.a." + "Good" badge
- When shown: reveals XIRR label + Benchmark comparison row

**"Good" badge logic:**
```typescript
const returnGrade = (xirr: number) =>
  xirr >= 15 ? 'Good' : xirr >= 10 ? 'Average' : 'Below Average';
```

---

### UPDATE: `src/components/FundCard.tsx`

Remove variant param from `makeStyles`. Token-driven only:
- Stats footer bg → `colors.surfaceAlt`
- Daily change pill bg → `colors.surfaceAlt`
- Border → `colors.border`

Category accent colours remain unchanged (semantic data colours).

---

### UPDATE: `app/funds.tsx`

Remove `isClearLens` checks. Token-driven:
- `AllocationSummaryCard` → `colors.surface`
- `CompactFundRow` expanded panel → `colors.surfaceAlt`
- Category track → `colors.background`

---

### UPDATE: Chart colours — `app/fund/[id].tsx`

- Fund NAV line → `colors.primary` (already token-driven)
- Benchmark line → `#94A3B8` (muted slate — matches V3 style snippets)
- Positive bars → `colors.positive` (already token-driven)
- Negative bars → `colors.negative` (already token-driven)

---

## Implementation Order

0. Copy this plan file into the repo as `docs/clear-lens-v3-plan.md` ✓
1. Install Inter font
2. `src/constants/theme_v3.ts` — create
3. `src/store/appStore.ts` — add `'v3'`
4. `src/context/ThemeContext.tsx` — wire ColorsV3
5. `app/(tabs)/settings.tsx` — add Clear Lens option
6. `app/_layout.tsx` — load Inter fonts
7. `src/components/Logo.tsx` — rewrite SVG to brand guide mark
8. `app/(tabs)/index.tsx` — V3 hero layout with area chart + info cards + ℹ️ pattern
9. `src/components/FundCard.tsx` — remove variant conditionals
10. `app/funds.tsx` — remove isClearLens conditionals
11. `app/fund/[id].tsx` — benchmark line colour + chart style

---

## Verification

1. `npx expo start` → Settings → Clear Lens
2. Portfolio tab: cool off-white canvas, white cards, dark navy header gradient
3. Portfolio Overview card: area chart with mint gradient fill, emerald XIRR, mint footer strip
4. Tap ℹ️ on Return card: detail rows appear/disappear
5. Fund vs Benchmark card: clean two-line chart, time selector at bottom, dark navy active pill
6. Funds tab: white CompactFundRow cards on off-white, mint expanded panels
7. Fund detail: emerald NAV line, muted grey benchmark line, emerald positive bars
8. Switch back to V1/V2 → unaffected
