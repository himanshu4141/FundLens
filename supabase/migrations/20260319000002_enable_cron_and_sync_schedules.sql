-- Enable pg_cron and pg_net for scheduled edge function invocations.
-- sync-nav and sync-index are deployed with --no-verify-jwt so pg_net
-- can call them without needing to store a service role key in the DB.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Daily NAV sync: weekdays at 1:30 PM UTC (7 PM IST, after market close)
SELECT cron.schedule(
  'sync-nav-daily',
  '30 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/sync-nav',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Daily index sync: weekdays at 1:45 PM UTC (15 min after NAV sync)
SELECT cron.schedule(
  'sync-index-daily',
  '45 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/sync-index',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
