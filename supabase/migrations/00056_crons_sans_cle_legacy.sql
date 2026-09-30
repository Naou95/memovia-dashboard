-- Migration 00056 : bascule des clés Supabase, étape 3. Les crons et les déclencheurs n'envoient plus
-- la clé legacy.
--
-- POURQUOI : 9 crons et 3 déclencheurs envoyaient `Authorization: Bearer <entrée Vault service_role_key>`.
-- Cette entrée contient la clé anon LEGACY (JWT), qui cessera de marcher quand les clés legacy seront
-- désactivées (étape 5 du plan `03-memovia/securite/plan-bascule-cles-supabase-2026-09-29.md`).
-- L'en-tête ne sert plus à rien : depuis le 29/09 les 12 fonctions visées sont figées en verify_jwt=false
-- (config.toml des deux dépôts) et s'authentifient par `x-cron-secret` (cronAuth.ts / internalAuth.ts),
-- sauf send-feedback-confirmation qui ne contrôle aucune clé (elle relit le feedback en base). Le garder
-- aurait fait échouer ces appels après l'étape 5, ou envoyé un en-tête nul si l'entrée Vault disparaissait.
--
-- 🔴 Les déclencheurs d'inscription (profiles) et de lead chaud (leads) n'avaient pas de bloc EXCEPTION :
-- une erreur dans leur appel bloquait l'inscription ou la mise à jour du lead. Ils l'ont désormais,
-- comme notify_feedback_confirmation. `search_path` vide : ce sont des SECURITY DEFINER, et tout ce
-- qu'ils appellent est qualifié (net.*, vault.*).
--
-- Idempotente. Sur une base neuve, les crons absents sont ignorés (`from cron.job where …`).

-- ── 1. Les crons : retirer la ligne Authorization, rien d'autre ─────────────────────────────────
select cron.alter_job(
  jobid,
  command := regexp_replace(
    command,
    '\n[ \t]*''Authorization'', ''Bearer '' \|\| \(select decrypted_secret from vault\.decrypted_secrets where name = ''service_role_key''\),',
    ''
  )
) from cron.job where command like '%service_role_key%';

-- ── 2. Inscription → Telegram ───────────────────────────────────────────────────────────────────
create or replace function public.notify_new_user_telegram()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform net.http_post(
    url := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/notify-new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
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
exception when others then
  -- Une notification ratée ne doit jamais bloquer une inscription.
  raise log 'notify_new_user_telegram ERROR: %', sqlerrm;
  return NEW;
end;
$function$;

-- ── 3. Lead passé « chaud » → tâche de relance ──────────────────────────────────────────────────
create or replace function public.trigger_lead_hot_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if OLD.maturity is distinct from NEW.maturity and NEW.maturity = 'chaud' then
    perform net.http_post(
      url := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/lead-hot-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'leads',
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      ),
      timeout_milliseconds := 30000
    );
  end if;
  return NEW;
exception when others then
  -- Un webhook raté ne doit jamais bloquer la mise à jour d'un lead.
  raise log 'trigger_lead_hot_webhook ERROR: %', sqlerrm;
  return NEW;
end;
$function$;

-- ── 4. Feedback → mail de confirmation ──────────────────────────────────────────────────────────
-- N'appelait QUE si l'entrée Vault `service_role_key` était remplie, sinon RAISE LOG silencieux : la
-- supprimer aurait coupé la confirmation sans bruit. La fonction ne lit que `feedback_id` et relit le
-- reste en base : le message de l'utilisateur ne transite plus par les tables de pg_net.
create or replace function public.notify_feedback_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if NEW.user_id is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/send-feedback-confirmation',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('feedback_id', NEW.id),
    timeout_milliseconds := 30000
  );
  return NEW;
exception when others then
  raise log 'notify_feedback_confirmation ERROR: %', sqlerrm;
  return NEW;
end;
$function$;

-- ── 5. L'entrée Vault n'a plus de lecteur : elle part ───────────────────────────────────────────
-- Garde : échoue fort si un cron ou une fonction la lit encore (regexp du point 1 qui n'aurait pas
-- pris, lecteur ajouté entre-temps). Tout est annulé dans ce cas.
do $$
begin
  if exists (select 1 from cron.job where command like '%service_role_key%') then
    raise exception 'Un cron lit encore l''entree Vault service_role_key : rien n''est applique.';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema') and p.prosrc like '%service_role_key%'
  ) then
    raise exception 'Une fonction SQL lit encore l''entree Vault service_role_key : rien n''est applique.';
  end if;
end $$;

delete from vault.secrets where name = 'service_role_key';

-- Vérification (doit rendre 0, 0, 0) :
-- select count(*) from cron.job where command like '%Authorization%';
-- select count(*) from pg_proc where prosrc like '%service_role_key%';
-- select count(*) from vault.secrets where name = 'service_role_key';
