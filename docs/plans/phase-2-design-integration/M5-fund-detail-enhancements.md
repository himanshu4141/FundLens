# M5 — Fund Detail Enhancements: Growth Consistency + Portfolio Donut

## Context

Two new sections on the Fund Detail screen:
1. **Growth Consistency chart** — quarterly bar chart showing quarterly return % from navHistory
2. **Portfolio Health Donut** — fund's % of portfolio total value, using usePortfolio data

## Stack Position

`main` → M1 → M2 → M3 → M4 → **[M5 Fund Detail+ ← you are here]** → M6 Simulator → M7 Theme

---

## Files Changed

| File | Change |
|---|---|
| `app/fund/[id].tsx` | Add GrowthConsistencyChart + PortfolioHealthDonut |

---

## Algorithm

### Growth Consistency (quarterly returns)
1. From `data.navHistory` (ascending), group NAV values by quarter (Q1/Q2/Q3/Q4 of each year)
2. For each quarter, compute return = (lastNav - firstNav) / firstNav * 100
3. Pass to `BarChart` from `react-native-gifted-charts`
4. Positive bars: `Colors.positive`; negative bars: `Colors.negative`
5. Show only if ≥2 quarters of data

### Portfolio Health Donut
- Need total portfolio value → call `usePortfolio()` (same query key, cached)
- This fund's currentValue as % of totalValue
- Use `PieChart` from `react-native-gifted-charts` in donut mode
- Two slices: this fund (primary color) + rest of portfolio (light grey)
- Show fund %, rank among holdings (e.g. "Largest position" / "2nd largest")
- Show only if totalValue > 0 and currentValue > 0

---

## Implementation Steps

### 1. GrowthConsistencyChart component (inline in `app/fund/[id].tsx`)
- Accepts `navHistory: NavPoint[]`
- Computes quarterly returns from the last 3 years of NAV data (cap at 12 quarters)
- Renders `BarChart` with bar colors keyed to sign
- Shows nothing if < 2 quarters

### 2. PortfolioHealthDonut component (inline)
- Calls `usePortfolio(defaultBenchmarkSymbol)` (cached — no extra fetch)
- Computes this fund's share and rank
- Renders `PieChart` in donut mode with two segments

### 3. Insert both sections in `FundDetailScreen`
- Growth Consistency: below TechnicalDetailsCard, inside ScrollView
- Portfolio Health: below Growth Consistency

---

## Verification Checklist

- [ ] Fund detail shows Growth Consistency bar chart (quarterly returns)
- [ ] Positive quarters green, negative quarters red
- [ ] Fund detail shows Portfolio Health donut
- [ ] Donut shows this fund's % of total portfolio
- [ ] `npm run typecheck && npm run lint && npm test` pass
