-- Hourly cron for portfolio composition sync.
--
-- sync-fund-portfolios is idempotent and internally skips funds whose AMFI
-- data is already fresh for the current month. The hourly cadence ensures:
--   1. A newly imported fund gets its composition data within the hour.
--   2. If any fund's data crosses the 35-day staleness threshold it is
--      re-synced automatically without waiting for a manual trigger.
--
-- Schedule: every hour at :10 past (avoids collision with NAV/index syncs
-- that run at :00 and :05).

SELECT cron.schedule(
  'sync-portfolio-composition-hourly',
  '10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/sync-fund-portfolios',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
