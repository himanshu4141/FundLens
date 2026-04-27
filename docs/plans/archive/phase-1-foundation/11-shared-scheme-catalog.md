# Shared Scheme Catalog

## Goal

Split shared scheme metadata from user-owned holdings so deleting or re-importing a user no longer destroys globally useful fund information.


## User Value

- Fresh users can benefit from scheme metadata and portfolio-composition caches that were already fetched before.
- Re-import testing is safer because wiping one account no longer erases shared knowledge about the same schemes.
- Future data work can store family-level metadata from `mfdata.in` once per scheme instead of duplicating it for every user.


## Context

The original schema stored `scheme_name`, category, benchmark, ISIN, AUM, expense ratio, and related metadata directly on `fund`, even though `fund` is user-owned and cascades on `auth.users` delete. That caused two problems:

1. Shared metadata vanished when a user account was deleted.
2. Sync jobs had to deduplicate `scheme_code` values in application code because the database stored the same scheme many times.

This refactor introduces:

- `scheme_master` as the global source of truth keyed by `scheme_code`
- `user_fund` as the physical user-owned holdings table
- `fund` as a compatibility read view that preserves the old query shape for most app reads

This plan also captures additional `mfdata.in` fields we discussed but were not previously stored:

- `mfdata_family_id`
- `declared_benchmark_name`
- `risk_label`
- `morningstar_rating`
- `related_variants`
- `mfdata_meta_synced_at`


## Assumptions

- The linked Supabase project is still effectively pre-launch, so a schema refactor is acceptable.
- User-facing compatibility matters, but the internal schema can change materially.
- We want the smallest safe app change set, not a perfect end-state rename of every concept.


## Definitions

- Shared scheme metadata: information that is true for the scheme regardless of which user holds it.
- User-owned holding: the fact that one user currently tracks or holds one scheme.
- Compatibility view: a read-only database view that preserves an old table shape while the physical storage changes underneath.


## Scope

- Create a shared scheme catalog table.
- Move user-owned holdings into a dedicated physical table.
- Preserve existing read queries through a `fund` view.
- Update import and sync functions to write to the new storage model.
- Persist additional `mfdata.in` fields for future family-aware and richer fund-detail work.


## Out of Scope

- Rebuilding the portfolio composition model.
- Adding latest-NAV materialized tables or RPC helpers.
- Renaming the app’s `fund` concepts in every component or route.
- Shipping new UI for the newly stored `mfdata` fields.


## Approach

1. Rename the physical `fund` table to `user_fund`.
2. Create `scheme_master` keyed by `scheme_code`.
3. Backfill one shared scheme row from the existing per-user copies.
4. Drop duplicated metadata columns from `user_fund`.
5. Recreate `fund` as a read-only view that joins `user_fund` to `scheme_master`.
6. Update write paths:
   - CAS import upserts `scheme_master` first, then `user_fund`
   - metadata sync updates `scheme_master`
7. Keep existing read paths mostly unchanged by continuing to query `fund`.


## Alternatives Considered

- Keep `fund` as-is and only add `scheme_master` for optional caching:
  rejected because duplicated metadata and destructive cascades would remain.
- Rename `fund` everywhere in the app immediately:
  rejected because it creates extra churn without user-facing benefit.
- Skip the compatibility view and rewrite every reader to use joins right away:
  rejected because the view gives a smaller, safer refactor surface.


## Milestones

### Milestone 1 — Shared Catalog Migration

Scope:
- create `scheme_master`
- rename `fund` to `user_fund`
- create compatibility view

Expected outcome:
- shared scheme rows survive user deletion
- existing reads can still target `fund`

Acceptance criteria:
- linked DB applies the migration cleanly
- deleting one user no longer implies deleting shared scheme metadata

### Milestone 2 — Write Path Refactor

Scope:
- update CAS import
- update metadata sync

Expected outcome:
- new imports create or refresh shared scheme rows and user holdings separately
- `mfdata` future-use fields are stored in `scheme_master`

Acceptance criteria:
- import tests still pass
- metadata sync updates `scheme_master` instead of per-user copies

### Milestone 3 — Validation And Documentation

Scope:
- regenerate DB types
- run typecheck and lint
- update README and plan index

Expected outcome:
- repo state is reviewable and the architectural reason is documented

Acceptance criteria:
- `npm run typecheck` passes
- `npm run lint` passes
- README reflects the shared scheme catalog capability


## Validation

Run:

    supabase db push
    npm run gen:types
    npm run typecheck
    npm run lint
    supabase db reset

Expected checks:

- migration applies on the linked project
- generated types include `scheme_master`, `user_fund`, and the `fund` view
- the app compiles without query-shape regressions


## Risks And Mitigations

- View permissions or RLS surprises:
  validate read queries after the migration lands on the linked project.
- Metadata sync overwriting good data with partial `mfdata` responses:
  only update fields when fresh values are present.
- Future confusion between `fund`, `user_fund`, and `scheme_master`:
  preserve the compatibility view, document the intent, and keep write paths explicit.


## Decision Log

- Chose a compatibility view instead of a full client rewrite because the read surface is broad and mostly stable.
- Chose `scheme_code` as the shared key because every global cache already uses it.
- Captured `mfdata` family and rating fields now so future composition-family work does not require another schema pass first.


## Progress
- [x] Create a main-based branch and isolate the refactor in its own worktree
- [x] Design the shared `scheme_master` + `user_fund` storage model
- [x] Implement the migration and compatibility view
- [x] Update import and metadata sync write paths
- [x] Regenerate types and validate locally / against the linked project
- [x] Update README / plan index and capture any amendments


## Amendments

- The compatibility view preserved the old query surface, but Supabase generated nullable types for the `fund` view fields even when the underlying join guarantees presence for active rows. To keep the refactor low-churn without hand-editing generated types, the read hooks now use small query-shaped guards at each call site instead of a single shared `fund` row helper.
