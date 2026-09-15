-- Campagnes de prospection (spec docs/superpowers/specs/2026-09-15-campagnes-design.md).
-- Les contacts d'une campagne sont les leads existants : aucune seconde liste.
-- Rien ne part sans validation humaine (campaign-send), la séquence s'arrête seule à la
-- première réponse détectée dans la boîte (campaign-tick).

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🎓',
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'archived')),
  sender_email text not null default 'emir@memovia.io',
  owner text check (owner in ('naoufel', 'emir')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('email', 'call', 'stop')),
  wait_days int not null default 0,
  name text not null,
  subject_template text,
  body_template text,
  ai_brief text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, position)
);

create table if not exists public.campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'stopped', 'done')),
  current_position int not null default 1,
  next_due_at timestamptz not null default now(),
  stop_reason text,
  thread_message_id text,
  thread_subject text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create table if not exists public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.campaign_enrollments(id) on delete cascade,
  step_id uuid not null references public.campaign_steps(id) on delete cascade,
  kind text not null check (kind in ('email', 'call')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'done', 'skipped')),
  subject text,
  body text,
  checks jsonb,
  context jsonb,
  due_at timestamptz not null default now(),
  sent_at timestamptz,
  message_id text,
  outcome text check (outcome is null or outcome in ('joint', 'pas_repondu', 'rappel', 'refus', 'interesse')),
  note text,
  error text,
  validated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_messages_enrollment_idx on public.campaign_messages(enrollment_id);
create index if not exists campaign_enrollments_campaign_idx on public.campaign_enrollments(campaign_id);

alter table public.campaigns enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.campaign_enrollments enable row level security;
alter table public.campaign_messages enable row level security;

-- Une seule policy admin par table (les policies permissives s'additionnent : ne pas élargir).
create policy campaigns_admin_all on public.campaigns
  for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
create policy campaign_steps_admin_all on public.campaign_steps
  for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
create policy campaign_enrollments_admin_all on public.campaign_enrollments
  for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
create policy campaign_messages_admin_all on public.campaign_messages
  for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));

revoke all on public.campaigns from anon;
revoke all on public.campaign_steps from anon;
revoke all on public.campaign_enrollments from anon;
revoke all on public.campaign_messages from anon;

-- Realtime : sans ça, postgres_changes écoute dans le vide (leçon roadmap_items).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'campaign_messages') then
    alter publication supabase_realtime add table public.campaign_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'campaign_enrollments') then
    alter publication supabase_realtime add table public.campaign_enrollments;
  end if;
end $$;

-- ── Seed : la campagne CFA, en brouillon, avec les textes validés (v9 du 01/09, v3 du 10/09) ──
do $$
declare v_id uuid;
begin
  if exists (select 1 from public.campaigns where name = 'CFA · référent handicap') then
    return;
  end if;
  insert into public.campaigns (name, emoji, status, sender_email, owner)
  values ('CFA · référent handicap', '🎓', 'draft', 'emir@memovia.io', 'emir')
  returning id into v_id;

  insert into public.campaign_steps (campaign_id, position, kind, wait_days, name, subject_template, body_template, ai_brief) values
  (v_id, 1, 'email', 0, 'Mail 1 · premier contact',
   '{{IA: objet de 40 à 60 caractères, concret, qui nomme les supports de cette cible (fiches techniques, schémas, cotes), jamais le mot MEMOVIA}}',
   'Bonjour {{civilité}} {{nom}},

{{IA: le problème de cette cible en une ou deux phrases, tiré de ses métiers dominants et de ses formations : des supports qui ne seront pas réécrits, des apprentis qui lisent mal sans que personne ne l''ait signalé. Jamais une leçon sur son métier.}}

Je suis Emir Boutaleb, j''ai monté MEMOVIA à Toulouse. Nous adaptons le contenu original des supports de cours aux profils neurodivergents, pour toute la classe, sans dossier et sans nommer personne. Le formateur dépose sa fiche telle quelle, même scannée, et la récupère lisible et écoutable, {{IA: ce qui est repris sans retouche selon le métier, trois mots : grammages et photos, cotes et schémas, dosages et températures}}. Le cours reste le sien, il ne réécrit rien.

Nous travaillons avec les Compagnons du Devoir depuis avril, sur leurs sites de Toulouse et Colomiers. Documents stockés en France, aucun fichier d''apprentis.

La licence est par établissement, jamais par apprenti, et son devis se joint au dossier RQTH que vous montez. Je vous donne le tarif dès que vous le demandez.

{{IA: une seule question, à effort nul : oui, un mot, un nom. Jamais un créneau, jamais une demande de support.}}

{{signature}}

{{rgpd}}',
   'Sous 170 mots hors signature et pied de page. Une seule question. Partir des métiers dominants et du nombre de formations de la fiche contact. Pour un réseau, parler du nombre de sites et proposer « un seul site volontaire, un an ». Vouvoiement, ton de fondateur, pas de jargon (référentiel, module, majoration).'),
  (v_id, 2, 'call', 4, 'Appel au standard', null, null,
   'Au standard : « Bonjour, je cherche à joindre le référent handicap du centre. » Par la fonction, jamais par le nom. 1. « Emir Boutaleb de MEMOVIA. Je vous ai écrit le [jour] au sujet des supports de cours adaptés. Vous avez eu le message ? » 2. Écouter, ne pas dérouler. 3. « Vous êtes sur une poignée de situations, ou plutôt sur plusieurs dizaines ? » 4. « Qui d''autre devrait être dans la boucle chez vous sur ce sujet ? »'),
  (v_id, 3, 'email', 6, 'Mail 2 · une idée neuve',
   'Re: {{objet_precedent}}',
   'Bonjour {{civilité}} {{nom}},

{{IA: une idée neuve pour cette cible, pas un rappel : le problème précis reformulé sous un angle qu''on n''a pas encore pris (les apprentis jamais repérés, un seul site volontaire pour un réseau, le formateur qui ne réécrit rien). Une ou deux phrases.}}

Chez MEMOVIA, à Toulouse, nous adaptons le contenu original des supports de cours aux profils neurodivergents, pour toute la classe, sans dossier et sans nommer personne. Le formateur dépose sa fiche telle quelle, même scannée, et la récupère lisible et écoutable, {{IA: ce qui est repris sans retouche selon le métier, trois mots}}. Le cours reste le sien, il ne réécrit rien. Nous travaillons avec les Compagnons du Devoir depuis avril, à Toulouse et Colomiers.

La licence est par établissement, jamais par apprenti, et son devis se joint au dossier RQTH que vous montez. Je vous donne le tarif dès que vous le demandez.

{{IA: une seule question, à effort nul, différente de celle du premier mail.}}

{{signature}}',
   'Sous 170 mots hors signature. Même fil que le premier mail. Jamais « je me permets de vous relancer », jamais un créneau, jamais une demande de support.'),
  (v_id, 4, 'call', 8, 'Rappel', null, null, 'Même script que l''appel au standard. Message vocal si absente.'),
  (v_id, 5, 'email', 12, 'Mail 3 · clôture',
   'Re: {{objet_precedent}}',
   'Bonjour {{civilité}} {{nom}},

Je cesse de chercher à vous joindre, c''est donc mon dernier message.

Vous conservez mes coordonnées si l''adaptation des supports redevient une priorité pour votre direction.

Si ces questions incombent à un autre membre de l''équipe, un simple nom me suffit pour m''adresser directement à cette personne.

Bonne continuation,
{{signature}}',
   'Ne rien ajouter : ce mail libère, il ne relance pas. Aucune zone IA.');
end $$;

-- ── Cron quotidien : détection des réponses, création des brouillons dus ──
do $$
begin
  if exists (select 1 from cron.job where jobname = 'campaign-tick-daily') then
    perform cron.unschedule('campaign-tick-daily');
  end if;
end $$;

select cron.schedule(
  'campaign-tick-daily',
  '0 5 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/campaign-tick',
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
