-- Migration 00046 : table de statut des runs du détecteur de leads.
--
-- Contexte (21/08/2026) : le briefing affichait « Leads : tous à jour ✓ » pendant que le
-- détecteur était mort (504 gateway du 20/08 23h UTC, 0 écriture) — sa ligne lisait la table
-- `leads`, jamais la santé du robot qui l'alimente. Et depuis le passage du détecteur en
-- 202 + tâche de fond, les stats de fin de run ne vivent que dans les logs ; un run coupé
-- par le budget (constaté au banc du 21/08 matin) n'en laisse aucune.
--
-- Le détecteur écrit ici lui-même : une ligne à l'ouverture du batch (outcome 'running'),
-- mise à jour à l'issue ('ok' | 'error' | 'global_timeout'). Un run tué par le wall clock
-- edge sans repasser par la mise à jour reste 'running' : un 'running' ancien = mort en vol,
-- et l'absence de ligne récente = le cron ne tire plus. Le briefing lit la dernière ligne :
-- les trois façons de mourir en silence deviennent visibles.
--
-- RLS activée sans policy : seules les fonctions edge (service role, qui la bypasse) lisent
-- et écrivent. Ajouter une policy de lecture dashboard_profiles le jour où l'UI l'affiche.

create table public.lead_detector_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'running'
    check (outcome in ('running', 'ok', 'error', 'global_timeout')),
  stats jsonb
);

alter table public.lead_detector_runs enable row level security;
