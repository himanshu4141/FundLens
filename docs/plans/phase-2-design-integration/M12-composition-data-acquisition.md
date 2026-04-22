# ExecPlan: Composition Data Acquisition Redesign


## Status

Proposed


## Goal

Define a reliable, source-aware data acquisition strategy for fund composition after the Stage 1 research findings are reviewed and accepted.


## User Value

- Portfolio composition becomes more truthful because the app stops treating transformed fallback data as if it were disclosure-backed truth.
- Users see richer composition detail when the underlying source provides it.
- International FoFs stop being flattened into misleading oversimplified buckets.


## Context

The Stage 1 research report in `docs/research/2026-04-21-composition-source-validation.md` found:

1. Official AMC disclosures are the best candidate canonical source for asset allocation.
2. Official AMC disclosures often also win for sectors and holdings for domestic schemes.
3. `mfdata.in` remains useful for scheme metadata, family linkage, related variants, and selective enrichment.
4. `mfdata.in /families/{family_id}/allocation` had poor coverage in the sampled families.
5. International FoFs require richer source-native storage because both official and unofficial sources expose information that is more nuanced than a flat four-bucket summary.

The current repository implementation does not support this source model:

- `sync-fund-portfolios` currently builds composition from `mfdata.in` holdings and category rules.
- `fund_portfolio_composition` stores a flat summary only.
- debt holdings and other holdings are discarded.
- `source='amfi'` is misleading because those rows are transformed.


## Assumptions

- Stage 1 findings have been reviewed and accepted before implementation starts.
- The first rollout should prioritize truthfulness over broad AMC coverage.
- It is acceptable to preserve raw source buckets in storage even when some UI surfaces still consume a simplified normalized summary.


## Definitions

- Canonical source: the source we trust first for a given field.
- Enrichment source: a secondary source that fills gaps without overriding a better source.
- Source-native storage: storing the raw disclosed structure as it appears in the upstream source.
- Normalized summary: a derived structure such as `equity / debt / cash / other` used for simpler portfolio summaries.


## Scope

- Define field-level source precedence rules.
- Define AMC support tiers and rollout order.
- Define how international FoFs should be handled.
- Define storage recommendations for raw source data and normalized summaries.
- Define validation rules for accepting source data.


## Out of Scope

- Implementing the new schema.
- Writing parsers.
- Migrating existing production-like data.
- Updating app screens.


## Approach

### 1. Source precedence by field

- Asset allocation:
  - official AMC / AMFI disclosure first
  - `mfdata` never canonical for this field
  - category rules only as estimated fallback
- Sector breakdown:
  - official source first
  - `mfdata` second if official source lacks sector data
  - no category-rule sector fabrication
- Holdings:
  - official source first for domestic funds when available
  - `mfdata` second for missing official coverage
  - international FoFs may use `mfdata` enrichment for underlying fund / ETF detail
- Fund metadata:
  - `mfdata /schemes/{scheme_code}` first for:
    - `risk_label`
    - `morningstar`
    - declared benchmark string
    - related variants
    - family linkage
- Variants / family linkage:
  - `mfdata` first

### 2. AMC support tiers

- Tier 1 — complete or nearly complete official coverage:
  - DSP domestic
  - HDFC
  - PPFAS
  - Motilal Oswal
  - Mirae Asset
  - likely ICICI Prudential
- Tier 2 — likely good official support, parser reconnaissance still required:
  - SBI
  - Nippon India
  - Kotak
  - Aditya Birla Sun Life
  - Axis
  - Tata
  - UTI
- Tier 3 — official support likely present but weaker or less uniform in this pass:
  - Bandhan
  - Edelweiss
  - Invesco
  - Franklin Templeton
- Tier 4 — special handling:
  - international FoFs across AMCs

### 3. International FoF strategy

- Treat official AMC disclosure as the preferred source for top-level structure.
- Preserve buckets such as:
  - global
  - Indian
  - underlying fund weights
  - TREPS
  - cash equivalents
  - REIT / InvIT
- Use `mfdata` only to add missing underlying fund or ETF detail.
- Do not force international FoFs through the same parsing assumptions used for domestic equity funds.

### 4. Storage strategy recommendation

Recommend a source-native model plus derived normalized summary.

Required capabilities:

- preserve raw source bucket names and values
- preserve source URL and disclosure date
- preserve sectors and holdings separately
- preserve debt holdings and other holdings
- expose a derived normalized summary for screens that need it

Do not recommend a flat normalized-only model because Stage 1 showed that it would lose important truth, especially for:

- PPFAS-style richer structures
- hybrid funds
- international FoFs

### 5. Parser rollout order

1. Metadata + family linkage:
   - extend the existing metadata sync design around `mfdata /schemes/{scheme_code}`
2. Tier 1 domestic AMCs:
   - DSP
   - HDFC
   - PPFAS
   - Motilal Oswal
   - Mirae Asset
   - ICICI Prudential
3. International FoF special case:
   - start with the held DSP FoFs
4. Tier 2 domestic AMCs
5. Tier 3 AMCs

### 6. Validation rules

- official asset-allocation rows may be accepted when:
  - source URL is captured
  - disclosure date is captured
  - raw totals are explainable from the source structure
- normalized summary may be accepted only when:
  - the mapping from raw source buckets to normalized buckets is clear
  - the normalized total is approximately `100`
- `mfdata` top-level holdings totals must not be treated as canonical allocation unless a future research pass shows a specific safe subset
- `mfdata /allocation` should not block ingestion if it returns `null`


## Alternatives Considered

- Flat normalized-only storage:
  - rejected because Stage 1 showed it would erase useful structure
- `mfdata` as primary composition source:
  - rejected because asset-allocation coverage and trustworthiness were weaker than official AMC disclosures
- official-only for every field:
  - rejected because `mfdata` still adds useful metadata and international FoF enrichment


## Milestones

### Milestone 1 — Lock source rules

Scope:
- confirm field-level precedence
- confirm AMC support tiers
- confirm international FoF handling

Expected outcome:
- no ambiguity remains about which source wins for each field

Acceptance criteria:
- a reviewer can answer asset-allocation, sector, holding, metadata, and variant precedence from this plan alone

### Milestone 2 — Finalize storage design

Scope:
- convert the source rules into a schema and ingestion design

Expected outcome:
- a future implementation plan can define schema changes without reopening source questions

Acceptance criteria:
- raw buckets, normalized summaries, sectors, holdings, and provenance are all accounted for

### Milestone 3 — Sequence rollout

Scope:
- define rollout order by AMC priority and parser complexity

Expected outcome:
- implementation can proceed incrementally with visible user value early

Acceptance criteria:
- the order favors held funds and Tier 1 AMCs first


## Validation

Before implementation begins, validate this plan against the Stage 1 report:

1. Every source precedence rule has at least one concrete Stage 1 example behind it.
2. Every Tier 1 AMC has at least one researched official-source example.
3. The international FoF strategy explicitly accounts for both official partial coverage and `mfdata` enrichment.


## Risks And Mitigations

- Risk: some AMCs may expose the data only through awkward PDFs or CSVs.
  Mitigation: support tiers allow parser rollout in priority order instead of assuming universal uniformity.
- Risk: normalized summaries may hide ambiguity.
  Mitigation: store raw source structure and provenance alongside normalized views.
- Risk: official sources may not always provide sectors or full holdings.
  Mitigation: allow field-level enrichment from `mfdata` rather than source-level winner-takes-all logic.


## Decision Log

- Decision: official AMC / AMFI first for asset allocation.
  Reason: Stage 1 evidence showed better coverage quality and more trustworthy structure.
- Decision: keep `mfdata` for metadata and selective enrichment.
  Reason: Stage 1 showed clear value in `risk_label`, `morningstar`, related variants, and some international FoF detail.
- Decision: recommend source-native storage plus normalized summary.
  Reason: Stage 1 showed that a flat model would throw away important information.


## Progress

- [ ] Review and approve the Stage 1 findings
- [ ] Lock source precedence rules
- [ ] Lock AMC support tiers
- [ ] Lock international FoF handling
- [ ] Convert this plan into a schema + ingestion implementation plan
