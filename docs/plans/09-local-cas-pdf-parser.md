# Replace CASParser.in PDF Upload With Local Parsing

## Goal

Replace the manual CAS PDF upload path’s dependency on CASParser.in with a local parser that runs inside the `parse-cas-pdf` Supabase Edge Function.

## User Value

Before this change, manual PDF upload depends on an external paid parsing service. If that service is unavailable, changes pricing, or is removed, PDF import breaks.

After this change, the user can still upload a CAS PDF from the app and import their portfolio without any CASParser.in dependency on the PDF upload path.

## Context

The repository already supports two CAS ingestion flows:

1. Email forwarding via CASParser.in inbound email API.
2. Manual PDF upload through `parse-cas-pdf`.

On `main`, the manual PDF upload flow still sends the uploaded file to CASParser.in `smart/parse`. The app screen is implemented in `app/onboarding/pdf.tsx`, and the backend handler lives in `supabase/functions/parse-cas-pdf/index.ts`.

The rest of the import pipeline already exists locally:

- `supabase/functions/_shared/import-cas.ts` converts a parsed CAS payload into database writes.
- `cas_import`, `fund`, and `transaction` persistence is already handled there.

This plan changes only how the parsed CAS payload is produced for manual uploads.

## Assumptions

- The user’s PAN remains the PDF password source for manual imports.
- The uploaded PDFs are mostly CAMS and KFintech CAS statements; MFCentral support can be best-effort.
- The email-forwarding path can continue using CASParser.in for now. This plan removes CASParser.in only from the manual PDF upload path.
- The final solution must fit within Supabase Edge Function bundle limits and must deploy successfully.

## Definitions

- CAS: Consolidated Account Statement PDF that contains folios, schemes, and transaction history.
- Local parser: Code that reads the PDF inside the Edge Function and produces the same data structure previously returned by CASParser.in.
- Public entrypoint: A dependency import path that the package explicitly exposes and supports. Internal file paths are not acceptable because they break across versions.

## Scope

1. Replace the CASParser.in call inside `supabase/functions/parse-cas-pdf/index.ts` with local parsing.
2. Add a parser helper that extracts text from encrypted CAS PDFs and converts it into the `CASParseResult` shape expected by `import-cas.ts`.
3. Keep the app upload screen behavior unchanged unless a transport fix is required for reliability.
4. Ensure the function bundle remains small enough to deploy to Supabase.
5. Update README “What works now” if the feature becomes functional on this branch.

## Out of Scope

- Replacing CASParser.in in the inbound email webhook flow.
- Perfect support for every historical CAS format.
- Native mobile background parsing outside Supabase.
- A large parser framework or separate microservice.

## Approach

### Parser strategy

Use a dependency-light PDF text extraction path that works in Deno Edge Functions, then parse the extracted text using repository-owned logic.

The parser must:

1. Read raw PDF bytes plus PAN password.
2. Extract plaintext from encrypted CAS PDFs using a stable, public dependency entrypoint.
3. Parse folios, schemes, and transactions with repository-owned matching logic.
4. Produce a `CASParseResult` compatible with `importCASData()`.

### Integration strategy

Keep the existing `parse-cas-pdf` function contract:

- Authenticated `POST`
- Binary PDF upload body from the client
- PAN loaded from `user_profile`
- Response shape `{ ok, funds, transactions }`

This minimizes frontend churn and lets validation focus on parser correctness and deployability.

### Bundle-size guardrail

Do not import private package subpaths or test helpers. Prefer:

- a public package entrypoint
- vendored minimal helper code if the public entrypoint is too heavy
- explicit checks on deploy size before considering the change complete

If the parser dependency still makes the bundle too large, reduce or replace it before merging.

## Alternatives Considered

### Keep CASParser.in for manual upload

Rejected because it does not remove the dependency and does not meet the goal of this work.

### Separate PDF parsing microservice

Rejected because it increases operational complexity and works against the current Supabase-only architecture.

### Import private package internals from `pdf-parse`

Rejected because private subpaths are unstable and already caused a regression in deployed function versions.

## Milestones

### M1 — Define the local-parser contract

Scope:

- Create a new helper module for local PDF parsing.
- Document the expected input and output shape in code comments.

Expected outcome:

- `parse-cas-pdf/index.ts` can call a local helper instead of CASParser.in without changing downstream import logic.

Acceptance criteria:

- The new helper returns `CASParseResult`.
- `parse-cas-pdf/index.ts` no longer references `https://api.casparser.in/v4/smart/parse`.

### M2 — Implement text extraction with a deployable dependency path

Scope:

- Add the PDF text extraction layer using only public, stable imports.
- Verify that encrypted PDFs with PAN passwords can be opened.

Expected outcome:

- A CAS PDF’s raw text can be extracted inside the Edge Function runtime.

Acceptance criteria:

- The code does not import private package subpaths.
- The function still bundles successfully.

### M3 — Parse extracted text into CAS data

Scope:

- Convert extracted text into folios, schemes, and transactions.
- Support the common CAMS and KFintech layouts first.

Expected outcome:

- Local parsing returns enough structured data for `importCASData()` to persist funds and transactions.

Acceptance criteria:

- A successful parse produces non-empty `mutual_funds` for representative PDFs.
- Expected parser failures return clear user-facing errors.

### M4 — Validate app flow and deployability

Scope:

- Run local static checks.
- Deploy `parse-cas-pdf`.
- Confirm the function version is live and usable from the app.

Expected outcome:

- The new manual upload path is testable in the preview app without CASParser.in.

Commands:

    npm run typecheck
    npm run lint
    supabase functions deploy parse-cas-pdf --project-ref <project-ref>

Acceptance criteria:

- TypeScript passes with zero errors.
- Lint passes with zero warnings.
- Deploy succeeds without size-limit failures.

## Validation

1. Static validation
   Run:

       npm run typecheck
       npm run lint

   Expected:

   - Both commands exit successfully.

2. Deploy validation
   Run:

       supabase functions deploy parse-cas-pdf --project-ref <project-ref>

   Expected:

   - The function deploys successfully.

3. Runtime validation
   In the app:

   - Save a valid PAN in onboarding settings.
   - Upload a representative CAS PDF.

   Expected:

   - The import completes, or returns a specific password/parse error.
   - No CASParser.in parse request is made for manual PDF upload.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| PDF library is too large for Supabase deploy limits | Choose a smaller dependency or vendor the minimum required parser logic |
| PDF library relies on unsupported Node internals | Use public Deno-compatible entrypoints only and validate deploy early |
| Regex parser misses uncommon statement layouts | Focus first on CAMS and KFintech, log warnings for partial skips, and keep errors specific |
| Wrong PAN causes confusing failures | Detect password/decryption errors and map them to a clear UI message |

## Decision Log

- 2026-03-20: Start this work from `main` on a fresh branch to avoid carrying over parser experiments that mixed auth, deploy-size, and dependency issues.
- 2026-03-20: Keep the existing binary upload client contract unless a transport issue is proven independently from parsing.
- 2026-03-20: Replace the attempted `pdf-parse` integration with `unpdf` because `pdf-parse` still produced a Supabase Edge bundle over 31 MB, while `unpdf` deployed successfully at about 1.3 MB.

## Amendments

- 2026-03-20: The final implementation does not keep parsing inside Supabase Edge Functions. Research and validation against a real CAS PDF showed that the mature open-source parser is the Python package `casparser`, while the Deno parser path remained brittle and layout-dependent. The implementation therefore moved parsing to a Vercel Python Function and kept Supabase Edge as the authenticated import and sync trigger layer.
- 2026-03-20: Preview support is handled by deriving the parser URL from the incoming request origin when available, so PR previews can exercise branch-specific Python parser code without changing Supabase secrets for every preview deployment.

## Progress

- [x] Fresh branch created from `main`
- [x] Baseline CASParser.in upload flow confirmed from `main`
- [x] Parser integration contract added
- [x] Mature parser researched and validated against a real CAS PDF
- [x] Vercel Python parser implemented using `casparser`
- [x] `parse-cas-pdf` switched away from CASParser.in for manual uploads
- [x] Typecheck and lint pass
- [ ] Vercel parser function deployed with shared secret env
- [ ] Updated `parse-cas-pdf` Edge Function deployed
- [ ] README “What works now” updated if behavior changes
