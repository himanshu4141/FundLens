-- Fix: benchmark_mapping.scheme_category was NOT NULL, so the
-- 20260320000001 migration that inserted user-selectable benchmarks
-- (^BSESN, ^NSEBANK, ^CNXIT) was silently rejected. Make it nullable
-- so that entries not tied to a SEBI fund category can be stored.
ALTER TABLE benchmark_mapping
  ALTER COLUMN scheme_category DROP NOT NULL;

-- Re-insert user-selectable benchmarks that were previously rejected.
-- Uses WHERE NOT EXISTS for idempotency (no unique constraint on the column
-- because multiple fund categories can share the same index symbol).
INSERT INTO benchmark_mapping (benchmark_index_symbol, benchmark_index)
SELECT v.symbol, v.index_name
FROM (VALUES
  ('^NSEBANK', 'Nifty Bank'),
  ('^BSESN',   'BSE Sensex'),
  ('^CNXIT',   'Nifty IT')
) AS v(symbol, index_name)
WHERE NOT EXISTS (
  SELECT 1 FROM benchmark_mapping WHERE benchmark_index_symbol = v.symbol
);

-- Add new BSE user-selectable benchmarks.
INSERT INTO benchmark_mapping (benchmark_index_symbol, benchmark_index)
SELECT v.symbol, v.index_name
FROM (VALUES
  ('^BSE100',    'BSE 100'),
  ('^BSE500',    'BSE 500'),
  ('^BSENEXT50', 'BSE SENSEX Next 50')
) AS v(symbol, index_name)
WHERE NOT EXISTS (
  SELECT 1 FROM benchmark_mapping WHERE benchmark_index_symbol = v.symbol
);
