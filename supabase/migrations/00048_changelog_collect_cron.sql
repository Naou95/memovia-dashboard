-- Migration 00048 : cron hebdo changelog-collect (lundi 05:30 UTC, avant le briefing de
-- 06:00 : les candidats de la semaine apparaissent dans le briefing du lundi matin).
-- Même mécanisme que 00041 : secrets depuis Vault, réécriture idempotente du job.
-- ⚠️ Prérequis deploy : secret edge GITHUB_CHANGELOG_TOKEN (token GitHub fine-grained,
-- LECTURE SEULE, limité aux 5 dépôts MEMOVIA), posé par Naoufel via `supabase secrets set`.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'changelog-collect-weekly') then
    perform cron.unschedule('changelog-collect-weekly');
  end if;
end $$;

select cron.schedule(
  'changelog-collect-weekly',
  '30 5 * * 1',
  $$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/changelog-collect',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
