# FolioLens Design System

## Direction and Feel

**Product:** Personal mutual fund tracker for novice Indian investors.
**User:** Someone checking their SIP portfolio on a Tuesday morning — not a professional investor.
**Core question they're asking:** "Am I doing well?" — not "what's my portfolio value?"

**Feel:** Patient, trustworthy, growth-oriented. Not "app-y". Not a fintech template.
Dense enough to be informative, calm enough to not feel like a trading terminal.

**Principle:** Signal before number. The answer to the user's question comes first,
then the supporting data. Jargon is replaced at the label level, not just in help text.

---

## Color Tokens

```ts
// src/constants/theme.ts

primary: '#0f6b57'      // Deep forest teal — growth, patience, long-term investing
primaryDark: '#0a4a3c'  // Darker teal — pressed states, gradient start
primaryLight: '#edfaf6' // Very light tint — banners, selected states

positive: '#16a34a'     // Lime green — gains, outperformance (distinct from brand teal)
negative: '#dc2626'     // Red — losses, underperformance
warning:  '#d97706'     // Amber — caution

background: '#f8fafc'   // Off-white page bg (Tailwind slate-50)
surface:    '#ffffff'   // Card / panel bg
border:     '#e2e8f0'   // Standard separation
borderLight:'#f1f5f9'   // Subtle internal dividers

textPrimary:   '#0f172a'  // Headings, hero values
textSecondary: '#475569'  // Body, descriptions
textTertiary:  '#94a3b8'  // Labels, meta, placeholders

gradientHero:   ['#0f172a', '#1e3a5f']  // Auth hero (dark navy)
gradientHeader: ['#0a2e25', '#0f6b57']  // Portfolio header (dark forest → teal)
```

**Why teal, not blue:** `#1a56db` (the original) is Tailwind Blue 600 — every SaaS dashboard
uses it. Deep forest teal encodes growth and patience without fighting the semantic green
(`#16a34a`) used for positive returns. The two greens are visually distinct: teal is dark and
saturated, positive green is lighter and more vibrant.

---

## Depth Strategy: Borders Only

Fund cards and content surfaces use **borders, not shadows**.

```ts
// Cards
borderWidth: 1,
borderColor: Colors.border,  // '#e2e8f0'
// No: shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation
```

Internal dividers within cards use the lighter border:
```ts
borderTopWidth: 1,
borderTopColor: Colors.borderLight,  // '#f1f5f9'
```

**Why:** Borders feel precise and technical — appropriate for a finance tool.
Shadows were mixed with borders (inconsistent depth), which this resolves.
Exception: the gradient portfolio header uses color contrast, not borders, for depth.

---

## Spacing Scale

```ts
xs:  4
sm:  8
md:  16
lg:  24
xl:  32
xxl: 48
```

---

## Border Radius Scale

```ts
sm:   8    // Inputs, buttons, small pills
md:  12    // Cards, modals
lg:  16    // Large cards (no longer used for portfolio header — it's full-bleed now)
xl:  24
full: 9999 // Pills
```

---

## Typography

System fonts. Four text hierarchy levels:

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Hero value | 32px | 800 | letterSpacing: -1 — portfolio total |
| Verdict | 20px | 700 | letterSpacing: -0.3 — "Beating the market" |
| H2 | 22px | 700 | Screen titles |
| H3 | 18px | 600 | Section titles ("Your Funds") |
| Fund value | 16px | 700 | Per-fund current value |
| Body | 15px | 400 | lineHeight: 22 |
| XIRR/metric value | 15px | 700 | In portfolio header |
| Fund meta value | 13px | 600 | In fund card bottom strip |
| Label | 10–11px | 600 | UPPERCASE, letterSpacing: 0.4–0.6 |
| Caption | 10px | 500 | letterSpacing: 0.4 |

---

## Key Component Patterns

### Portfolio Header (full-bleed gradient)

```tsx
<LinearGradient colors={Colors.gradientHeader} style={styles.portfolioHeader}>
  {/* 1. Verdict — signal first */}
  {isAheadOfMarket !== null && (
    <View style={styles.verdictBlock}>
      <Text style={styles.verdictHeadline}>Beating/Lagging the market</Text>
      <Text style={styles.verdictDelta}>↑ 2.1% ahead · vs Nifty 50</Text>
    </View>
  )}
  {/* 2. Portfolio value + daily change */}
  <View style={styles.valueRow}>
    <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
    <DailyChangePill />
  </View>
  {/* 3. Your Return | Benchmark (two columns, no "vs Market" third) */}
  <View style={styles.xirrRow}>...</View>
  {/* 4. Benchmark selector pills */}
  <BenchmarkSelector />
</LinearGradient>
```

**Full-bleed:** No `marginHorizontal`, no `borderRadius`. Runs edge to edge.
**Dark header bar above it:** `backgroundColor: '#0a2e25'` (matches gradientHeader[0]).
Logo uses `light` prop (white variant) in the dark header.

### Fund Card

Three columns in the bottom strip: **Invested | 30d sparkline | Return**

- NAV was replaced by a sparkline — more informative for novices, who can't interpret raw NAV
- "XIRR" label replaced by "Return" everywhere users see it
- Sparkline color: `Colors.positive` if fund XIRR ≥ 0, else `Colors.negative`

```tsx
<Sparkline
  data={fund.navHistory30d.map(p => p.value)}
  color={fund.returnXirr >= 0 ? Colors.positive : Colors.negative}
  width={60}
  height={24}
/>
```

### Sparkline (`src/components/Sparkline.tsx`)

SVG polyline via `react-native-svg`. No axes, no labels, no interaction.
Props: `data: number[]`, `color: string`, `width?: number`, `height?: number`.
Default: 60×24px. 2px internal padding. strokeWidth: 1.5.

### Category Accent Colors (fund card left bar)

```ts
Equity / Large Cap: Colors.primary  // teal
Mid Cap:            '#7c3aed'       // purple
Small Cap:          Colors.negative // red
Flexi / Multi Cap:  '#0891b2'       // cyan
ELSS:               Colors.positive // green
Debt:               Colors.warning  // amber
Hybrid:             '#db2777'       // pink
```

### XIRR Label Convention

| Context | Label |
|---------|-------|
| Portfolio header | "Your Return" |
| Fund card | "Return" |
| Fund detail Performance tab | "Your Return" |
| Hint text (fund detail) | "SIP-adjusted annualised return" — keep this, it's the explanation |
| Compare table | "XIRR" (WIP screen, not yet updated) |

---

## Navigation Context

- Bottom tab bar: Portfolio (home), Compare, Settings
- Active tint: `Colors.primary` (teal)
- Inactive tint: `Colors.textTertiary`
- Tab bar border: `Colors.borderLight`
- Compare tab is WIP — do not redesign structurally

---

## Out of Scope (deferred)

- Custom fonts — needs expo-google-fonts + async loading
- Dark mode — needs theming architecture
- Portfolio performance chart on home screen — new feature
- Animation / haptics
