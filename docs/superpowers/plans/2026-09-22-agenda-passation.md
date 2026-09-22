# Agenda de prospection — passation à Naoufel (22/09/2026)

Le chantier a été mené sur la machine d'Emir, **en local uniquement** : rien n'a été poussé, aucune
migration n'a été appliquée, aucune fonction edge n'a été déployée. Les PR 0 à 5 du plan
`2026-09-17-agenda-prospection.md` sont écrites et testées ; les PR 6 à 9 restent à faire. Le plan fait
foi, cette note dit où en est le code et dans quel ordre le mettre en ligne.

## 1. Ce qui existe, dans l'ordre

Pile linéaire de 7 branches (chacune = 1 commit, chacune basée sur la précédente), plus une branche
indépendante partie de `main` :

| # | Branche | Ce que ça fait |
|---|---------|----------------|
| 0 | `docs/agenda-spec` | Spec, maquette HTML, plan détaillé (PR 0 à 9). |
| 1 | `fix/detecteur-ne-plus-ecraser` | `email-lead-detector` complète un lead existant au lieu de l'écraser (fusion de timeline, statut jamais en arrière). |
| 2 | `feat/agenda-schema` | **Migration 00056** (additive, rejouable) : colonnes d'appel (CR, rappel, lien vers l'étape), `tasks.scheduled_at/duration_min/auto_key`, `rdv.duration_min`, tables `agenda_sessions` et `debrief_messages`, policies. |
| 3 | `feat/issues-appel-5` | Cinq issues d'appel partout (joint, pas répondu, rappel, refus, intéressé) ; l'historique ne les écrase plus. |
| 4 | `feat/agenda-lecture` | Route `/agenda` en **lecture seule**, hors navigation : qui appeler, pourquoi, la séance du jour, la semaine. |
| 5 | `feat/agenda-ecriture` | L'agenda en écriture : tâches (créer, modifier, cocher, glisser), RDV et séance déplaçables, issue d'appel depuis la fiche, prochaine relance, lien depuis la Revue. Relu par un agent : 4 points importants corrigés. |
| 5 bis | `feat/agenda-debrief` | Socle de la PR 6 : **banc de test SQL local** (PGlite) qui rejoue les migrations en mémoire et teste la RLS. Aucune fonctionnalité. |
| — | `fix/policies-prod-dans-le-depot` | Indépendante (part de `main`) : **migration 00057**, voir §4. |

## 2. Ordre de mise en ligne — le point d'arrêt à ne pas rater

1. Fusionner les PR 0, 1 et 2 (docs, détecteur, **migration 00056**).
2. **Appliquer la migration 00056** sur `mzjzwffpqubpruyaaxew`, puis faire relire le schéma à PostgREST
   (`notify pgrst, 'reload schema'`) s'il ne voit pas les nouvelles colonnes.
3. Seulement ensuite, fusionner les PR 3, 4 et 5. Avant l'application, la base refuse les issues
   Joint / Refus / Intéressé et l'agenda ne peut pas lire ses colonnes (il le dit à l'écran).
4. La PR 1 touche deux fonctions edge à déployer **sans** `--no-verify-jwt` :
   `email-lead-detector` et `telegram-daily-briefing`.
5. `/agenda` reste hors du menu jusqu'à la PR 9 : seul le lien de la fiche d'appel de la Revue y mène.

## 3. Reprendre le travail

    git fetch origin && git switch feat/agenda-ecriture   # ou la branche voulue
    npm ci
    npm test        # 288 tests passent ; 18 échecs PRÉEXISTANTS (ContractsPage, KpiCard,
                    # LoginPage, OverviewPage, QontoPage, StripePage), déjà présents sur main
    npm run build
    npm run dev     # puis /agenda?vue=semaine

Tester du SQL sans toucher la prod : `npx vitest run src/test/sql`. `src/test/sql/localDb.ts` rejoue
les 56 migrations dans un Postgres en mémoire (PGlite, dépendance de développement), avec des
substituts pour ce qui est propre à Supabase, et `asUser()` joue un compte donné, RLS active. C'est là
qu'il faut tester `apply_call_outcome` (PR 6) plutôt qu'en base réelle.

## 4. Deux trouvailles hors chantier

- 🔴 **`email-lead-detector` est en panne depuis au moins le 10/09/2026** : `global_timeout` (350 s) ou
  runs restés `running`, `stats` nul, dernier lead `email_auto` créé le 14/08. Le briefing Telegram le
  signale chaque matin. La PR 1 corrige l'écrasement des leads, **pas** la panne : elle ne pourra pas
  être vérifiée en conditions réelles tant que la fonction ne tourne pas.
- 🔒 **Écart dépôt ↔ prod sur les policies** (lu dans `pg_policies` le 18/09, en lecture seule) : en
  prod, `tasks` et `leads` sont réservés aux comptes du dashboard, mais **aucune migration ne le dit** ;
  les migrations 00006, 00007 et 00025 n'exigent qu'un compte connecté, et la base est partagée avec
  l'application. Un schéma recréé depuis le dépôt rouvrirait ces tables à tous les comptes.
  `fix/policies-prod-dans-le-depot` (migration 00057) ramène les policies de la prod dans le dépôt ;
  **sur la prod c'est un non-événement**, vérifié sur base locale (résultat identique à la prod, aucun
  changement sur une base déjà à l'état prod, rejouable, et droits vérifiés pour les trois profils :
  compte de l'application, admin_bizdev, admin_full). À relire quand même : ça touche aux droits.

## 5. Ce qui reste (PR 6 à 9 du plan)

La PR 6 (le débrief en chat) n'a pas été commencée. Les contrats arrêtés le 22/09, à reprendre tels
quels ou à discuter :

- **`apply_call_outcome(p jsonb)`** (migration **00058**, `security invoker`, une transaction par
  fiche ; squelette déjà relu deux fois dans le plan) remplace les suites d'écritures de
  `src/lib/callActions.ts`. Clés de `p` : `lead_id` (requis), `campaign_message_id`, `call_id`,
  `outcome` (requis), `note`, `callback_at`, `cr`, `cr_data`, `objection`, `next_action`,
  `follow_up_date` (absent ou vide = inchangée), `clear_follow_up`, `update_contact`, `contact_name`,
  `contact_role`, `task_title`, `task_due`, `assigned_to`. Rend `{call_id, fresh}`. Erreurs :
  `forbidden`, `bad_outcome`, `bad_assignee`, `lead_not_found`, `message_lead_mismatch`,
  `message_not_draft`, `call_not_found`, `already_debriefed`. Avec `campaign_next_due` (une seule
  implémentation du calcul de date, en SQL) et `campaign_advance`.
- **Fonction edge `call-debrief`** (`verify_jwt` activé, `validateAuth`, client porteur du **jeton de
  l'utilisateur**, jamais la clé service_role). `action: 'message'` → enregistre le message, découpe
  les passages numérotés **par le code**, un seul appel Gemini, revalide tout en base, écrit deux
  lignes `debrief_messages` ; `action: 'apply'` → `applied_at` en garde (409 `already_applied`), une
  fiche en erreur n'arrête pas les autres. Logique pure dans `_shared/debrief.ts`, testée par vitest.
- 🔴 Le maillon faible n'est pas l'identifiant, c'est **« Valider tout »** : deux classes de cartes,
  les sûres (passage numéroté, ou lead appelé ce jour-là, et confiance haute) cochées, les autres
  **décochées** avec leur raison affichée.
- **Chat** `DebriefChat.tsx` + `useDebrief.ts` dans le panneau de l'agenda, et **6d** : le CR validé
  entre dans le prompt du mail suivant (test bloquant : sans CR, le prompt reste identique octet pour
  octet).

## 6. Ce qui n'a pas pu être vérifié

Le développement s'est fait sans compte du dashboard : tout a été testé par la suite de tests, par le
banc Postgres local et au vrai navigateur sur des données fictives (10 gestes de glisser-déposer
vérifiés au pixel), **jamais** sur la base réelle ni avec un vrai prospect. La QA sur le lead de test
`ZZ TEST AGENDA` décrite dans le plan reste entièrement à faire, après application de 00056.
