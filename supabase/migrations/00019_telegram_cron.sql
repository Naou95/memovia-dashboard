-- Migration 00019: Telegram daily briefing via pg_cron
-- Sends a morning briefing to Naoufel at 8h00 UTC (= 10h Paris CEST / 9h CET)
-- Adjust the cron expression if you prefer a different time.
--
-- PREREQUISITE (run once on the remote database if not already set):
--   ALTER DATABASE postgres SET "app.service_role_key" = '<your-service-role-key>';
--
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase).

SELECT cron.schedule(
  'telegram-daily-briefing',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url        := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/telegram-daily-briefing',
    headers    := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
                  ),
    body       := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
