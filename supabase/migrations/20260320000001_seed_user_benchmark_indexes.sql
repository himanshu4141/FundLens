-- This migration was originally intended to seed user-selectable benchmark
-- indexes for sync-index. The original SQL used
--   ON CONFLICT (benchmark_index_symbol) DO NOTHING
-- but benchmark_mapping does not have a unique constraint on
-- benchmark_index_symbol, so fresh replays fail with SQLSTATE 42P10.
--
-- The follow-up migration 20260320000002_fix_user_benchmarks.sql contains the
-- correct idempotent implementation and also makes scheme_category nullable so
-- these rows can be inserted safely. Keep this historical version as an
-- explicit no-op so the migration chain remains stable and replayable.

DO $$
BEGIN
  NULL;
END
$$;
