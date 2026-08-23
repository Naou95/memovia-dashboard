-- Document du rendez-vous (23/08/2026) : le support qu'on ouvre AVEC l'interlocuteur,
-- en markdown, lisible depuis n'importe quel écran. La source de vérité reste le vault ;
-- cette colonne en porte une copie pour que la fiche RDV se suffise à elle-même.
alter table public.rdv add column if not exists doc text;
alter table public.rdv add column if not exists doc_title text;
