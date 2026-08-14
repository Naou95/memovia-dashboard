-- Migration 00035 : ajouter le header Authorization aux crons réparés en 00034.
--
-- POURQUOI : la 00034 a bien réparé les headers, l'URL et l'authentification applicative
-- (x-cron-secret), mais un appel réel rejoué le 14/08/2026 a renvoyé :
--   status_code 401, {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
-- Cette erreur ne vient PAS de la fonction : c'est la **passerelle** Supabase qui rejette la
-- requête avant qu'elle n'atteigne le code, parce que ces fonctions tournent en `verify_jwt = true`
-- (elles ne sont pas déclarées dans supabase/config.toml, et le défaut est `true`).
--
-- 🔑 La leçon : `x-cron-secret` seul ne peut pas suffire tant que la passerelle exige un JWT.
-- Vérifier une réparation de cron en lisant `cron.job_run_details` ne prouve rien non plus —
-- ce journal dit seulement que la commande SQL a tourné, pas que l'appel HTTP a abouti. La
-- preuve est dans `net._http_response.status_code`, et elle seule.
--
-- CORRECTIF : envoyer aussi `Authorization: Bearer <cle anon>` pour satisfaire la passerelle.
-- La clé anon est publique, elle n'apporte aucune sécurité en soi : c'est bien `x-cron-secret`
-- qui authentifie l'appelant côté fonction. Les deux couches se complètent, la passerelle
-- filtrant le tout-venant d'internet et le secret prouvant que l'appel vient bien du cron.
--
-- La clé anon est lue dans Vault, sous l'entrée historiquement **mal nommée** `service_role_key`
-- (elle contient la clé anon — vérifié en 00034, description corrigée là-bas). On évite ainsi
-- de la coder en dur comme le font les crons hérités.
--
-- Idempotente : rejouable sans effet de bord.

select cron.unschedule('telegram-daily-briefing')
where exists (select 1 from cron.job where jobname = 'telegram-daily-briefing');

select cron.schedule(
  'telegram-daily-briefing',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/telegram-daily-briefing',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

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
    timeout_milliseconds := 30000
  );
  $cron$
);

select cron.unschedule('telegram-weekly-report')
where exists (select 1 from cron.job where jobname = 'telegram-weekly-report');

select cron.schedule(
  'telegram-weekly-report',
  '0 6 * * 1',
  $cron$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/telegram-weekly-report',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
