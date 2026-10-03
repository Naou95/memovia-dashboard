-- 00057 — Les policies de tasks et leads, telles qu'en production, ramenées dans le dépôt.
--
-- L'écart (constaté le 18/09/2026, en lisant pg_policies de la prod en lecture seule) :
--   * En production, lire, créer et modifier une tâche ou un prospect est réservé aux comptes du
--     dashboard (is_dashboard_admin), et une tâche privée n'est lue que par son auteur. Supprimer
--     reste réservé à admin_full.
--   * Ces policies ont été posées à la main en prod : aucune migration du dépôt ne les contient.
--     Les migrations 00006, 00007 et 00025 n'exigent qu'un compte connecté (auth.uid() is not null).
--   * Or la base est partagée avec l'application MEMOVIA (des centaines de comptes apprenants et
--     formateurs, tous 'authenticated'). Un schéma recréé depuis le dépôt (nouvel environnement,
--     reconstruction) ouvrirait donc les tâches et la liste des prospects à n'importe lequel d'entre
--     eux. Cette migration aligne le dépôt sur la prod pour que ça n'arrive pas.
--
-- Sur la prod, c'est un non-événement :
--   * les anciennes policies (noms des migrations 00006, 00007 et 00025) n'y existent plus, leur
--     « drop if exists » ne fait rien ;
--   * les policies de la prod y existent déjà sous ces noms, leur création est sautée.
--   Rien n'est supprimé ni recréé, aucun droit ne bouge.
--
-- Sur une base recréée depuis le dépôt, elle remplace les policies « compte connecté » par celles
-- de la prod : elle ne fait que restreindre, n'élargit aucun droit.
--
-- Garde par NOM : une policy qui porte déjà l'un de ces noms est laissée telle quelle, même si sa
-- définition diffère (c'est ce qui garantit le non-événement en prod). Les autres policies de ces
-- tables ne sont pas touchées (ex. "Dashboard admins delete own tasks", posée par 00056).
-- Rejouable. Un seul bloc do : il s'exécute d'un seul tenant, même joué hors transaction.

do $$
begin
  -- ── tasks ──────────────────────────────────────────────────────────────────────────────────────
  -- Les policies de la prod d'abord, les anciennes ensuite : la table n'est jamais sans policy.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'Dashboard admins view tasks') then
    -- Une tâche privée n'est lue que par son auteur (règle de 00025, gardée en prod).
    create policy "Dashboard admins view tasks" on public.tasks
      for select to authenticated
      using (public.is_dashboard_admin(auth.uid()) and ((is_private = false) or (created_by = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'Dashboard admins insert tasks') then
    create policy "Dashboard admins insert tasks" on public.tasks
      for insert to authenticated
      with check (public.is_dashboard_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'Dashboard admins update tasks') then
    create policy "Dashboard admins update tasks" on public.tasks
      for update to authenticated
      using (public.is_dashboard_admin(auth.uid()))
      with check (public.is_dashboard_admin(auth.uid()));
  end if;
  -- Déjà posée par 00007 sous ce nom, identique en prod (rôle public compris) : la garde la laisse.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'Admin full can delete tasks') then
    create policy "Admin full can delete tasks" on public.tasks
      for delete to public
      using (exists (select 1 from public.dashboard_profiles
                     where dashboard_profiles.id = auth.uid() and dashboard_profiles.role = 'admin_full'));
  end if;

  drop policy if exists "Authenticated users can view tasks" on public.tasks;
  drop policy if exists "Authenticated users can insert tasks" on public.tasks;
  drop policy if exists "Authenticated users can update tasks" on public.tasks;

  -- ── leads ──────────────────────────────────────────────────────────────────────────────────────
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'Dashboard admins view leads') then
    create policy "Dashboard admins view leads" on public.leads
      for select to authenticated
      using (public.is_dashboard_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'Dashboard admins insert leads') then
    create policy "Dashboard admins insert leads" on public.leads
      for insert to authenticated
      with check (public.is_dashboard_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'Dashboard admins update leads') then
    create policy "Dashboard admins update leads" on public.leads
      for update to authenticated
      using (public.is_dashboard_admin(auth.uid()))
      with check (public.is_dashboard_admin(auth.uid()));
  end if;
  -- Déjà posée par 00006 sous ce nom, identique en prod : la garde la laisse.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'Admin full can delete leads') then
    create policy "Admin full can delete leads" on public.leads
      for delete to public
      using (exists (select 1 from public.dashboard_profiles
                     where dashboard_profiles.id = auth.uid() and dashboard_profiles.role = 'admin_full'));
  end if;

  drop policy if exists "Authenticated users can view leads" on public.leads;
  drop policy if exists "Authenticated users can insert leads" on public.leads;
  drop policy if exists "Authenticated users can update leads" on public.leads;
end $$;
