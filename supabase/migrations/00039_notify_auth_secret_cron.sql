-- Migration 00039 : authentifier les appelants de `notify-new-user` et `notify-new-email`,
-- et éliminer la cause racine que 00034 avait laissée en place.
--
-- TROUVÉ PAR REVUE ADVERSARIALE le 14/08/2026, et documenté comme reste ouvert dans le handoff
-- du même jour : « notify-new-user et notify-new-email ont EXACTEMENT le même trou que celui
-- refermé sur telegram-weekly-report ».
--
-- Les deux fonctions tournent en `verify_jwt = false` et ne lisaient RIEN de leur requête —
-- `notify-new-email` nommait littéralement la sienne `_req`. N'importe qui connaissant l'URL
-- pouvait pousser du texte arbitraire dans le Telegram de Naoufel, ouvrir une session IMAP sur
-- la boîte Hostinger toutes les 30 minutes, et — sur `notify-new-user` — se servir de la
-- comparaison 200 / 502 comme oracle d'énumération des comptes.
--
-- 🔑 CAUSE RACINE, côté base et pas côté fonction. Le trigger envoyait :
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
-- Ce GUC n'a JAMAIS été posé (documenté en commentaire dans 00016, 00019 et 00029 depuis avril,
-- jamais fait). Et en SQL, `'Bearer ' || NULL` vaut **NULL** : le header partait vide. Ça n'a
-- jamais gêné personne précisément parce que la fonction ne lisait rien. Refermer la fonction
-- SANS corriger le trigger aurait cassé la notification d'inscription — d'où cette migration.
--
-- Même mécanisme que 00034/00035, mêmes deux headers :
--   `x-cron-secret`  = ce qui authentifie réellement (comparé en base par verify_cron_secret,
--                      qui ne rend qu'un booléen — le secret ne sort jamais).
--   `Authorization`  = exigé par la passerelle Supabase quand `verify_jwt = true`. Ces deux
--                      fonctions-ci sont en `verify_jwt = false` et n'en ont donc pas besoin
--                      aujourd'hui, mais on le pose quand même : si quelqu'un bascule le drapeau
--                      un jour, ça continue de marcher au lieu de mourir en 401 silencieux.
--                      ⚠️ L'entrée Vault NOMMÉE `service_role_key` contient en réalité la clé
--                      anon (vérifié le 14/08, claim `role = "anon"`). C'est voulu ici : la clé
--                      anon est publique et n'apporte aucune sécurité — c'est `x-cron-secret`
--                      qui protège. Ne jamais mettre la vraie service_role dans un header de cron.
--
-- On en profite pour poser `timeout_milliseconds` sur l'appel du trigger : il était au défaut
-- pg_net de 5 s, le même angle mort que celui traité en 00038.

-- ── 1. Le trigger d'inscription ──────────────────────────────────────────────────────────────
create or replace function public.notify_new_user_telegram()
returns trigger
language plpgsql
security definer
as $function$
begin
  perform net.http_post(
    url := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/notify-new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'first_name', NEW.first_name,
        'plan', NEW.plan,
        'created_at', NEW.created_at
      )
    ),
    timeout_milliseconds := 30000
  );
  return NEW;
end;
$function$;

comment on function public.notify_new_user_telegram is
  'Notifie Telegram a chaque inscription. Authentifie par x-cron-secret (Vault), PAS par le GUC app.service_role_key qui n''a jamais ete pose et rendait le header NULL. Corrige le 14/08/2026.';

-- ── 2. Le cron de notification des mails (job `notify-new-email`, toutes les 30 min) ─────────
-- Réécriture complète plutôt que par regexp : contrairement aux crons de 00038, la commande de
-- celui-ci ne contient aucune clé en clair à préserver.
-- Idempotent : `unschedule` gardé par un `exists`, puis `schedule` réécrit la commande en entier.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'notify-new-email') then
    perform cron.unschedule('notify-new-email');
  end if;
end $$;

select cron.schedule(
  'notify-new-email',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/notify-new-email',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
