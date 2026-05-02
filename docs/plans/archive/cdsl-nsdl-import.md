# CDSL / NSDL CAS Import


## Goal


Extend FundLens' PDF import pipeline to accept CAS PDFs issued by CDSL (Central Depository Services Limited) and NSDL (National Securities Depository Limited) so users who hold mutual funds through a demat account can import their transaction history.


## User Value


Many mutual fund investors in India hold units in demat form through CDSL or NSDL rather than through AMC folios directly. Their CAS PDF comes from the depository, not from CAMS or KFintech. Before this change, uploading such a PDF produced a cryptic parser error with no actionable guidance. After this change, the same upload flow silently detects the PDF type, parses transactions, and populates the portfolio exactly as a CAMS PDF would — with no extra steps from the user beyond setting their date of birth in account settings.


## Context


FundLens is an Expo React Native app backed by a Supabase database and a Vercel-hosted Python API. CAS PDF parsing happens in the Vercel API (`api/parse-cas-pdf.py` → `api/_cas_parser.py`). Once parsed, the resulting JSON is processed by the shared TypeScript module `supabase/functions/_shared/import-cas.ts`, which upserts scheme and transaction rows.

**Before this work** only CAMS / KFintech / MFCentral PDFs were supported, via the open-source `casparser` Python library.

**Key differences between CAMS and CDSL/NSDL CAS PDFs:**

- Password: CAMS uses the user's PAN (10 chars); CDSL/NSDL uses PAN + date of birth in DDMMYYYY format (18 chars total).
- AMFI codes absent: CDSL/NSDL PDFs list mutual fund holdings by ISIN, not AMFI scheme code. AMFI codes must be looked up from AMFI's public NAV file (`https://www.amfiindia.com/spages/NAVAll.txt`).
- Different text layout: casparser cannot parse CDSL/NSDL PDFs; a custom pdfplumber-based parser is required.
- Multilingual: CDSL CAS is bilingual (Hindi + English). Section headers and date month names may appear in Devanagari script. The parser must not rely on header text.
- Equity content: CDSL/NSDL PDFs also contain equity/demat holdings; the parser extracts only the mutual fund section.

**REVERSAL bug (fixed as part of this work):** casparser returns `REVERSAL` transaction rows when an attempted SIP fails (payment declined before settlement). These rows have `units = null`. The old code treated REVERSAL as a regular transaction type and the null-units filter silently let through both the reversal and its paired purchase, resulting in phantom holdings (funds the user never actually owned appearing with inflated unit counts and portfolio value). The fix keys reversal matching on `date + amount` (always present), excludes both the REVERSAL row and its paired PURCHASE from the import, and marks the fund as inactive when closing units are zero and no real transactions remain.


## Assumptions


- Users have a date of birth set in their `user_profile` row; the CDSL/NSDL password cannot be derived without it.
- The AMFI public NAV file is reachable from Vercel at parse time (external HTTP fetch).
- CDSL and NSDL PDF structures are similar enough that one parser handles both.
- Only mutual fund sections of CDSL/NSDL PDFs are imported; equity holdings are out of scope.


## Definitions


- **CAS**: Consolidated Account Statement — a PDF report listing all mutual fund holdings and transactions across all AMCs for a given investor.
- **CAMS / KFintech / MFCentral**: Registrar and transfer agents (RTAs) that issue CAS PDFs for AMC-held (non-demat) units. Parsed by `casparser`.
- **CDSL / NSDL**: Depositories that issue CAS PDFs for demat-held units. Parsed by the new `_cdsl_nsdl_parser.py`.
- **AMFI code**: A unique integer identifier for a mutual fund scheme used by mfapi.in and in FundLens' `scheme_master` table as `scheme_code`.
- **ISIN**: International Securities Identification Number — a 12-character code (e.g. `INF846K01VD5`) that uniquely identifies a security. CDSL/NSDL PDFs use ISINs rather than AMFI codes.
- **REVERSAL**: A casparser transaction type representing an attempted purchase or SIP that failed before settlement. Units are null (the transaction never completed).
- **HoldingsOnlyError**: Raised when a CDSL/NSDL PDF contains holdings but zero transactions (a "summary CAS" rather than a "detailed CAS"). The user must download a Detailed CAS from the depository to get transaction history.
- **pdfplumber**: Python library for extracting text and tables from PDF files using layout coordinates (language-agnostic).


## Scope


- `api/_cdsl_nsdl_parser.py` — new Python module that parses CDSL/NSDL CAS PDFs
- `api/_cas_parser.py` — auto-detection logic routes to the correct parser; accepts `cdsl_password` parameter
- `api/parse-cas-pdf.py` — Vercel endpoint; accepts `x-password-cdsl` header
- `supabase/functions/parse-cas-pdf/index.ts` — edge function; fetches `dob` from `user_profile`, computes CDSL password, forwards it
- `supabase/functions/_shared/import-cas.ts` — REVERSAL bug fix (amount-based pairing, inactive-marking)
- `supabase/migrations/20260502000000_add_dob_to_user_profile.sql` — adds `dob date` column
- `src/types/database.types.ts` — adds `dob: string | null` to `user_profile` row type
- `app/onboarding/index.tsx` — DOB input field in profile step
- `app/(tabs)/settings/account.tsx` — DOB display + edit
- `app/onboarding/pdf.tsx` — CDSL/NSDL instructions and DOB warning
- `requirements.txt` — adds `pdfplumber==0.11.4`
- Tests: Python unit tests for all parser functions; TypeScript tests for REVERSAL fix


## Out of Scope


- Equity/stock holdings from CDSL/NSDL CAS (only mutual fund section imported)
- ETF holdings (listed securities even if ISIN starts with INF)
- CDSL/NSDL email-based auto-import (email forwarding webhook path)
- Parsing the demat account section


## Approach


### Auto-detection strategy

Open the PDF with `pdfplumber` using the primary password (PAN). Extract text from the first three pages and scan for the ASCII strings "CDSL" or "NSDL". These acronyms always appear as ASCII regardless of whether the PDF is bilingual. If detected, route to `_cdsl_nsdl_parser`. If not, route to `casparser` for CAMS/KFintech/MFCentral PDFs. If casparser fails but the text contains ISINs matching `INF[A-Z0-9]{9}`, retry with the CDSL/NSDL parser as a fallback.

Two passwords are needed because CDSL/NSDL PDFs reject the PAN-only password. The edge function computes the CDSL password from profile data (`PAN + DDMMYYYY`) and sends it as a separate header (`x-password-cdsl`). The Python layer tries the primary password first; if that fails and a CDSL password is provided, tries that second.

### Multilingual CDSL parsing

CDSL CAS PDFs are bilingual by default (Hindi + English). The parser avoids relying on column headers or section labels:

1. Use ISIN presence (`INF[A-Z0-9]{9}`) as the anchor for every scheme block — ISINs are always ASCII.
2. Use `pdfplumber`'s position-based table extraction, which is layout-driven and language-agnostic.
3. Map date month names in both English and Hindi Devanagari to ISO month numbers.
4. Map transaction description keywords in both English and Hindi to uppercase type strings matching casparser conventions.

### ISIN → AMFI code mapping

CDSL/NSDL CAS PDFs do not contain AMFI scheme codes. At parse time, the parser fetches AMFI's public NAV file, which lists every scheme's ISIN, AMFI code, and category. A module-level cache avoids repeated fetches on warm Vercel invocations.

### REVERSAL fix

The old code treated `REVERSAL` as a transaction type (mapped to `'redemption'`) and relied on `units > 0` to filter it out. But casparser sends `units = null` for REVERSAL rows, so neither guard worked — the REVERSAL was skipped but the paired PURCHASE was imported, creating phantom holdings.

The fix:
1. `normaliseTxType('REVERSAL')` returns `null` (skip entirely).
2. Before filtering transactions, build a `reversedKeys` set keyed by `"${date}:${Math.abs(amount)}"`.
3. In the filter, exclude both REVERSAL rows and any PURCHASE row whose `"date:amount"` key is in `reversedKeys`.
4. Before upserting, delete any previously-imported purchase rows that match a reversal key (handles re-imports).
5. If `mf.units === 0` and no real transactions remain after filtering, mark the fund `is_active = false` so it does not appear in the active portfolio.


## Milestones


### M1 — DB + types (foundation)

Add the `dob` column to `user_profile` and update TypeScript types.

Files:
- `supabase/migrations/20260502000000_add_dob_to_user_profile.sql`
- `src/types/database.types.ts`

Commands:

    supabase db push

Acceptance: `user_profile` table has a nullable `dob date` column. TypeScript compiles without errors.


### M2 — Python parser `_cdsl_nsdl_parser.py`

Implement the CDSL/NSDL parser module with all core functions:
- `fetch_amfi_isin_map()` — fetch and cache the AMFI NAV file; return `{isin: (scheme_code, broad_category)}`
- `detect_cdsl_nsdl(raw_text)` — return `"cdsl"`, `"nsdl"`, or `None`
- `parse_date_cdsl(raw)` — handle English and Hindi month names; return ISO `YYYY-MM-DD`
- `normalise_cdsl_tx_type(description)` — map English and Hindi descriptions to casparser-compatible uppercase type strings
- `extract_mf_folios(pdf, isin_map)` — build folio list from pdfplumber tables
- `parse_cdsl_nsdl(pdf_bytes, password)` — entry point; raises `HoldingsOnlyError` if zero transactions

Output shape matches existing `CASParseResult` (`{"mutual_funds": [...folios]}`).

Files:
- `api/_cdsl_nsdl_parser.py` (new)
- `requirements.txt` (add `pdfplumber==0.11.4`)
- `api/tests/test_cdsl_nsdl_parser.py` (new)

Commands:

    cd api && python -m pytest tests/ -v

Acceptance: All Python tests pass. `detect_cdsl_nsdl` correctly identifies CDSL and NSDL text including Hindi. `parse_date_cdsl` handles both English and Hindi month names. `normalise_cdsl_tx_type` handles both English and Hindi descriptions.


### M3 — Auto-detect routing in `_cas_parser.py`

Change `parse_cas_pdf_bytes` to:
1. Accept an optional `cdsl_password` parameter.
2. Open with `pdfplumber` and scan first 3 pages for CDSL/NSDL markers.
3. Route to `parse_cdsl_nsdl` or `casparser` accordingly.
4. ISIN fallback: if casparser fails and text contains ISINs, retry with CDSL/NSDL parser.

Files:
- `api/_cas_parser.py`


### M4 — Vercel endpoint + edge function

Wire the new password headers through the stack:
- `api/parse-cas-pdf.py`: accept `x-password-cdsl` header; propagate `HoldingsOnlyError` as HTTP 422.
- `supabase/functions/parse-cas-pdf/index.ts`: fetch `dob`, compute CDSL password, send `x-password-cdsl` header.

Also add `cors.ts` `x-password-override` header to the allow-list (for local testing).

Files:
- `api/parse-cas-pdf.py`
- `supabase/functions/parse-cas-pdf/index.ts`
- `supabase/functions/_shared/cors.ts`

Commands:

    npx supabase functions deploy parse-cas-pdf


### M5 — REVERSAL fix in `import-cas.ts`

Fix the phantom-holdings bug:
1. `normaliseTxType('REVERSAL')` → `null`.
2. Amount-based reversal key set built before transaction loop.
3. Delete previously-imported matched purchase rows on re-import.
4. Exclude both REVERSAL and paired PURCHASE rows from upsert.
5. Mark fund `is_active = false` when `mf.units === 0` and no real transactions remain.

Files:
- `supabase/functions/_shared/import-cas.ts`
- `supabase/functions/_shared/__tests__/import-cas.test.ts`

Commands:

    npx jest supabase/functions/_shared/__tests__/import-cas.test.ts

Acceptance: 72 tests pass. `import-cas.ts` has 100% statement coverage.


### M6 — UI: DOB field in onboarding and settings

Add date of birth input to:
- `app/onboarding/index.tsx` — DOB field below PAN, optional, format DD/MM/YYYY
- `app/(tabs)/settings/account.tsx` — DOB display row with edit support

Files:
- `app/onboarding/index.tsx`
- `app/(tabs)/settings/account.tsx`

Commands:

    npm run typecheck && npm run lint


### M7 — UI: PDF upload screen instructions

Update `app/onboarding/pdf.tsx`:
- Add CDSL and NSDL to the supported PDFs panel with password format info.
- Add CDSL and NSDL to the "how to get the file" panel.
- Show a yellow warning card if DOB is not set in profile.

Files:
- `app/onboarding/pdf.tsx`

Commands:

    npm run typecheck && npm run lint


## Validation


1. **DB migration**: Run `supabase db push` and confirm `user_profile` has `dob date` column.

2. **Python unit tests**: `cd api && python -m pytest tests/ -v` — all tests pass.
   - `test_detect_cdsl_nsdl`: fixture strings in English and Hindi → correct type
   - `test_parse_date_cdsl`: "05-Apr-2024" and "05-अप्रैल-2024" both → "2024-04-05"
   - `test_normalise_cdsl_tx_type`: English and Hindi descriptions → expected type strings
   - `test_fetch_amfi_isin_map`: mock HTTP → correct `{isin: (code, category)}` mapping
   - `test_holdings_only_rejection`: zero transactions → `HoldingsOnlyError`

3. **TypeScript tests**: `npx jest --coverage` — 515 tests pass; `import-cas.ts` 100% statement coverage; `src/utils` ≥ 95%.

4. **TypeScript + lint**: `npm run typecheck && npm run lint` — zero errors, zero warnings.

5. **Manual CDSL end-to-end**: Upload an actual CDSL/NSDL CAS PDF with DOB set in account settings → funds and transactions appear on the home screen.

6. **CAMS regression**: Upload a CAMS CAS PDF → still parses correctly (auto-detect routes to casparser).

7. **Missing DOB path**: Upload CDSL PDF without DOB set → clear error message shown in UI.

8. **Holdings-only path**: Upload a summary (holdings-only) CDSL PDF → "Detailed CAS required" error displayed.

9. **REVERSAL regression**: Fund that had a failed SIP (REVERSAL + paired PURCHASE from casparser) → fund not created or marked inactive; does not appear in active portfolio.


## Risks And Mitigations


- **AMFI NAV file unavailable**: If `amfiindia.com` is down at parse time, ISIN lookup fails. Mitigation: module-level cache means warm Vercel instances succeed; cold starts surface a clear error rather than silently importing with empty AMFI codes.
- **CDSL/NSDL PDF layout changes**: Depository PDFs are not formally versioned. Mitigation: ISIN-anchored extraction is more robust than header-text matching; regression is caught when real-user PDFs fail to parse.
- **Bilingual edge cases**: Some Hindi month names have variant spellings in Devanagari. Mitigation: `MONTH_MAP` includes known variants (e.g. both "अक्तूबर" and "अक्टूबर" for October).
- **`LOCAL_CAS_PARSER_URL` secret**: During development the edge function is pointed at a Vercel preview URL via this secret. After the PR merges, this secret must be unset (`npx supabase secrets unset LOCAL_CAS_PARSER_URL`) and the edge function redeployed.


## Decision Log


- **Custom parser over casparse.in API**: The casparse.in third-party API requires an API key and adds a network round-trip. Building our own parser with pdfplumber keeps the stack dependency-light and avoids a paid external service for each import.
- **Amount-based REVERSAL key (not units)**: casparser sends `units = null` for REVERSAL rows, so keying on units would silently miss the pairing. Amount is always present. The trade-off is theoretical collision if two purchases happen on the same day for the same amount — accepted as extremely rare and low-consequence (one phantom row at most).
- **`mf.units === 0` inactive check uses `=== null` guard for undefined**: If `mf.units` is undefined, the fund may still be active (data not available in CAS). Only explicitly zero values trigger the inactive mark.
- **DOB stored as ISO date in DB**: Stored as `date` (not `text`) so it can be formatted in either DDMMYYYY (CDSL password) or displayed as DD/MM/YYYY in the UI without additional parsing.


## Progress


- [x] M1 — DB migration: `dob` column added to `user_profile`
- [x] M1 — TypeScript types: `dob: string | null` added to `user_profile` row
- [x] M2 — `api/_cdsl_nsdl_parser.py` implemented
- [x] M2 — Python tests: `api/tests/test_cdsl_nsdl_parser.py` passing
- [x] M2 — `pdfplumber==0.11.4` added to `requirements.txt`
- [x] M3 — Auto-detect routing in `api/_cas_parser.py`
- [x] M4 — Vercel endpoint: `x-password-cdsl` header accepted in `api/parse-cas-pdf.py`
- [x] M4 — Edge function: fetches `dob`, computes CDSL password, sends header
- [x] M4 — `cors.ts` updated with `x-password-override` allow-listed
- [x] M5 — REVERSAL fix in `import-cas.ts`
- [x] M5 — TypeScript tests: 72 tests passing, 100% statement coverage on `import-cas.ts`
- [x] M6 — DOB field in onboarding (`app/onboarding/index.tsx`)
- [x] M6 — DOB display + edit in settings (`app/(tabs)/settings/account.tsx`)
- [x] M7 — PDF upload screen updated (`app/onboarding/pdf.tsx`)
