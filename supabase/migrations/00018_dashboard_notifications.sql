-- Table des notifications du dashboard
create table if not exists public.dashboard_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('lead_stale', 'email_critical', 'new_lead', 'stripe_cancel')),
  title       text not null,
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index pour les requêtes fréquentes
create index if not exists dashboard_notifications_user_id_idx
  on public.dashboard_notifications(user_id, created_at desc);

create index if not exists dashboard_notifications_unread_idx
  on public.dashboard_notifications(user_id, read)
  where read = false;

-- RLS
alter table public.dashboard_notifications enable row level security;

create policy "Users can read their own notifications"
  on public.dashboard_notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.dashboard_notifications for update
  using (auth.uid() = user_id);

-- Edge Functions peuvent insérer (service role bypasse RLS)
create policy "Service role can insert notifications"
  on public.dashboard_notifications for insert
  with check (true);

-- Activer Realtime
alter publication supabase_realtime add table public.dashboard_notifications;
