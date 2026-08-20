-- Migration 00041 : allonger le timeout du cron `email-lead-detector-daily` pour la bascule NIM.
--
-- Contexte (20/08/2026) : le compte API Anthropic n'a plus de crédit (6× « credit balance too
-- low » au run du 19/08 23h00) → la fonction bascule sur NVIDIA NIM (deepseek-v4-flash, choisi
-- au banc). La file du tier gratuit NIM fait varier un appel de 4 à 94 s là où Claude tenait en
-- 2-5 s : le budget global de la fonction passe de 110 s à 350 s (sous le wall clock edge de
-- 400 s), et le `timeout_milliseconds` du cron doit suivre — règle posée par 00036 : un pg_net
-- qui abandonne avant que la fonction ait fini fait croire à un échec alors qu'elle travaille.
-- 380 s = budget fonction + marge de boot, sans atteindre le wall clock.
--
-- Même mécanisme que 00039 §2 : réécriture complète du job (aucun secret en clair dans la
-- commande, les headers sortent du Vault par sous-requête). Idempotent.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'email-lead-detector-daily') then
    perform cron.unschedule('email-lead-detector-daily');
  end if;
end $$;

select cron.schedule(
  'email-lead-detector-daily',
  '0 23 * * *',
  $$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/email-lead-detector',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 380000
  );
  $$
);
