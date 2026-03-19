-- Ensure the user-selectable benchmark indexes are present in benchmark_mapping
-- so that sync-index fetches their historical data.
-- Nifty 50 (^NSEI) should already be there via fund benchmarks; these fill the gaps.
INSERT INTO benchmark_mapping (benchmark_index_symbol, benchmark_index)
VALUES
  ('^NSEBANK', 'Nifty Bank'),
  ('^BSESN',   'BSE Sensex'),
  ('^CNXIT',   'Nifty IT')
ON CONFLICT (benchmark_index_symbol) DO NOTHING;
