-- Migration 00036 : donner à email-lead-detector le temps de finir.
--
-- Les 00034/00035 ont réparé l'authentification du cron, et c'est vérifié : l'appel atteint
-- désormais la fonction (plus de 401). Mais un cron qui s'authentifie et ne produit rien reste
-- mort. Mesuré le 14/08/2026, deux appels réels consécutifs (à froid puis à chaud) :
--   status_code 504, {"error":"global_timeout","partial":true}, et ZÉRO lead écrit en base.
--
-- Deux plafonds se coupaient l'herbe sous le pied :
--   1. le garde-fou interne de la fonction, GLOBAL_TIMEOUT_MS = 45 s (porté à 110 s) ;
--   2. le `timeout_milliseconds := 30000` posé par la 00034 — plus court encore que le
--      garde-fou interne, donc pg_net abandonnait avant même que la fonction ne renonce.
-- Le scan IMAP plus les analyses Claude (une par conversation, latence du modèle à chaque fois)
-- ne tiennent pas dans 45 s, encore moins dans 30.
--
-- Seul `email-lead-detector-daily` est concerné : les deux crons Telegram répondent en 200 bien
-- en dessous de 30 s (vérifié le 14/08 sur net._http_response).
--
-- Idempotente : rejouable sans effet de bord.

select cron.unschedule('email-lead-detector-daily')
where exists (select 1 from cron.job where jobname = 'email-lead-detector-daily');

select cron.schedule(
  'email-lead-detector-daily',
  '0 23 * * *',
  $cron$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/email-lead-detector',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cron$
);
