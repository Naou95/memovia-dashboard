-- Migration 00029: Reschedule email-lead-detector from hourly to daily at 23h UTC
-- Remplace le cron horaire (migration 00016) par une exécution quotidienne à 23h00 UTC.
-- La logique de la fonction email-lead-detector n'est pas modifiée.
--
-- PREREQUISITE (run once on the remote database if not already set):
--   ALTER DATABASE postgres SET "app.service_role_key" = '<your-service-role-key>';
--
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase).

-- Remove the previous hourly schedule (created in migration 00016)
SELECT cron.unschedule('email-lead-detector-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'email-lead-detector-hourly'
);

-- Also drop any previous daily schedule to make this migration idempotent
SELECT cron.unschedule('email-lead-detector-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'email-lead-detector-daily'
);

SELECT cron.schedule(
  'email-lead-detector-daily',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url        := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/email-lead-detector',
    headers    := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
                  ),
    body       := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
