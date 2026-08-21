# Mémoire d'entreprise — design (validé le 21/08/2026)

> Demande Naoufel : « les RDV passés avec les comptes rendus, l'historique des modifs
> importantes de MEMOVIA, les concours où on a participé, les contacts qu'on a eus
> (Christelle, Paidea, TBS), ce qu'on devait / doit faire — organisé comme une vraie boîte. »
>
> Usage cible (arbitré) : mémoire interne équipe D'ABORD, mais dates sourcées partout pour
> pouvoir sortir un dossier propre (jury, banque, DD) plus tard. L'export lui-même n'est PAS
> dans le périmètre (YAGNI).

## Principes hérités (non négociables)

- Règles v2 (REFONT_PLAN.md fait foi) : un écran = système d'enregistrement ou d'action ;
  push d'abord (briefing = porte d'entrée) ; kill-counter `section_visits` sur toute page.
- **Les rituels manuels meurent** : tout ce qui peut être généré l'est ; la part humaine se
  réduit à un tri en un clic, jamais à de la rédaction.
- **Aucune preuve inventée** : le backfill vient de sources réelles (vault, git, mails,
  agenda), validé par Naoufel avant insertion. Pas de trace écrite = pas de CR reconstitué.
- CR de RDV toujours au neutre (zéro diarisation).

## A. Partenaires — onglet dans la section Leads

Constat : `leads` = pipeline CFA France ; Christelle (Compagnons), Paidea, TBS n'y ont pas
leur place mais ont besoin de la même fiche (historique RDV, engagements, notes).

- Migration : `leads_type_check` += `'partenaire'` ; `leads_status_check` += `'actif'`
  (le cycle nouveau→perdu n'a pas de sens pour un partenaire).
- UI Leads : deux onglets — **Prospection CFA** (défaut, comportement actuel strictement
  inchangé) et **Partenaires** (`type = 'partenaire'`). Même fiche ; les champs pipeline
  (maturité, relance) sont masqués pour un partenaire.
- Briefing : la requête « leads sans contact +7j » exclut `type = 'partenaire'`
  (Paidea est géré en low-touch : la relance automatique serait un mensonge de priorité).
- Le détecteur email (`email-lead-detector`) n'est PAS touché : il ne crée jamais de
  partenaire (types LLM : ecole/cfa/entreprise/autre).

## B. RDV historiques — zéro code

La section RDV (Phase 2 v2) couvre déjà le besoin : fiche datée, lien lead, CR au neutre.
Backfill uniquement : reconstruction de la liste des RDV passés (Compagnons et autres)
depuis vault/agenda/mails → **validation Naoufel** → insertion (`rdv.lead_id` vers la fiche
partenaire). Un RDV sans trace écrite est inséré SANS CR.

## C. Historique produit — page `/historique`

- Table `product_milestones` : `id`, `date` (date du jalon), `repo`, `title`, `detail`
  (nullable), `source_url` (lien PR, nullable, **unique** — clé de dédupe du cron),
  `status` (`candidat` | `retenu` | `ecarte`), `created_at`, `created_by`.
  RLS : lecture/écriture réservées aux membres dashboard (même pattern que les autres
  tables v2).
- Page `/historique` : timeline datée des « retenus » (titre, dépôt, lien PR) + bandeau
  « X candidats à trier » avec **retenir / écarter en un clic**. Entrée « Historique » en
  dernière position de la top-bar, `section_visits` comme les autres — le kill-counter
  s'applique.
- Alimentation : edge function `changelog-collect` + cron hebdo (lundi matin) — GitHub API
  avec un **token lecture seule** (secret à créer par Naoufel) sur les 5 dépôts, PRs mergées
  de la semaine → insert `candidat` (dédupe sur `source_url`).
- Briefing : ligne « 🗂 Historique : X candidats à trier » **seulement si X > 0**.
- Backfill : jalons majeurs proposés depuis git + handoffs + fiches capacités (couche DYS,
  multilingue, extraction vision, refonte v2…) → validation Naoufel → insertion en `retenu`.

## D. Engagements — tâches liées aux fiches

- Migration : `tasks.lead_id uuid null references leads(id)`.
- Fiche lead/partenaire : bloc « Engagements » = tâches liées ouvertes + historique `done` ;
  création rapide depuis la fiche (titre, assigné, échéance).
- Briefing tâches échues : suffixe « → <nom de la fiche> » quand la tâche est liée.
  (La relance existe déjà ; rien de nouveau à maintenir.)

## E. Concours passés — backfill + filtre

`financements` porte déjà gagne/perdu/abandonné. Backfill des concours passés (CRECE…)
validé par Naoufel. La section gagne un filtre « En cours / Historique », terminés
(gagne/perdu/abandonné) repliés par défaut : la vue courante reste actionnable, l'historique
reste à un clic.

## Hors périmètre (explicitement)

- Export PDF/dossier (les données restent structurées et datées pour le permettre plus tard).
- Import Google Calendar des RDV (déjà repoussé en v2 : « viendra si le besoin se prouve »).
- Toute section de nav supplémentaire au-delà de `/historique`.
- Modification du détecteur email et du pipeline prospection CFA.

## Chantier

- **PR code** : migration 00047 (A + C + D), onglets Leads, page `/historique`,
  `changelog-collect` + cron, retouches briefing (exclusion partenaires, suffixe fiche,
  ligne candidats). REFONT_PLAN.md mis à jour dans la même PR (il fait foi).
- **Backfill data** : passes séparées post-deploy (partenaires → RDV → jalons → concours),
  chacune validée avant insertion.
- Méthode habituelle : branche + PR, `deno check` + `npm run typecheck` comparés à main,
  confirmation avant commit/push/merge, deploys edge par Naoufel, migration via MCP après
  merge. Secret GitHub (token lecture seule) créé par Naoufel avant le deploy du cron.
