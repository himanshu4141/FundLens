-- Update sync schedules from daily-only to hourly on weekdays.
-- Running hourly means a single failed run won't block the day's data;
-- sync functions are idempotent (upsert), so re-runs are safe.

SELECT cron.unschedule('sync-nav-daily');
SELECT cron.unschedule('sync-index-daily');

-- Hourly NAV sync: every hour on weekdays
SELECT cron.schedule(
  'sync-nav-hourly',
  '0 * * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/sync-nav',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Hourly index sync: 5 min after NAV sync each hour on weekdays
SELECT cron.schedule(
  'sync-index-hourly',
  '5 * * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/sync-index',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
