-- Migration 00034 : réparer les deux crons morts depuis avril, et supprimer la cause racine.
--
-- ÉTAT CONSTATÉ EN PROD LE 14/08/2026 (cron.job_run_details, pas une supposition) :
--   telegram-daily-briefing    : 117 échecs, du 20/04 au 14/08. JAMAIS passé une seule fois.
--   email-lead-detector-daily  : 113 échecs, du 23/04 au 13/08. JAMAIS passé une seule fois.
--   telegram-weekly-report     : 16 succès — il ne doit sa survie qu'à verify_jwt = false.
-- Le vault (01-now) parlait de « 7 échecs sur 7 jours » : c'était un plancher, le vrai
-- chiffre est ~16 fois plus grand et ces crons n'ont jamais fonctionné.
--
-- QUATRE défauts empilés, tous vérifiés :
--   1. Le GUC `app.service_role_key` n'a JAMAIS été posé (`current_setting(...)` renvoie NULL).
--      Les migrations 00016, 00019 et 00029 le documentent en commentaire, personne ne l'a fait.
--   2. `telegram-daily-briefing` concatène ses headers en `text` au lieu de `jsonb` :
--      ERROR: function net.http_post(url => unknown, headers => text, body => unknown) does not exist
--   3. `email-lead-detector-daily` lit son URL dans `dashboard_settings` sous la clé
--      `supabase_function_url`, qui N'EXISTE PAS → url NULL :
--      ERROR: null value in column "url" of relation "http_request_queue" violates not-null constraint
--   4. 🔑 Le plus grave, jamais documenté : l'entrée Vault **nommée** `service_role_key`
--      contient en réalité la clé **anon** (claim `role` = "anon", vérifié le 14/08 sans
--      exposer la valeur). Poser le GUC avec cette entrée n'aurait donc RIEN réparé :
--      `telegram-daily-briefing` compare le token à SUPABASE_SERVICE_ROLE_KEY et aurait
--      répondu 401. Et `email-lead-detector` valide via `auth.getUser()`, qui attend un JWT
--      **utilisateur** : aucune clé de service ne peut passer cette porte, par construction.
--
-- CHOIX RETENU : un secret de cron dédié, au lieu de faire circuler la clé service_role.
--   - La clé service_role bypasse toute la RLS : la mettre dans un GUC de base la rendrait
--     lisible par `current_setting` depuis n'importe quelle session, y compris `authenticated`.
--     C'est précisément le pattern que Supabase déconseille aujourd'hui.
--   - Le secret ci-dessous est généré DANS la base (`gen_random_bytes`), stocké chiffré dans
--     Vault, et n'a qu'un seul pouvoir : déclencher ces deux fonctions. Rayon d'action minimal.
--   - Même convention que `activation-relance` côté dépôt `app` (header `x-cron-secret`).
--
-- Idempotente : rejouable sans effet de bord.

-- ── 1. Le secret de cron, généré en base (sa valeur n'a jamais transité hors de Postgres) ────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'dashboard_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'dashboard_cron_secret',
      'Authentifie les appels pg_cron -> edge functions du dashboard (header x-cron-secret). Genere en base le 14/08/2026, jamais affiche.'
    );
  end if;
end $$;

-- ── 2. Le piège qui a coûté 4 mois : une entrée Vault dont le NOM ment sur le contenu ────────
-- On ne renomme pas (rien ne la référence, mais un renommage casserait tout usage futur silencieux) :
-- on corrige la description pour que la prochaine personne ne retombe pas dedans.
-- ⚠️ `postgres` peut LIRE vault.secrets mais pas y écrire en direct (vérifié le 14/08 :
-- has_table_privilege UPDATE = false) : il faut impérativement passer par vault.update_secret,
-- un DML direct échoue en « permission denied for table secrets ».
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'service_role_key';
  if v_id is not null then
    perform vault.update_secret(
      v_id, null, null,
      'ATTENTION : contient la cle ANON, pas la cle service_role, malgre son nom (verifie le 14/08/2026). Ne pas utiliser pour authentifier un appel qui exige le service_role.'
    );
  end if;
end $$;

-- ── 3. Vérification du secret sans jamais le sortir de la base ───────────────────────────────
-- SECURITY DEFINER : l'edge function reçoit un booléen, jamais le secret. `search_path` vide
-- pour que la fonction ne puisse pas être détournée par un schéma injecté.
create or replace function public.verify_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'dashboard_cron_secret'
      and decrypted_secret = p_secret
  );
$$;

comment on function public.verify_cron_secret(text) is
  'Compare un x-cron-secret au secret Vault dashboard_cron_secret. Rend un booleen : le secret ne sort jamais de la base. Reserve au service_role.';

revoke all on function public.verify_cron_secret(text) from public;
revoke all on function public.verify_cron_secret(text) from anon;
revoke all on function public.verify_cron_secret(text) from authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- ── 4. Reprogrammation des deux crons morts ─────────────────────────────────────────────────
-- Différences avec l'existant : URL en dur (la clé `supabase_function_url` n'existe pas),
-- headers en `jsonb_build_object` (et non concaténés en text), auth par x-cron-secret lu
-- dans Vault (et non par un GUC absent), et un timeout explicite.

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
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

-- ── 5. telegram-weekly-report : même dépendance au GUC absent, aligné par cohérence ──────────
-- Il « passe » aujourd'hui uniquement parce que verify_jwt = false le laisse entrer avec un
-- header Authorization NULL. Le laisser tel quel, c'est garder une bombe à retardement : le
-- jour où verify_jwt repasse à true, il meurt en silence comme les deux autres.
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
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
