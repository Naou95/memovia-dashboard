-- Agenda de prospection (spec docs/superpowers/specs/2026-09-15-agenda-prospection-design.md,
-- plan docs/superpowers/plans/2026-09-17-agenda-prospection.md).
-- ADDITIF : aucune colonne retirée ni renommée, aucune donnée réécrite. Rejouable sans erreur.
-- La base est partagée avec l'app ; les tables touchées ici (lead_calls, tasks, rdv) sont celles du
-- dashboard. `tasks` a 7 autres écrivains/lecteurs (briefing, bot Telegram, MCP, lead-hot-trigger…) :
-- les colonnes ajoutées sont nullable ou ont un défaut, ils n'ont rien à changer.

-- ── 1. lead_calls : CR, lien vers l'étape de campagne, rappel promis ───────────────────────────
-- Table vide au 17/09/2026 (vérifié avant d'écrire cette migration) : rien à reprendre.
alter table public.lead_calls
  add column if not exists campaign_message_id uuid references public.campaign_messages(id) on delete set null,
  add column if not exists cr text,
  add column if not exists cr_data jsonb,
  add column if not exists objection text,
  add column if not exists callback_at timestamptz,
  add column if not exists debriefed_at timestamptz,
  add column if not exists debriefed_by uuid;

-- Un appel de campagne ne s'enregistre qu'une fois (deux onglets, double clic).
create unique index if not exists lead_calls_one_per_message
  on public.lead_calls (campaign_message_id) where campaign_message_id is not null;
create index if not exists lead_calls_lead_called_idx on public.lead_calls (lead_id, called_at desc);

-- Issues ÉLARGIES, pas remplacées : 'repondu' reste valide tant que l'ancien front tourne.
-- Le resserrage aux 5 issues se fera plus tard, après vérification qu'aucun 'repondu' n'existe.
alter table public.lead_calls drop constraint if exists lead_calls_outcome_check;
alter table public.lead_calls add constraint lead_calls_outcome_check
  check (outcome in ('repondu', 'pas_repondu', 'rappel', 'joint', 'refus', 'interesse'));

alter table public.lead_calls drop constraint if exists lead_calls_objection_check;
alter table public.lead_calls add constraint lead_calls_objection_check
  check (objection is null or objection in (
    'mauvais_interlocuteur', 'pas_de_budget', 'deja_equipe', 'pas_le_moment', 'pas_concerne', 'veut_de_la_doc', 'autre'
  ));

-- ── 2. tasks : créneau facultatif, durée, clé des tâches créées automatiquement ────────────────
alter table public.tasks
  add column if not exists scheduled_at timestamptz,
  add column if not exists duration_min int not null default 30,
  add column if not exists auto_key text;

alter table public.tasks drop constraint if exists tasks_duration_check;
alter table public.tasks add constraint tasks_duration_check check (duration_min between 5 and 480);

-- Une tâche automatique (prépa de RDV, CR manquant, revue du vendredi, suite d'un CR) n'existe
-- qu'une fois : le cron rejoué ne la recrée jamais, qu'elle soit ouverte ou terminée.
create unique index if not exists tasks_auto_key_unique on public.tasks (auto_key) where auto_key is not null;
create index if not exists tasks_open_due_idx on public.tasks (due_date) where status <> 'done';

-- ── 3. rdv : une durée pour le dessiner sur la grille ──────────────────────────────────────────
alter table public.rdv add column if not exists duration_min int not null default 45;
alter table public.rdv drop constraint if exists rdv_duration_check;
alter table public.rdv add constraint rdv_duration_check check (duration_min between 5 and 480);

-- ── 4. Séance d'appels déplacée ou annulée pour un jour donné ──────────────────────────────────
-- Sans ligne pour un jour : le créneau par défaut des réglages (agenda_call_window) s'applique.
create table if not exists public.agenda_sessions (
  day date primary key,
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  cancelled boolean not null default false,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (end_min > start_min)
);

-- ── 5. Le fil du débrief : une conversation par jour et par personne ───────────────────────────
-- created_by est NOT NULL avec auth.uid() pour défaut : auth.uid() est NULL pour un client
-- service_role. La fonction edge du débrief écrit donc avec le JETON DE L'UTILISATEUR (la RLS
-- joue) ; tout autre écrivain (script d'entretien) doit passer created_by explicitement.
create table if not exists public.debrief_messages (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  recap jsonb,
  applied_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists debrief_messages_day_idx on public.debrief_messages (created_by, day, created_at);

alter table public.agenda_sessions enable row level security;
alter table public.debrief_messages enable row level security;

-- Une seule policy admin par table (les policies permissives s'additionnent : ne pas élargir).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agenda_sessions' and policyname = 'agenda_sessions_admin_all') then
    create policy agenda_sessions_admin_all on public.agenda_sessions
      for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debrief_messages' and policyname = 'debrief_messages_admin_all') then
    create policy debrief_messages_admin_all on public.debrief_messages
      for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
  end if;
  -- Décision du 17/09/2026 : un membre du dashboard supprime SES tâches (avant, seul admin_full
  -- pouvait supprimer, et le bouton échouait en silence pour un admin_bizdev). La policy
  -- admin_full existante reste : elle continue de tout pouvoir supprimer.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tasks' and policyname = 'Dashboard admins delete own tasks') then
    create policy "Dashboard admins delete own tasks" on public.tasks
      for delete to authenticated
      using (public.is_dashboard_admin(auth.uid()) and created_by = auth.uid());
  end if;
end $$;

revoke all on public.agenda_sessions from anon;
revoke all on public.debrief_messages from anon;

-- ── 6. Réglages : squelette, modifiable dans l'UI ──────────────────────────────────────────────
-- days : 1 = lundi … 7 = dimanche (ISO). Les trois automatisations partent actives (décision du 17/09).
insert into public.dashboard_settings (key, value) values
  ('agenda_call_window', '{"days":[1,2,3,4],"start":"09:00","end":"11:30","slot_minutes":10}'),
  ('agenda_automations', '{"rdv_prep":true,"rdv_cr":true,"weekly_review":true}')
on conflict (key) do nothing;
