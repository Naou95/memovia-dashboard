-- Table pour tracer les emails de rétention envoyés
create table if not exists public.retention_emails (
  id uuid primary key default gen_random_uuid(),
  subscriber_email text not null,
  sent_at timestamptz not null default now(),
  sent_from text not null,
  subject text not null
);

-- Index pour lookup rapide par subscriber_email
create index idx_retention_emails_subscriber on public.retention_emails (subscriber_email, sent_at desc);

-- RLS : seuls les utilisateurs authentifiés peuvent lire et écrire
alter table public.retention_emails enable row level security;

create policy "Authenticated users can read retention_emails"
  on public.retention_emails for select
  to authenticated
  using (true);

create policy "Authenticated users can insert retention_emails"
  on public.retention_emails for insert
  to authenticated
  with check (true);
