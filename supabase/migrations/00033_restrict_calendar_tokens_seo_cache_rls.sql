-- 00033 — Sécurité (16/06/2026) : resserrer la RLS de calendar_tokens et seo_suggestions_cache.
--
-- Contexte : ces deux tables avaient des policies USING(true) ouvertes à TOUT rôle 'authenticated'.
-- Comme le SaaS app.memovia.io et ce dashboard partagent le même projet Supabase, n'importe quel
-- utilisateur connecté de l'app (role 'authenticated') pouvait lire/écrire ces tables — dont les
-- refresh_tokens OAuth Google/Microsoft en clair stockés dans calendar_tokens.
--
-- L'accès légitime à ces deux tables passe UNIQUEMENT par des Edge Functions en service_role
-- (get-calendar-events, create-google-meet, calendar-oauth-callback, calendar-disconnect,
-- seo-suggestions), qui bypassent la RLS. Restreindre côté anon/authenticated ne casse donc rien.
-- On aligne sur le pattern déjà utilisé par calendar_oauth_states : EXISTS(dashboard_profiles).
--
-- Idempotent : drop policy if exists -> create policy.

-- calendar_tokens ---------------------------------------------------------------
drop policy if exists "authenticated_can_read_calendar_tokens"   on public.calendar_tokens;
drop policy if exists "authenticated_can_upsert_calendar_tokens" on public.calendar_tokens;
drop policy if exists "authenticated_can_update_calendar_tokens" on public.calendar_tokens;
drop policy if exists "authenticated_can_delete_calendar_tokens" on public.calendar_tokens;
drop policy if exists "dashboard_admin_all" on public.calendar_tokens;

create policy "dashboard_admin_all" on public.calendar_tokens
  for all
  to authenticated
  using      (exists (select 1 from public.dashboard_profiles dp where dp.id = auth.uid()))
  with check (exists (select 1 from public.dashboard_profiles dp where dp.id = auth.uid()));

-- seo_suggestions_cache ---------------------------------------------------------
drop policy if exists "authenticated can manage seo_suggestions_cache" on public.seo_suggestions_cache;
drop policy if exists "dashboard_admin_all" on public.seo_suggestions_cache;

create policy "dashboard_admin_all" on public.seo_suggestions_cache
  for all
  to authenticated
  using      (exists (select 1 from public.dashboard_profiles dp where dp.id = auth.uid()))
  with check (exists (select 1 from public.dashboard_profiles dp where dp.id = auth.uid()));
