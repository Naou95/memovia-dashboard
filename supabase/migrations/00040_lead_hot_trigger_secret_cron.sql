-- Migration 00040 : basculer le trigger `on_lead_becomes_hot` sur le secret de cron, et poser
-- un timeout pg_net dessus.
--
-- 🔑 TROISIÈME VARIANTE DU MÊME BUG DE GUC, trouvée le 14/08/2026 en cherchant les appelants
-- légitimes de `lead-hot-trigger`. Et la plus discrète des trois, parce que le nom du GUC change :
--
--   00016 / 00019 / 00029  →  current_setting('app.service_role_key', true)
--   trigger_lead_hot_webhook →  current_setting('app.settings.service_role_key', true)
--                                            ^^^^^^^^^ un segment de plus
--
-- Chercher `app.service_role_key` ne fait donc PAS remonter celui-ci. Mesuré en base le 14/08 :
--   current_setting('app.settings.service_role_key', true) is null  → true
--   current_setting('app.service_role_key', true)          is null  → true
--   select count(*) from pg_settings where name like 'app.%'        → 0
-- La base ne déclare aucun GUC `app.*`. Les deux headers partaient donc nuls, et personne ne le
-- voyait puisque `lead-hot-trigger` ne lisait rien.
--
-- Même correctif que 00039 : `x-cron-secret` lu dans le Vault, vérifié côté fonction par
-- `verify_cron_secret` qui ne rend qu'un booléen. Un secret absent devient un 401 visible dans
-- `net._http_response` au lieu d'un 200 silencieux.
--
-- ⚠️ Ordre : cette migration suppose que 00034 a créé `dashboard_cron_secret`. La garde ci-dessous
-- le vérifie et échoue fort sinon, plutôt que d'installer un webhook mort-né (leçon de 00039 :
-- `jsonb_build_object('Authorization', 'Bearer ' || NULL)` rend `{"Authorization": null}` SANS
-- lever la moindre exception).

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'dashboard_cron_secret' and decrypted_secret is not null and decrypted_secret <> ''
  ) then
    raise exception 'Secret Vault « dashboard_cron_secret » absent ou vide. Appliquer 00034 d''abord.';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'service_role_key' and decrypted_secret is not null and decrypted_secret <> ''
  ) then
    raise exception 'Secret Vault « service_role_key » absent ou vide (contient la cle anon, cf. 00034).';
  end if;
end $$;

create or replace function public.trigger_lead_hot_webhook()
returns trigger
language plpgsql
security definer
as $function$
begin
  if OLD.maturity is distinct from NEW.maturity and NEW.maturity = 'chaud' then
    perform net.http_post(
      url := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/lead-hot-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
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
end;
$function$;

comment on function public.trigger_lead_hot_webhook is
  'Webhook quand un lead passe en maturite « chaud ». Authentifie par x-cron-secret (Vault), PAS par le GUC app.settings.service_role_key qui n''a jamais ete pose et rendait le header NULL. Corrige le 14/08/2026.';
