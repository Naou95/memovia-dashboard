/**
 * Une base Postgres en mémoire (PGlite) avec le schéma du dashboard, rejoué depuis les migrations du
 * dépôt. Sert à tester le SQL (fonctions, contraintes, RLS) sans jamais toucher la base partagée :
 * la base Supabase du projet est celle de la prod, commune avec l'application.
 *
 * Ce qui est propre à Supabase est remplacé par des substituts minimaux : auth.uid() lit un réglage
 * de session (voir asUser), pg_cron / Vault / pg_net / Storage sont des coquilles, et les tables de
 * l'application lues par des vues du dashboard (profiles, organizations) existent, vides.
 *
 * Limite connue : les policies de `tasks` et `leads` en place en prod ne sont pas dans les migrations
 * (écart relevé le 18/09/2026). Ici, ce sont donc celles des migrations, plus larges.
 */
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = import.meta.glob('../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supabase_auth_admin nologin; create role authenticator nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create schema extensions;
create function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$
  select substring(decode(md5(random()::text) || md5(random()::text) || md5(random()::text) || md5(random()::text), 'hex') from 1 for n) $$;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(p_name text) returns boolean language sql as $$ delete from cron.job where jobname = p_name returning true $$;
create function cron.alter_job(job_id bigint, schedule text default null, command text default null, database text default null,
  username text default null, active boolean default null) returns void language sql as $$
  update cron.job set command = coalesce(alter_job.command, cron.job.command) where jobid = alter_job.job_id $$;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description from vault.secrets;
create function vault.create_secret(p_secret text, p_name text default null, p_description text default null) returns uuid language sql as $$
  insert into vault.secrets (secret, name, description) values (p_secret, p_name, p_description) returning id $$;
create function vault.update_secret(p_id uuid, p_secret text default null, p_name text default null, p_description text default null) returns void language sql as $$
  update vault.secrets set secret = coalesce(p_secret, secret), name = coalesce(p_name, name), description = coalesce(p_description, description) where id = p_id $$;
insert into vault.secrets (name, secret) values ('service_role_key', 'fausse-cle-locale');
create schema net;
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000) returns bigint language sql as $$ select 1::bigint $$;
create function net.http_get(url text, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000) returns bigint language sql as $$ select 1::bigint $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
-- Supabase donne ces droits d'office : sans eux, auth.uid() échoue et toute policy paraîtrait fausse.
grant usage on schema auth to authenticated, anon, service_role;
grant execute on all functions in schema auth to authenticated, anon, service_role;
create table public.organizations (id uuid primary key default gen_random_uuid(), name text);
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid, first_name text, last_name text, plan text,
  account_type text, subscription_status text, subscription_price_family text, organization_id uuid, created_at timestamptz default now());
`

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Les migrations du dépôt, dans l'ordre d'application (ordre des noms de fichiers). */
export function migrations(): { name: string; sql: string }[] {
  return Object.entries(MIGRATIONS)
    .map(([file, sql]) => ({ name: file.split('/').pop() ?? file, sql }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Les extensions n'existent pas ici : on retire leurs déclarations, le reste du fichier passe. */
const adapt = (sql: string) => sql.replace(/create\s+extension[^;]*;/gi, '-- (extension retirée pour PGlite)')

export interface LocalDb {
  db: PGlite
  /** Migrations en échec (nom : message). Vide quand le schéma est complet. */
  failures: string[]
}

/** Une base neuve, migrations appliquées jusqu'à `upTo` inclus (nom de fichier), puis `extraSql`. */
export async function createLocalDb({ upTo = '99999', extraSql = [] as string[] } = {}): Promise<LocalDb> {
  const db = new PGlite()
  await db.exec(STUBS)
  const failures: string[] = []
  for (const m of migrations().filter((x) => x.name <= upTo)) {
    try {
      // Les comptes cités par une migration (profils du dashboard) doivent exister dans auth.users.
      for (const id of new Set(m.sql.match(UUID) ?? [])) await db.query('insert into auth.users (id) values ($1) on conflict do nothing', [id])
      await db.exec(adapt(m.sql))
    } catch (e) {
      failures.push(`${m.name} : ${(e as Error).message.split('\n')[0]}`)
    }
  }
  for (const sql of extraSql) await db.exec(sql)
  // Comme sur Supabase : le rôle authenticated a les droits de table, la RLS décide du reste.
  await db.exec(`grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;`)
  return { db, failures }
}

/** Agit comme un compte connecté : rôle authenticated (RLS active), auth.uid() = userId. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('userId invalide')
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

/** Comptes fictifs : Emir (admin_bizdev), Naoufel (admin_full), et un compte de l'application hors dashboard. */
export const USERS = {
  emir: '11111111-1111-4111-8111-111111111111',
  naoufel: '22222222-2222-4222-8222-222222222222',
  app: '33333333-3333-4333-8333-333333333333',
} as const

export async function seedUsers(db: PGlite): Promise<void> {
  await db.exec(`
    insert into auth.users (id) values ('${USERS.emir}'), ('${USERS.naoufel}'), ('${USERS.app}') on conflict do nothing;
    insert into public.dashboard_profiles (id, email, full_name, role) values
      ('${USERS.emir}', 'emir@exemple.test', 'Emir Test', 'admin_bizdev'),
      ('${USERS.naoufel}', 'naoufel@exemple.test', 'Naoufel Test', 'admin_full')
    on conflict (id) do update set role = excluded.role;
  `)
}

/** Lignes rendues, sinon lignes touchées. Attention : PGlite met affectedRows à 0 sur un SELECT. */
export const rowsOf = (r: { affectedRows?: number; rows: unknown[] }) => (r.rows?.length ?? 0) || (r.affectedRows ?? 0)
