# M1 — Navigation Restructure

## Context

The designer's concept uses 3 bottom tabs (Dashboard / Funds / Simulator) with Settings accessible via a top-right icon in the app header — consistent with a "logged-in state" feel. The current app has 3 tabs (Portfolio / Compare / Settings), which conflicts with this model.

This milestone restructures navigation as a prerequisite for all subsequent milestones:
- **Remove Compare tab** — deprecated per design decision
- **Remove Settings from tab bar** — becomes a top-right icon in each screen's custom header
- **Add Leaderboard tab** — placeholder screen (full implementation in M3)
- **Add Simulator tab** — placeholder screen (full implementation in M6)

## Stack Position

`main` → **[M1 Nav ← you are here]** → M2 Home → M3 Leaderboard → M4 Fund Tech → M5 Fund Detail+ → M6 Simulator → M7 Theme

---

## Files Changed

| File | Change |
|---|---|
| `app/(tabs)/_layout.tsx` | Replace compare+settings tabs with leaderboard+simulator; hide settings from tab bar |
| `app/(tabs)/index.tsx` | Add settings gear icon to custom header |
| `app/(tabs)/leaderboard.tsx` | New — placeholder screen |
| `app/(tabs)/simulator.tsx` | New — placeholder screen |
| `docs/plans/` | Reorganised: phase-1-foundation/ + phase-2-design-integration/ + README.md |

**Not changed:** `app/(tabs)/settings.tsx`, `app/(tabs)/compare.tsx` (route stays, just removed from tab bar)

---

## Implementation Steps

### 1. `app/(tabs)/_layout.tsx`
- Replace Compare tab with Leaderboard (icon: `trophy-outline`)
- Add Simulator tab (icon: `calculator-outline`)
- Hide Settings from tab bar using `tabBarButton: () => null` (keeps route accessible)
- Tab order: Home | Leaderboard | Simulator

### 2. `app/(tabs)/index.tsx`
- Add settings gear icon to `headerActions` (next to Import link)
- `router.push('/(tabs)/settings')` on press
- Icon: `settings-outline` from Ionicons, white, size 20

### 3. `app/(tabs)/leaderboard.tsx` (new)
- Header: dark gradient matching Home, Logo, settings icon
- Body: "Coming soon" empty state with trophy icon + description
- Matches Home screen structural pattern (SafeAreaView + custom header + content)

### 4. `app/(tabs)/simulator.tsx` (new)
- Same structure as Leaderboard placeholder
- Calculator icon + "Coming soon" empty state

---

## Verification Checklist

- [ ] App launches with 3 tabs: Portfolio | Leaderboard | Simulator
- [ ] Compare tab is gone from tab bar
- [ ] Settings is NOT visible in the tab bar
- [ ] Gear icon appears in top-right of Home, Leaderboard, and Simulator screens
- [ ] Tapping gear icon navigates to Settings screen (full settings UI visible)
- [ ] Navigating back from Settings returns to the previous tab
- [ ] Leaderboard tab shows placeholder screen
- [ ] Simulator tab shows placeholder screen
- [ ] `npm run typecheck && npm run lint && npm test` all pass

---

## Test Cases

No new hook/util logic in this milestone — tests are structural/navigation only, validated via Playwright.
