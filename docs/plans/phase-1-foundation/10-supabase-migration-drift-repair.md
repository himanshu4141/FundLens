# ExecPlan: Supabase Migration Drift Repair


## Status

Complete


## Goal

Repair the Supabase migration workflow so the repository is once again the source of truth for database shape and migration history.


## User Value

- A new developer or CI runner can rebuild the database from the checked-in migrations without hitting a broken historical step.
- Merges to `main` do not fail because the remote Supabase project recorded different migration version numbers than the repository.
- Future drift is caught automatically instead of surfacing later during deploys.


## Context

The linked Supabase project and the repository drifted in two ways:

1. The historical migration chain in `supabase/migrations/` no longer replays cleanly from scratch.
2. The remote migration ledger in `supabase_migrations.schema_migrations` contains three version numbers that do not match the filenames checked into git, even though the live schema already reflects the intended end state.

The specific replay failure happens in `supabase/migrations/20260320000001_seed_user_benchmark_indexes.sql`. That migration uses `ON CONFLICT (benchmark_index_symbol) DO NOTHING`, but `benchmark_mapping.benchmark_index_symbol` is not unique. The follow-up migration `20260320000002_fix_user_benchmarks.sql` already contains the correct idempotent inserts and the required `scheme_category` nullability change.


## Assumptions

- The linked Supabase project is still a test environment, not production.
- Preserving the current auth users and uploaded test data is useful, so the remote project should not be reset.
- Using `supabase migration repair` to reconcile remote migration history is acceptable because it changes only ledger metadata, not schema objects.


## Definitions

- Migration chain: the ordered SQL files in `supabase/migrations/`.
- Remote migration ledger: the rows in `supabase_migrations.schema_migrations` that tell Supabase which versions have already been applied.
- Replayable from scratch: `supabase db reset` can rebuild a fresh local database using only the committed migration files.
- Schema drift: the remote database shape differs from what the committed migrations would create.


## Scope

- Document the drift and the repair approach in this ExecPlan.
- Patch the broken historical migration so a fresh local rebuild succeeds.
- Add automation that validates:
  - local replay from scratch
  - remote migration version parity
  - remote schema parity before Supabase deploy jobs run on `main`
- Update repo documentation to describe the new Supabase validation behavior.
- Produce the one-time `supabase migration repair` commands needed to reconcile the linked remote project.


## Out of Scope

- Resetting the remote Supabase project.
- Squashing the entire migration history into a new baseline.
- Reworking the product schema beyond what is needed to restore deterministic migration behavior.


## Approach

1. Replace the body of `20260320000001_seed_user_benchmark_indexes.sql` with an explicit no-op and a clear comment explaining that the migration was superseded by `20260320000002_fix_user_benchmarks.sql`.
2. Keep all existing migration filenames in git. The repository becomes the canonical version list.
3. Add a small repository script that runs `supabase migration list --linked` and fails when local-only or remote-only versions are present.
4. Add a pull-request workflow that runs `supabase db reset` and `supabase db lint --local --fail-on error --schema public` whenever migrations change.
5. Update the existing `supabase-deploy.yml` workflow so deploy jobs wait for a validation job that:
   - replays the local migrations
   - links the remote project
   - checks migration parity
   - runs `supabase db diff --linked --schema public` and fails if SQL drift is generated
6. After the repo-side changes validate locally, repair the linked remote migration ledger so its version numbers match the checked-in filenames.


## Alternatives Considered

- Full remote reset: rejected because it would unnecessarily destroy auth users and test data.
- Squash migrations into a new baseline: rejected because the drift is concentrated in one broken historical migration plus three mismatched remote version IDs.
- Renaming local migrations to the remote version numbers: rejected because it preserves the accidental remote history instead of restoring the repository as the source of truth.


## Milestones

### Milestone 1 — Make the migration chain replayable

Scope:
- Patch the broken historical migration without changing the intended final schema.

Expected outcome:
- `supabase db reset` succeeds from a clean local database.

Commands:

    supabase db reset

Acceptance criteria:
- No migration step fails during reset.
- The final local schema still contains the expected benchmark mapping rows via `20260320000002_fix_user_benchmarks.sql`.

### Milestone 2 — Add validation guardrails

Scope:
- Add repository automation for local replay validation and remote parity checks.

Expected outcome:
- Pull requests that touch migrations fail fast when the chain no longer replays.
- Pushes to `main` fail before Supabase deployment if migration or schema drift exists.

Commands:

    python3 scripts/check_supabase_migration_parity.py
    supabase db diff --linked --schema public

Acceptance criteria:
- The parity script exits non-zero when local and remote migration versions differ.
- The deploy workflow gates the deploy jobs on the validation job.

### Milestone 3 — Repair the linked remote ledger

Scope:
- Reconcile the linked Supabase project’s recorded migration versions with the repository.

Expected outcome:
- `supabase migration list --linked` shows matching local and remote versions.

Commands:

    supabase migration repair 20260329003750 20260419175653 20260419175702 --status reverted
    supabase migration repair 20260329000000 20260420000000 20260420000001 --status applied

Acceptance criteria:
- The remote ledger contains the repository’s version numbers for `fund_meta_columns`, `portfolio_insights_schema`, and `portfolio_insights_cron`.
- `supabase db push --dry-run` reports that the remote database is up to date.


## Validation

    supabase db reset
    supabase db lint --local --fail-on error --schema public
    python3 scripts/check_supabase_migration_parity.py
    supabase db diff --linked --schema public
    supabase migration list --linked
    supabase db push --dry-run
    npm run typecheck
    npm run lint

Expected results:
- Local reset and local lint both succeed.
- The parity script reports no local-only or remote-only migrations after the one-time repair.
- The linked diff does not emit schema SQL.
- Typecheck and lint pass with zero issues.


## Risks And Mitigations

- Risk: rewriting a historical migration could hide why the original step failed.
  Mitigation: leave a detailed comment in the file pointing to the superseding migration.
- Risk: `supabase db diff --linked` requires Docker and a shadow database.
  Mitigation: keep the validation job on GitHub-hosted Linux runners where Docker is available.
- Risk: remote ledger repair could be applied to the wrong project.
  Mitigation: run the repair only after `supabase link --project-ref ...` and verify `supabase migration list --linked` before and after.


## Decision Log

- Decision: repair the remote ledger instead of resetting the remote database.
  Reason: the linked project is still useful for login and CAS upload testing, and ledger repair is enough to restore deterministic deploy behavior.
- Decision: preserve repository filenames and treat them as canonical.
  Reason: future contributors should reason from git, not from one-off remote timestamps.
- Decision: validate both replayability and linked parity in CI.
  Reason: replay catches broken historical migrations; parity catches linked-project drift that would otherwise surface during deploy.
- Decision: use a dedicated pull-request validation workflow plus a validation gate inside `supabase-deploy.yml`.
  Reason: pull requests get fast feedback before merge, while merges to `main` still block deploy work on linked-project drift.


## Amendments

- The final implementation kept the existing deploy workflow and added one dedicated pull-request validation workflow instead of creating a single all-purpose workflow. This preserves the existing deploy triggers while still gating deploys on migration validation.


## Progress

- [x] Write this ExecPlan and keep it updated during implementation
- [x] Patch `20260320000001_seed_user_benchmark_indexes.sql` to a documented no-op
- [x] Add reusable migration parity checker
- [x] Add pull-request Supabase validation workflow
- [x] Gate `supabase-deploy.yml` on migration validation
- [x] Update README CI/CD documentation
- [x] Run local validation commands
- [x] Repair the linked remote migration ledger
- [x] Verify local and remote migrations are fully aligned
