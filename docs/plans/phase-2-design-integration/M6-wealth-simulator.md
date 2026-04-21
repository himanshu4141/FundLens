# M6 — Wealth Simulator

Superseded by [M11 — Wealth Journey Redesign](/Users/hyadav/code/personal/FundLens/docs/plans/phase-2-design-integration/M11-wealth-journey-redesign.md).

## Context

Replace the M1 placeholder in `app/(tabs)/simulator.tsx` with a fully functional
Wealth Simulator. Users enter SIP amount, one-time lumpsum, expected return %,
and investment horizon; the screen shows projected wealth milestones and a compound
growth line chart.

## Stack Position

`main` → M1 → M2 → M3 → M4 → M5 → **[M6 Wealth Simulator ← you are here]** → M7 Theme

---

## Design Decisions

### Slider approach — custom step controls

`@react-native-community/slider` has broken web rendering (renders as `<input type=range>`
that is styled inconsistently and breaks Playwright interaction). Since every PR is
validated with Playwright on web, we use **custom step controls** instead:

```
[−]  ₹5,000  [+]
```

Each control is a row of three: decrement `TouchableOpacity`, a centred `Text` value,
and increment `TouchableOpacity`. Step size and min/max are configurable per field.

This avoids any new native dependency. `@react-native-community/slider` is NOT added.

### Computation — pure math, no external data

```
FV = PV * (1 + r)^n  +  SIP * ((1 + r)^n - 1) / r
```
where `r = annualRate / 12 / 100` (monthly rate) and `n = years * 12` (months).

Computation lives in `src/utils/simulatorCalc.ts` for unit testability.

### "SIP boost" comparison

A second line on the chart shows wealth if monthly SIP is increased by a fixed delta
(default ₹5,000). The gap at horizon year is surfaced as "You'd gain ₹X extra".

### Chart

`LineChart` from `react-native-gifted-charts` (already installed). Two lines:
- Base projection (primary colour)
- Boosted SIP projection (green, dashed via `lineType='dotted'`)

Data points at each year from year 1 to horizon (max 30 points).

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/simulatorCalc.ts` | NEW — projection math |
| `src/utils/__tests__/simulatorCalc.test.ts` | NEW — unit tests |
| `app/(tabs)/simulator.tsx` | Replace placeholder with full screen |

---

## Algorithm

### `projectWealth(sip, lumpsum, annualRate, years)`

Returns `{ year: number; value: number }[]` — one entry per year, year 1 … years.

```
r = annualRate / 12 / 100          // monthly interest rate
for year = 1 to years:
  n = year * 12
  fv = lumpsum * (1 + r)^n  +  sip * ((1 + r)^n - 1) / r
  push { year, value: round(fv) }
```

Edge cases:
- `annualRate === 0`: `fv = lumpsum + sip * n` (no compounding, avoid 0^n issues)
- Negative / NaN inputs: clamp to 0

### Milestone values

From the projection array, extract values at years 5, 10, 15, and `horizon`.
De-duplicate if `horizon` coincides with any of those.

---

## Implementation Steps

### 1. `src/utils/simulatorCalc.ts`

```typescript
export type ProjectionPoint = { year: number; value: number };

export function projectWealth(
  sip: number,
  lumpsum: number,
  annualRate: number,
  years: number,
): ProjectionPoint[] { ... }
```

### 2. `src/utils/__tests__/simulatorCalc.test.ts`

Tests:
- Zero rate → linear growth (lumpsum + sip * months)
- Known FV with 12% annual (1% monthly) — manual calculation check
- Horizon 1 → single point
- All-zero inputs → all zeros
- Negative inputs clamped to 0
- Milestone extraction helper if extracted to util (or inline tests)

### 3. `app/(tabs)/simulator.tsx`

Structure:
```
<SafeAreaView>
  <Header (Logo + settings icon — same as placeholder)>
  <ScrollView>
    <Title + subtitle>
    <InputCard "Monthly SIP"      step=500   min=0      max=100000  prefix="₹">
    <InputCard "One-time Lumpsum" step=10000 min=0      max=5000000 prefix="₹">
    <InputCard "Expected Return"  step=0.5   min=1      max=30      suffix="% p.a.">
    <InputCard "Investment Period" step=1    min=1      max=30      suffix=" yrs">
    <MilestonesCard (5Y / 10Y / 15Y / horizon milestones)>
    <ChartCard (LineChart — base + boosted)>
    <SIPBoostInsight "Increase SIP by ₹5k → gain ₹X extra">
  </ScrollView>
</SafeAreaView>
```

Default values:
- SIP: ₹5,000
- Lumpsum: ₹0
- Rate: 12%
- Years: 15

`InputCard` — inline component, takes `{ label, value, step, min, max, prefix?, suffix?, onChange }`.
Renders `[−] formatted-value [+]`.

---

## Verification Checklist

- [ ] Simulator tab shows full screen (no "Coming in M6" badge)
- [ ] All four step controls adjust values correctly
- [ ] Chart updates live as values change
- [ ] Milestone cards show correct projected values
- [ ] SIP boost insight shows sensible ₹ gain
- [ ] `npm run typecheck && npm run lint && npm test` pass
- [ ] Playwright: screenshot simulator screen with default + adjusted values
