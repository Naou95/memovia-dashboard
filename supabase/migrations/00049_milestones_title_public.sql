-- Migration 00049 : titre en clair pour l'historique produit (retour Naoufel du 21/08 :
-- « plus user friendly pour nous qu'on est pas tech »). Les titres de PRs restent la
-- source (title) ; title_public porte la phrase compréhensible par un non-technicien,
-- générée par Gemini dans changelog-collect (rattrapage automatique des lignes NULL à
-- chaque run) et RELUE/éditable au moment du tri. NULL = le front affiche le titre
-- technique nettoyé de son préfixe.

ALTER TABLE public.product_milestones ADD COLUMN title_public text;
