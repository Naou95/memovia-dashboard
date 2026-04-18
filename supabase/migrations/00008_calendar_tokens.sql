-- Migration 8 : Tokens OAuth pour le module Calendrier
-- Stocke les access_token / refresh_token pour Google Calendar (Naoufel) et Microsoft Graph (Emir)
-- L'Edge Function lit/écrit cette table pour auto-refresh des tokens expirés.

create table if not exists calendar_tokens (
  id           uuid        primary key default gen_random_uuid(),
  owner        text        not null check (owner in ('naoufel', 'emir')),
  provider     text        not null check (provider in ('google', 'microsoft')),
  access_token text        not null,
  refresh_token text,
  expires_at   timestamptz not null,
  scope        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),

  constraint calendar_tokens_owner_provider_key unique (owner, provider)
);

-- Trigger updated_at automatique
create or replace function update_calendar_tokens_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger calendar_tokens_updated_at
  before update on calendar_tokens
  for each row execute function update_calendar_tokens_updated_at();

-- RLS : seuls les utilisateurs authentifiés du dashboard peuvent accéder
alter table calendar_tokens enable row level security;

create policy "authenticated_can_read_calendar_tokens"
  on calendar_tokens for select
  to authenticated
  using (true);

create policy "authenticated_can_upsert_calendar_tokens"
  on calendar_tokens for insert
  to authenticated
  with check (true);

create policy "authenticated_can_update_calendar_tokens"
  on calendar_tokens for update
  to authenticated
  using (true);

create policy "authenticated_can_delete_calendar_tokens"
  on calendar_tokens for delete
  to authenticated
  using (true);

-- Table temporaire pour les états OAuth (CSRF protection)
create table if not exists calendar_oauth_states (
  state      text        primary key,
  provider   text        not null check (provider in ('google', 'microsoft')),
  owner      text        not null check (owner in ('naoufel', 'emir')),
  created_at timestamptz default now()
);

-- Nettoyage automatique des états OAuth expirés (>15 min)
create or replace function cleanup_oauth_states()
returns void language plpgsql as $$
begin
  delete from calendar_oauth_states where created_at < now() - interval '15 minutes';
end;
$$;

comment on table calendar_tokens is 'Tokens OAuth Google/Microsoft pour le module Calendrier. Auto-refreshés par les Edge Functions.';
comment on table calendar_oauth_states is 'États CSRF temporaires pour le flow OAuth calendrier. TTL 15 min.';
