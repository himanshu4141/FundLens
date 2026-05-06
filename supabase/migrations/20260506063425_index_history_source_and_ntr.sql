-- Phase 8 M1.1 — Total Return benchmark ingestion.
--
-- Adds two columns to index_history:
--   * source     — origin tag for each row ('nse' | 'eodhd' | 'yahoo' | 'unknown').
--                  Used by the daily sync to enforce a fixed priority
--                  (nse > eodhd > yahoo) so the canonical source always wins
--                  when multiple fetchers succeed for the same (symbol, date).
--                  Pre-existing rows default to 'unknown' since we don't know
--                  which fetcher historically supplied them — irrelevant
--                  going forward because PR series are no longer consumed.
--   * ntr_value  — Net Total Return value supplied by NSE alongside gross TRI.
--                  Persisted opportunistically; not consumed by UI yet.

ALTER TABLE index_history
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ntr_value numeric;

-- Index on source + symbol + date for fast diagnostic queries
-- ("how many rows came from each source"). The composite (symbol, date)
-- unique constraint already supports point lookups.
CREATE INDEX IF NOT EXISTS idx_index_history_source
  ON index_history (source, index_symbol);
