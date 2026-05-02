# M7 — A/B Theme Toggle (Editorial Wealth V2)

## Context

Add a toggleable "Editorial Wealth" design theme (V2) behind a Settings switch.
Both V1 (Classic, current teal palette) and V2 (navy blue editorial palette) are
available to focus group participants without an app restart.

## Stack Position

`main` → M1 → M2 → M3 → M4 → M5 → M6 → **[M7 A/B Theme ← you are here]**

---

## Architecture

Only **colors** differ between themes. Spacing, Radii, and Typography are identical
across variants — this keeps the migration scope contained.

```
src/constants/theme.ts       ← V1 tokens (unchanged)
src/constants/theme_v2.ts    ← V2 tokens (navy editorial)
src/context/ThemeContext.tsx ← ThemeProvider + useTheme() hook
src/store/appStore.ts        ← add designVariant + AsyncStorage persist
app/_layout.tsx              ← wrap root with <ThemeProvider>
```

### `useTheme()` returns `{ colors, variant }`

All screen files migrate from:
```tsx
import { Colors } from '@/src/constants/theme';
```
to:
```tsx
import { useTheme } from '@/src/context/ThemeContext';
// inside component:
const { colors: Colors } = useTheme();
// StyleSheet moved into useMemo
const styles = useMemo(() => makeStyles(Colors), [Colors]);
```
Aliasing `colors` as `Colors` means no other code changes inside the component body.

---

## V2 Token Set (from designer's DESIGN.md)

```typescript
// src/constants/theme_v2.ts
export const ColorsV2 = {
  primary: '#003d9b',       // navy blue — trust, editorial
  primaryDark: '#002a6e',   // pressed states
  primaryLight: '#e8eef9',  // tint — banners, highlights

  positive: '#006c47',      // growth green (designer's secondary)
  negative: '#c0392b',      // red — losses
  warning: '#d97706',       // amber (unchanged)

  background: '#f8f9fb',    // slightly cooler off-white
  surface: '#ffffff',
  surfaceAlt: '#f3f6fb',    // blue-tinted alt surface

  border: '#dde4ee',        // blue-tinted border
  borderLight: '#edf0f7',

  textPrimary: '#0b1221',   // near-black with blue cast
  textSecondary: '#4a5568',
  textTertiary: '#9babc0',
  textOnDark: '#ffffff',

  gradientHero: ['#001233', '#003d9b'] as [string, string],
  gradientHeader: ['#001a5c', '#003d9b'] as [string, string], // deep navy
};
```

---

## Files Changed

| File | Change |
|---|---|
| `src/constants/theme_v2.ts` | NEW — V2 color tokens |
| `src/context/ThemeContext.tsx` | NEW — ThemeProvider + useTheme |
| `src/store/appStore.ts` | Add `designVariant`, AsyncStorage persist |
| `app/_layout.tsx` | Wrap root with ThemeProvider |
| `app/(tabs)/_layout.tsx` | useTheme for tab bar colors |
| `app/(tabs)/index.tsx` | useTheme + StyleSheet → useMemo |
| `app/(tabs)/leaderboard.tsx` | useTheme + StyleSheet → useMemo |
| `app/(tabs)/simulator.tsx` | useTheme + StyleSheet → useMemo |
| `app/(tabs)/settings.tsx` | useTheme + Design Theme toggle section |
| `app/fund/[id].tsx` | useTheme + StyleSheet → useMemo |
| `src/components/Logo.tsx` | useTheme for tint/color props |

Auth and onboarding screens are NOT migrated (pre-session; focus group won't see them).

---

## Implementation Steps

### 1. `src/constants/theme_v2.ts`
V2 color tokens as above. Shape identical to `Colors` in `theme.ts` for type safety.

### 2. `src/context/ThemeContext.tsx`
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { Colors } from '@/src/constants/theme';
import { ColorsV2 } from '@/src/constants/theme_v2';
import { useAppStore } from '@/src/store/appStore';

type AppColors = typeof Colors;

interface ThemeContextValue {
  colors: AppColors;
  variant: 'v1' | 'v2';
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: Colors,
  variant: 'v1',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const variant = useAppStore((s) => s.designVariant);
  const colors = variant === 'v2' ? ColorsV2 : Colors;
  return (
    <ThemeContext.Provider value={{ colors, variant }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
```

### 3. `src/store/appStore.ts`
Add `designVariant: 'v1' | 'v2'` + `setDesignVariant`.
Add `persist` middleware with AsyncStorage so variant survives app restarts.

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      defaultBenchmarkSymbol: '^NSEI',
      setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
      designVariant: 'v1' as 'v1' | 'v2',
      setDesignVariant: (variant: 'v1' | 'v2') => set({ designVariant: variant }),
    }),
    {
      name: 'foliolens-app-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### 4. `app/_layout.tsx`
Wrap `<QueryClientProvider>` children with `<ThemeProvider>` after the provider hierarchy.
ThemeProvider must be inside QueryClientProvider (it uses useAppStore, not queries, but
placing it consistently inside the provider tree is safest).

### 5. Screen files (index, leaderboard, simulator, settings, fund/[id], _layout)
Pattern for each:
1. Remove `Colors` from theme import, keep `Spacing, Radii, Typography`
2. Add `import { useTheme } from '@/src/context/ThemeContext'`
3. Inside component: `const { colors: Colors } = useTheme();`
4. Wrap StyleSheet.create call in `useMemo`: `const styles = useMemo(() => makeStyles(Colors), [Colors]);`
5. Extract existing `StyleSheet.create({...})` into a top-level `function makeStyles(Colors: AppColors) { return StyleSheet.create({...}); }`

### 6. Settings — Design Theme toggle
Add a new section "Design Theme" before the Sign Out button:
```tsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Design Theme</Text>
  {(['v1', 'v2'] as const).map((v) => (
    <TouchableOpacity key={v} style={styles.row} onPress={() => setDesignVariant(v)}>
      <Text style={styles.rowLabel}>{v === 'v1' ? 'Classic' : 'Editorial'}</Text>
      <Ionicons
        name={designVariant === v ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={designVariant === v ? Colors.primary : Colors.textTertiary}
      />
    </TouchableOpacity>
  ))}
</View>
```

### 7. `src/components/Logo.tsx`
Pass `useTheme().colors.primary` as the tint where the logo uses the brand color.

---

## Verification Checklist

- [ ] Settings > Design Theme toggle switches Classic ↔ Editorial
- [ ] All screens re-render with V2 navy palette when Editorial selected (no restart needed)
- [ ] V1 teal palette restores on Classic switch
- [ ] Variant persists across app reload (AsyncStorage)
- [ ] `npm run typecheck && npm run lint && npm test` pass
- [ ] Playwright: screenshot Settings with toggle, screenshot Home in V1 and V2
