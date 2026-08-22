-- Accueil v2 (22/08/2026) : chaque lead porte son argumentaire.
-- `why`  = pourquoi cette école/ce partenaire (le fit avec le positionnement)
-- `pitch` = le pitch à dérouler, aligné POSITIONNEMENT.md (vault), interdits inclus.
alter table public.leads
  add column if not exists why text,
  add column if not exists pitch text;
