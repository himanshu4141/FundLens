# M4 — Fund Technical Details

## Context

The designer's concept shows a "Technical Details" card on the Fund Detail screen with:
expense ratio, AUM, and minimum SIP. This data is not in MFAPI — it comes from
`mf.captnemo.in` (Kuvera-backed community API). Exit load is intentionally omitted
(not available from any free structured API).

## Stack Position

`main` → M1 Nav → M2 Home → M3 Leaderboard → **[M4 Fund Tech ← you are here]** → M5 Fund Detail+ → M6 Simulator → M7 Theme

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/YYYYMMDD_fund_meta.sql` | Add meta columns to `fund` table |
| `supabase/functions/sync-fund-meta/index.ts` | New edge function |
| `src/hooks/useFundDetail.ts` | Include new columns in SELECT + expose in interface |
| `app/fund/[id].tsx` | Add TechnicalDetailsCard section |

---

## API Sources

- **MFAPI**: `GET https://api.mfapi.in/mf/{schemeCode}` — returns `meta.isin_growth`
- **Kuvera API**: `GET https://mf.captnemo.in/kuvera/{isin}` — returns `expense_ratio`, `aum`, `min_sip_amount`
- Both are free, no auth required

---

## Implementation Steps

### Step 1 — DB migration
Add columns to `fund` table:
```sql
ALTER TABLE fund ADD COLUMN IF NOT EXISTS isin TEXT;
ALTER TABLE fund ADD COLUMN IF NOT EXISTS expense_ratio DECIMAL(6,4);
ALTER TABLE fund ADD COLUMN IF NOT EXISTS aum_cr DECIMAL(12,2);
ALTER TABLE fund ADD COLUMN IF NOT EXISTS min_sip_amount INTEGER;
ALTER TABLE fund ADD COLUMN IF NOT EXISTS fund_meta_synced_at TIMESTAMPTZ;
```

### Step 2 — Edge function `sync-fund-meta`
- Deploy to `supabase/functions/sync-fund-meta/index.ts`
- For each active fund in DB:
  1. `GET https://api.mfapi.in/mf/{scheme_code}` → extract `meta.isin_growth`
  2. `GET https://mf.captnemo.in/kuvera/{isin}` → extract `expense_ratio`, `aum`, `min_sip_amount`
  3. Upsert to `fund` table by `id`
- Rate-limit: 200ms delay between funds to avoid hammering public APIs
- Structured logs: `[sync-fund-meta] invocation`, `[sync-fund-meta] scheme {code}`, `[sync-fund-meta] done`
- Deploy with `--no-verify-jwt`

### Step 3 — `useFundDetail.ts` update
- Extend SELECT: add `isin, expense_ratio, aum_cr, min_sip_amount, fund_meta_synced_at`
- Extend `FundDetailData` interface with these optional fields (all nullable)

### Step 4 — Fund detail UI
- Add `TechnicalDetailsCard` below the tab content in `app/fund/[id].tsx`
- Shows: Expense Ratio | AUM | Min SIP
- Formats: "0.52%", "₹12,450 Cr", "₹500"
- Shows "—" if `fund_meta_synced_at` is null (not yet synced)
- "View SID" link opens fund factsheet (no exit load field)

---

## Verification Checklist

- [ ] Migration applied, columns exist in `fund` table
- [ ] Edge function deployed; manual trigger populates columns for demo user's funds
- [ ] Fund Detail shows Technical Details card
- [ ] Expense ratio, AUM, min SIP display with correct formatting
- [ ] Shows "—" for unsynced funds
- [ ] `npm run typecheck && npm run lint && npm test` pass with zero errors/warnings
