# M3 — Performance Leaderboard Screen

## Context

The designer's concept shows a dedicated Leaderboard screen (3rd prominent section in the app) that
ranks the user's funds by performance vs their benchmark. The tab was added as a placeholder in M1.
This milestone replaces that placeholder with a fully functional screen.

## Stack Position

`main` → M1 Nav → M2 Home → **[M3 Leaderboard ← you are here]** → M4 Fund Tech → M5 Fund Detail+ → M6 Simulator → M7 Theme

---

## Files Changed

| File | Change |
|---|---|
| `app/(tabs)/leaderboard.tsx` | Replace placeholder with full leaderboard screen |

---

## Algorithm: Leaderboard Rankings

### Data source
- Re-uses `usePortfolio(benchmarkSymbol)` — same hook as Home screen
- `fundCards[].returnXirr` — each fund's XIRR since first investment
- `summary.marketXirr` — benchmark XIRR over the same composite period
- `summary.xirr` — portfolio-level XIRR (for Alpha Insight card)

### Ranking logic
1. Filter out funds where `navUnavailable === true` (no NAV data yet)
2. Sort remaining funds by `returnXirr` descending
3. Leaders = funds where `returnXirr > summary.marketXirr`
4. Laggards = funds where `returnXirr <= summary.marketXirr`
5. Outperformance per fund = `returnXirr - marketXirr` (annualised percentage points)

### Alpha Insight card
- Portfolio-level alpha = `summary.xirr - summary.marketXirr`
- Label: "You're outperforming / underperforming the market by X.X pp annually"

---

## Screen Layout

```
┌─────────────────────────────────────┐
│  [Header: Logo + Settings icon]     │
├─────────────────────────────────────┤
│  Benchmark pills: Nifty 50 | ...    │
├─────────────────────────────────────┤
│  Alpha Insight card                 │
│  "Portfolio vs Nifty 50"            │
│  Your XIRR: 7.03% | Nifty: 4.5%    │
│  +2.5 pp ahead                      │
├─────────────────────────────────────┤
│  Leaders (N funds)                  │
│  ┌──────────────────────────────┐   │
│  │ Fund Name         [+2.5 pp]  │   │
│  │ Category      ₹2.33L | 8.8% │   │
│  └──────────────────────────────┘   │
│  ...                                │
├─────────────────────────────────────┤
│  Laggards (N funds)                 │
│  ┌──────────────────────────────┐   │
│  │ Fund Name         [-1.2 pp]  │   │
│  │ Category      ₹3.41L | 5.3% │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Fund card fields (each card)
- Fund name (1 line, truncated)
- Category
- Current value (₹ formatted)
- XIRR % (fund-level)
- Outperformance badge: "+2.5 pp" (green) or "-1.2 pp" (red)
- "Beating market" / "Trailing market" sub-label

### Alpha Insight card
- Shows when `summary` is not null
- Two columns: "Your Portfolio" (XIRR) vs benchmark label (marketXirr)
- Bottom line: alpha in pp (positive = green, negative = red)

---

## Implementation Steps

### 1. Replace placeholder body in `app/(tabs)/leaderboard.tsx`
- Add `useAppStore` for `defaultBenchmarkSymbol` + `setDefaultBenchmarkSymbol`
- Add local `benchmarkSymbol` state initialised from store, with `BenchmarkSelector` component (inline, same as Home)
- Call `usePortfolio(benchmarkSymbol)` to get `{ fundCards, summary, isLoading }`
- Compute `leaders` and `laggards` arrays
- Render `ScrollView` with: benchmark pills → Alpha Insight card → Leaders section → Laggards section

### 2. Loading state
- Show skeleton cards (grey rounded rects) while `isLoading`
- Show "No funds" empty state if `fundCards.length === 0` and not loading

### 3. Tap-through to fund detail
- Each fund card is tappable → `router.push(\`/fund/${fund.id}\`)`

---

## Verification Checklist

- [ ] Leaderboard tab shows ranked fund list (not the placeholder)
- [ ] Leaders section shows funds beating the selected benchmark
- [ ] Laggards section shows funds trailing the benchmark
- [ ] Alpha Insight card shows portfolio vs benchmark XIRR
- [ ] Switching benchmark pills updates the rankings and Alpha Insight
- [ ] Tapping a fund card navigates to fund detail
- [ ] Loading state shows skeleton
- [ ] `npm run typecheck && npm run lint && npm test` pass with zero errors/warnings
