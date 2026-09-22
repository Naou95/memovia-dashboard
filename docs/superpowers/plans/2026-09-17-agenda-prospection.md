# Agenda de prospection — plan d'implémentation (17/09/2026)

Spec : `docs/superpowers/specs/2026-09-15-agenda-prospection-design.md`
Maquette validée : `docs/superpowers/specs/maquette-agenda-prospection-2026-09-15.html` (v3 : grille
façon Outlook, tâches, débrief en chat).

Ce plan se lit par une session Claude Code qui n'a pas suivi la conception. Une PR = une branche =
une session. Chaque PR est livrable seule, ne change rien à ce qui existe tant qu'on ne s'en sert
pas, et se retire sans perte. **L'ordre des PR est une contrainte, pas une suggestion.**

---

## 0. État vérifié le 17/09/2026 (à revérifier au début de chaque PR)

Relevé en base (projet `mzjzwffpqubpruyaaxew`) et dans le dépôt, pas supposé :

| Fait | Valeur | Conséquence |
|---|---|---|
| Dernière migration du dépôt | `00055` | la prochaine est `00056` |
| `origin/main` depuis le 15/09 | aucun commit | pas de conflit à prévoir, **refaire `git fetch` avant chaque branche** |
| `lead_calls` | 0 ligne | on peut changer ses contraintes sans reprise de données |
| Campagne « CFA · référent handicap » | `draft`, 0 inscrit, 0 message | aucun envoi en cours à protéger, mais le code d'envoi ne se touche pas |
| `lead_calls_outcome_check` | `repondu, pas_repondu, rappel` | l'ancien front écrit encore `repondu` : élargir avant de resserrer |
| `tasks` | 32 lignes (10 ouvertes, dont 8 pour emir, 4 en retard) | elles apparaîtront dans l'agenda dès le premier jour |
| Consommateurs de `tasks` | `useTasks`, `useCopilot`, `telegram-daily-briefing`, `telegram-weekly-report`, `telegram-webhook`, `memovia-mcp`, `lead-hot-trigger`, `copilot-chat` | **colonnes ajoutées seulement, nullable ou avec défaut** ; jamais de renommage |
| RLS `tasks` | DELETE réservé à `admin_full` ; SELECT filtré par `is_private` | un `admin_bizdev` ne peut pas supprimer : décision D1 |
| Rôles | 1 `admin_full`, 1 `admin_bizdev` | aucun lien en base entre un compte et `'naoufel'` / `'emir'` : voir PR 4 |
| Déclencheur `on_lead_becomes_hot` | crée une tâche « Relancer X » et notifie Telegram quand `maturity` passe à `chaud` | **l'agenda n'écrit jamais `maturity`** |
| Briefing 06:00 UTC | liste toutes les tâches `todo`/`en_cours` dont `due_date <= aujourd'hui`, toute l'équipe | toute tâche créée par l'agenda et laissée en retard arrive dans le Telegram de Naoufel |
| Crons | `campaign-tick-daily` 05:00 UTC lun-ven, briefing 06:00 UTC | le nouveau cron passe à 05:20 UTC, entre les deux |
| Tables `leads`, `tasks`, `rdv`, `lead_calls` côté app `memovia-ia-notes` | 0 usage | ce sont des tables du dashboard, l'app n'est pas concernée |
| `verify_jwt` par fonction | `email-lead-detector` = **true**, `accueil-assistant` = true, `campaign-tick` = false, `campaign-send` = false | **redéployer chaque fonction avec SON réglage actuel**, jamais la commande générique à l'aveugle |
| `@dnd-kit/core` 6.3, `@dnd-kit/utilities` | installés (`sortable` et `modifiers` non) | le pas de 15 min s'écrit à la main, pas de dépendance à ajouter |
| `src/test/TopNav.test.tsx` | compte les entrées de nav | à mettre à jour dans la PR qui ajoute l'entrée |
| Ancien module `calendar` | suppression prévue vers le 17/09 (`REFONT_PLAN.md`) | rien dans ce plan n'en dépend |
| `tasks.created_by` | **nul sur 23 tâches sur 33** : celles créées par les fonctions edge (`lead-hot-trigger`, bot Telegram…) | la policy « supprimer ses tâches » ne les couvre pas : pas de bouton Supprimer sur elles (PR 5) |
| `dashboard_settings.value` | colonne **`text`**, pas `jsonb` (clé primaire : `key`) | le front fait `JSON.parse` sous `try` (fait, `parseCallWindow`) ; en SQL ou en edge il faut `value::jsonb` |
| `email-lead-detector` (relevé le 18/09) | **en panne depuis au moins le 10/09** : chaque nuit `global_timeout` (budget de 350 s épuisé) ou run resté `running`, `stats` nul ; dernier lead `email_auto` créé le 14/08 | sujet à part ; le briefing Telegram le dit déjà chaque matin (« run jamais fini », « coupé par son budget ») ; la PR 1 ne le répare pas et ne peut pas se vérifier par `lead_detector_runs` |

Requête de contrôle à rejouer (lecture seule) avant toute migration :

```sql
select (select count(*) from lead_calls) as lead_calls,
       (select count(*) from campaign_enrollments) as inscrits,
       (select count(*) from campaign_messages) as messages,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_migration;
```

---

## 1. Règles du chantier : ne rien casser

1. **La base est celle de la prod, partagée avec l'app.** Pas de base de recette. Toute migration est
   additive : nouvelle table, nouvelle colonne nullable ou avec défaut, contrainte **élargie**. Jamais
   de `drop column`, de renommage, de `not null` sans défaut, de réécriture de données existantes.
2. **Élargir, migrer, resserrer.** Une contrainte qui change (issues d'appel) accepte d'abord les
   anciennes ET les nouvelles valeurs ; le front bascule ; on ne resserre qu'après avoir vérifié en base
   qu'aucune ancienne valeur n'existe (PR 9, pas avant deux semaines d'usage).
3. **Invisible tant que ce n'est pas fini.** La route `/agenda` existe dès la PR 4 mais n'entre dans la
   navigation qu'à la PR 9. D'ici là on y accède par l'URL, comme les modules archivés.
4. **Le chemin d'envoi des mails ne se touche pas.** `campaign-send`, `campaignText.ts`, la Revue des
   mails : aucune modification. `campaign-tick` reçoit un seul ajout, inerte tant qu'aucun CR n'existe
   (PR 6), prouvé par un test d'égalité du prompt.
5. **Une écriture multi-tables passe par une fonction SQL** (une transaction), pas par une suite
   d'appels PostgREST. C'est la seule garantie qu'un CR ne laisse jamais une fiche à moitié écrite.
6. **Chaque écriture a sa garde d'idempotence** : `where status = 'draft'`, `where debriefed_at is
   null`, `where applied_at is null`, index unique. Un second onglet, un double clic ou un cron rejoué
   reçoit un refus net (409), jamais une seconde écriture.
7. **Champs interdits d'écriture** par tout le module : `leads.notes` (le détecteur le réécrit),
   `leads.maturity` (déclencheur), `leads.archived`, `leads.name`. Le statut ne change que pour
   Intéressé et Refus, jamais vers l'arrière.
8. **Aucun test vers un vrai prospect.** Un seul lead de test, nommé `ZZ TEST AGENDA`, adresse et
   téléphone de l'équipe, dans une campagne de test en brouillon. Nettoyage en fin de PR (§ 6).
   Prévenir Naoufel : une tâche de test en retard sortirait dans son briefing.
9. **Déploiement** : merge sur `main` = prod (Vercel), automatique. Une migration s'applique **après
   le merge de SA PR**, par le connecteur Supabase, puis se relit en SQL (tables, RLS, droits anon,
   index, cron). 🔴 **Une PR dont le code dépend d'une migration ne se merge qu'après l'application ET
   la relecture de cette migration** : la PR 3 écrit des issues que la base refuse tant que 00056
   n'est pas passée, et la PR 4 lit des colonnes qui n'existent pas avant. L'ordre inverse (migration
   appliquée, ancien front encore en ligne) est sans danger : tout ce que 00056 ajoute est nullable,
   a un défaut, ou élargit. Fonctions edge déployées une par une, `deno check` avant, test négatif
   d'auth après (401 sans jeton, 401 avec la clé anon pour les fonctions qui valident elles-mêmes).
10. **Fenêtre de déploiement** : jamais entre 04:50 et 06:10 UTC (crons `campaign-tick`, `agenda-tick`,
    briefing).
11. **Méthode par PR** (CLAUDE.md du dépôt) : relecture du plan, implémentation, polish de l'UI, QA
    navigateur (`npm run build` + `npx vite preview --port 4173`, login par le vrai formulaire,
    Playwright `channel: 'chrome'`, script écrit dans le dépôt puis supprimé), relecture adversariale
    (double écriture, garde manquante, cas négatif), puis commit. `npx tsc -b` et la suite vitest
    comparés à `main` avant chaque push. Si un skill (`/qa`, `/review`…) n'existe pas dans la session,
    faire l'étape à la main.
12. **Rien n'est poussé sans demande explicite.** Chaque PR s'arrête à « prêt à pousser ».

---

## 2. Décisions à prendre avant de coder

| # | Question | Recommandation | Si non |
|---|---|---|---|
| D1 | Un `admin_bizdev` peut-il supprimer une tâche ? | Oui, **les siennes seulement** : policy DELETE `created_by = auth.uid()` (PR 2). | Pas de bouton Supprimer pour lui, seulement « Terminer ». |
| D2 | Les attentes de la campagne CFA se comptent-elles en jours ouvrés ? | Oui, par une case par campagne, **décochée par défaut** (PR 7). Aujourd'hui tous les appels J+4 tombent du vendredi au lundi. | Comportement actuel, l'agenda reporte au prochain jour d'appels. |
| D3 | Tâches créées automatiquement : prépa de RDV la veille, CR de RDV manquant, revue du vendredi ? | Oui aux trois, chacune coupable dans `dashboard_settings.agenda_automations`. | Couper la clé correspondante, rien à redéployer. |
| D4 | Un agenda commun ou un par personne ? | Commun, avec un filtre « Mes tâches » (compte → prénom par le rôle : `admin_bizdev` → emir, `admin_full` → naoufel). | Reporter : il n'y a qu'une personne qui appelle. |
| D5 | Rappels Telegram (8h, fin de séance) ? | Non en v1. À rouvrir seulement si `section_visits` montre que l'agenda n'est pas ouvert les jours d'appels. | — |

**Décisions prises le 17/09/2026, toutes tranchées** :
- D1 oui : chacun supprime ses propres tâches, le bloc 7 de la migration 00056 reste.
- D2 oui : la case « jours ouvrés » est construite (PR 7), **décochée par défaut**. La cocher sur la
  campagne CFA est un geste à part, fait à la main dans l'onglet Séquence, pas par la migration.
- D3 oui aux trois : `agenda_automations` part à `{"rdv_prep":true,"rdv_cr":true,"weekly_review":true}`,
  comme écrit dans la migration 00056.
- D4 oui : agenda commun, filtre « Mes tâches ».
- D5 non pour l'instant : aucun rappel Telegram ni mail en v1.

---

## 3. Les automatisations, toutes

Deux familles : ce qui se **calcule à l'affichage** (aucune écriture, donc aucun risque) et ce qui
**écrit** (toujours idempotent, toujours coupable).

| # | Automatisation | Déclencheur | Ce qu'elle fait | Garde-fou | PR |
|---|---|---|---|---|---|
| A1 | Appels du jour | `campaign-tick` existant, 05:00 UTC | Les brouillons d'appel dus apparaissent dans la séance du jour | aucune écriture nouvelle | 4 |
| A2 | Ordre de priorité | calcul | rappel promis, étape en retard, étape du jour, relance en retard, relance du jour ; à égalité : maturité puis ancienneté du dernier contact | fonction pure testée | 4 |
| A3 | Placement dans la séance | calcul | un créneau de 10 min par appel dans la fenêtre ; le trop-plein part en « à reporter » | fonction pure testée | 4 |
| A4 | Report des appels non passés | calcul | un appel dû hier et toujours en brouillon remonte aujourd'hui avec « retard N j » ; dû un jour sans séance, il s'affiche au prochain jour d'appels | aucune écriture : `due_at` ne bouge que sur « Décaler » | 4 |
| A5 | Appels prévus | calcul | projection d'une étape (pointillé « estimé ») à partir de `next_due_at` et `wait_days` | jamais plus d'une étape | 4 |
| A6 | Bloc « Débrief » après la séance | calcul | bloc de 15 min à la fin de la séance, rouge tant qu'un appel du jour n'a pas de CR | — | 6 |
| A7 | CR → fiche | « Valider tout » | appel, fiche lead, historique, séquence : une transaction par fiche | fonction SQL, garde `debriefed_at is null`, refus 409 | 6 |
| A8 | CR → rappel promis | « Valider tout » | `lead_calls.callback_at` et `follow_up_date` ; en campagne, `next_due_at` à cette date | le rappel redevient un appel dû ce jour-là par le tick existant | 6 |
| A9 | CR → tâche | « Valider tout » | quand la prochaine action est à nous (« envoyer la doc ») : tâche liée au lead, échéance du CR | `tasks.auto_key = 'cr:<call_id>'`, unique | 6 |
| A10 | CR → mail suivant | `campaign-tick` | les 2 derniers CR validés du lead entrent dans le prompt du brouillon suivant | bloc absent s'il n'y a pas de CR : prompt identique à aujourd'hui | 6 |
| A11 | Prépa de RDV | cron `agenda-tick` 05:20 UTC lun-ven | tâche « Préparer le RDV » la veille ouvrée d'un RDV | `auto_key = 'rdv-prep:<rdv_id>'`, clé `rdv_prep` | 7 |
| A12 | CR de RDV manquant | cron `agenda-tick` | tâche « Écrire le CR » pour un RDV passé dont `cr_status = 'manquant'` | `auto_key = 'rdv-cr:<rdv_id>'`, clé `rdv_cr` | 7 |
| A13 | Revue du vendredi | cron `agenda-tick`, le vendredi | tâche planifiée à 16:00 « Revue de la semaine : N CR » si N ≥ 1, lien vers Rapports | `auto_key = 'weekly-review:<année-semaine>'`, clé `weekly_review` | 7 |
| A14 | Attentes en jours ouvrés | avance d'une inscription | `wait_days` saute samedi et dimanche quand la campagne l'a coché | colonne `campaigns.business_days` à `false` par défaut : rien ne change sans clic | 7 |
| A15 | Ajustements de campagne | bouton, à partir de 5 CR validés | 1 à 3 propositions avant / après ; « Appliquer » passe par `updateStep` et les contrôles existants | n'écrit rien seule ; l'ancien texte est comparé avant d'appliquer | 8 |

Une tâche automatique que l'utilisateur termine reste terminée : le cron ne recrée jamais une clé qui
existe, quel que soit son statut. Une tâche automatique ne se supprime pas depuis l'agenda (on la
termine), pour que sa clé reste et qu'elle ne revienne pas le lendemain.

---

## 4. Les PR

Résumé :

| PR | Branche | Contenu | Touche l'existant ? | Taille |
|---|---|---|---|---|
| 0 | `docs/agenda-spec` | spec, maquette, ce plan | non | XS |
| 1 | `fix/detecteur-ne-plus-ecraser` | le détecteur de leads fusionne au lieu d'écraser | `email-lead-detector` | S |
| 2 | `feat/agenda-schema` | migration 00056, types | base (additif) | S |
| 3 | `feat/issues-appel-5` | 5 issues d'appel partout, fin de l'écrasement | `LogCallDialog`, `useLeads`, `useCampaigns.completeCall` | S |
| 4 | `feat/agenda-lecture` | route `/agenda` cachée, grille jour et semaine, fiche d'appel, lecture seule | router (1 route) | L |
| 5 | `feat/agenda-ecriture` | tâches (créer, modifier, déplacer), séance et RDV déplaçables, enregistrer une issue | `ReviewTab` (extraction d'un composant) | L |
| 6 | `feat/agenda-debrief` | fonction SQL, `call-debrief`, chat, CR dans le prompt | `campaign-tick` (ajout inerte) | L |
| 7 | `feat/agenda-automatisations` | `agenda-tick` + cron, jours ouvrés | `_shared/campaign.ts` (1 fonction), Séquence (1 case) | M |
| 8 | `feat/campagne-ajustements` | `campaign-insights`, bloc Rapports | `RapportsTab` | M |
| 9 | `feat/agenda-mise-en-service` | entrée de nav, puces Accueil, docs ; plus tard le resserrage | nav, Accueil, CLAUDE.md | S |

### PR 0 — La documentation

1. `git fetch && git switch -c docs/agenda-spec origin/main`.
2. Ajouter les trois fichiers (`specs/2026-09-15-agenda-prospection-design.md`, la maquette HTML, ce
   plan). Aucune ligne de code.
3. Commit : `docs(agenda): spec, maquette et plan de l'agenda de prospection`.

### PR 1 — Le détecteur de leads n'écrase plus un lead existant

**Pourquoi d'abord** : le défaut existe aujourd'hui. `email-lead-detector/index.ts:366-379` remplace
sur un lead existant `name`, `status`, `maturity`, `notes`, `next_action`, `relance_count`,
`last_contact_date`, `timeline`, `contact_role` par l'analyse IA du fil de mails. Un prospect de
campagne qui répond perd ses entrées « envoyé », peut voir son statut reculer, et perdrait demain ses
entrées d'appel.

Fichiers : `supabase/functions/_shared/leadMerge.ts` (nouveau, pur), `email-lead-detector/index.ts`,
`src/test/LeadMerge.test.ts`, et une ligne de `telegram-daily-briefing/index.ts` (le briefing affiche
« N déjà à jour » : sans cela, une nuit saine lirait « 0 màj », comme une panne).

1. Écrire `leadMerge.ts`, sans import Deno :
   ```ts
   export function mergeTimeline(existing: TimelineEntry[] | null, incoming: TimelineEntry[] | null): TimelineEntry[]
   // garde TOUTES les entrées existantes (dont direction 'appel'), ajoute les entrantes absentes ;
   // clé de dédoublonnage : date + direction + sujet normalisé (minuscules, sans accents, sans « Re: ») ;
   // tri par date croissante, ordre d'origine conservé à date égale.
   export function mergeLeadFromAnalysis(existing: ExistingLead, a: Analysis): LeadPatch
   ```
   Règles de `mergeLeadFromAnalysis` :
   - `name`, `notes`, `next_action`, `contact_role` : **la valeur existante non vide gagne**.
   - `status` : jamais vers l'arrière. Rang `nouveau 0 < contacte 1 < en_discussion 2 < proposition 3` ;
     `gagne`, `perdu`, `actif` ne sont jamais modifiés.
   - `maturity` : vers le haut seulement (`froid < tiede < chaud`).
   - `relance_count` : le plus grand des deux ; `last_contact_date` : la plus récente.
   - `timeline` : `mergeTimeline`.
   - Le patch ne contient que les clés qui changent : un lead inchangé ne reçoit aucun `update`
     (le déclencheur `leads_updated_at` ne se réveille pas pour rien).
2. Dans `upsertLead` : le `select('id')` devient
   `select('id, name, status, maturity, notes, next_action, relance_count, last_contact_date, timeline, contact_role')`,
   et l'`update` envoie `mergeLeadFromAnalysis(existing, analysis)`. **La branche insertion change
   aussi** (relecture du 18/09) : `insert` et plus `upsert`. Sur conflit, l'`upsert` écrasait toutes
   les colonnes (le même défaut, par un autre chemin, en cas de deux runs simultanés), et
   `onConflict: 'contact_email'` vise un index **partiel** que PostgREST ne sait pas désigner. Sur
   `23505`, on relit le lead que l'autre run vient de créer et on fusionne. Un lead reconnu mais déjà
   à jour compte dans `stats.unchanged`, plus dans `updated`.
   `mergeTimeline` ne réordonne jamais l'existant, et reconnaît un même mail daté à un jour près (la
   campagne date au jour de Paris, le détecteur lit l'en-tête UTC).
3. Tests vitest (modèle : `src/test/CampaignText.test.ts`) :
   - une timeline avec une entrée `appel` et deux `envoyé` ressort intacte, plus l'entrée `reçu` nouvelle ;
   - rejouer deux fois la même analyse ne duplique rien ;
   - `en_discussion` + analyse « nouveau » reste `en_discussion` ; `perdu` reste `perdu` ;
   - notes existantes conservées, notes vides remplies ;
   - lead inchangé → patch vide.
4. `deno check --node-modules-dir=none supabase/functions/email-lead-detector/index.ts`.
5. Déploiement : **sans** `--no-verify-jwt` (cette fonction est en `verify_jwt = true`, le cron lui
   passe la clé anon en Bearer et le secret cron en en-tête). Vérifier le réglage après déploiement
   avec la liste des fonctions. `telegram-daily-briefing` se redéploie de la même façon (elle aussi en
   `verify_jwt = true`) ; tant qu'elle ne l'est pas, elle ignore simplement la nouvelle clé `unchanged`.
6. Vérification **par la donnée**, pas par `lead_detector_runs` (le détecteur ne termine plus ses
   runs, § 0 : cette table ne dira rien). Avant et après un run déclenché depuis `/mail`, relever sur
   deux leads connus `notes`, `status`, `next_action` et `jsonb_array_length(timeline)` : rien ne doit
   avoir diminué ni changé. Si le run n'atteint jamais l'écriture (timeout), la PR reste correcte mais
   **non vérifiée en réel** : le dire tel quel, et traiter la panne du détecteur à part.
7. Retour arrière : redéployer la version précédente depuis `main`. Aucune donnée à restaurer.

### PR 2 — Le schéma (migration 00056), additif

Fichiers : `supabase/migrations/00056_agenda.sql`, `src/types/database.ts`, `src/types/leads.ts`
(type de timeline seulement), `src/types/tasks.ts`.

```sql
-- 00056_agenda.sql — Agenda de prospection (spec 2026-09-15-agenda-prospection-design.md).
-- Additif : aucune colonne retirée ni renommée, aucune donnée réécrite.

-- 1. lead_calls : CR, lien vers l'étape de campagne, rappel promis. Table vide au 17/09/2026.
alter table public.lead_calls
  add column if not exists campaign_message_id uuid references public.campaign_messages(id) on delete set null,
  add column if not exists cr text,
  add column if not exists cr_data jsonb,
  add column if not exists objection text,
  add column if not exists callback_at timestamptz,
  add column if not exists debriefed_at timestamptz,
  add column if not exists debriefed_by uuid;

-- Un appel de campagne ne s'enregistre qu'une fois.
create unique index if not exists lead_calls_one_per_message
  on public.lead_calls (campaign_message_id) where campaign_message_id is not null;
create index if not exists lead_calls_lead_called_idx on public.lead_calls (lead_id, called_at desc);

-- Issues : ÉLARGIES. 'repondu' reste valide tant que l'ancien front tourne (resserrage : PR 9).
alter table public.lead_calls drop constraint if exists lead_calls_outcome_check;
alter table public.lead_calls add constraint lead_calls_outcome_check
  check (outcome in ('repondu', 'pas_repondu', 'rappel', 'joint', 'refus', 'interesse'));
alter table public.lead_calls drop constraint if exists lead_calls_objection_check;
alter table public.lead_calls add constraint lead_calls_objection_check
  check (objection is null or objection in ('mauvais_interlocuteur', 'pas_de_budget', 'deja_equipe',
    'pas_le_moment', 'pas_concerne', 'veut_de_la_doc', 'autre'));

-- 2. tasks : créneau facultatif et clé des tâches automatiques. Défauts pour les 7 autres écrivains.
alter table public.tasks
  add column if not exists scheduled_at timestamptz,
  add column if not exists duration_min int not null default 30,
  add column if not exists auto_key text;
alter table public.tasks drop constraint if exists tasks_duration_check;
alter table public.tasks add constraint tasks_duration_check check (duration_min between 5 and 480);
create unique index if not exists tasks_auto_key_unique on public.tasks (auto_key) where auto_key is not null;
create index if not exists tasks_open_due_idx on public.tasks (due_date) where status <> 'done';

-- 3. rdv : une durée pour le dessiner sur la grille.
alter table public.rdv add column if not exists duration_min int not null default 45;

-- 4. Séance d'appels déplacée ou annulée pour un jour donné (sinon : créneau par défaut des réglages).
create table if not exists public.agenda_sessions (
  day date primary key,
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  cancelled boolean not null default false,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (end_min > start_min)
);

-- 5. Le fil du débrief : une conversation par jour et par personne.
create table if not exists public.debrief_messages (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  recap jsonb,
  applied_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists debrief_messages_day_idx on public.debrief_messages (created_by, day, created_at);

alter table public.agenda_sessions enable row level security;
alter table public.debrief_messages enable row level security;
-- Une seule policy admin par table (les policies permissives s'additionnent : ne pas élargir).
create policy agenda_sessions_admin_all on public.agenda_sessions
  for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
create policy debrief_messages_admin_all on public.debrief_messages
  for all to authenticated using (public.is_dashboard_admin(auth.uid())) with check (public.is_dashboard_admin(auth.uid()));
revoke all on public.agenda_sessions from anon;
revoke all on public.debrief_messages from anon;

-- 6. Réglages. Squelette seulement, modifiable dans l'UI.
insert into public.dashboard_settings (key, value) values
  ('agenda_call_window', '{"days":[1,2,3,4],"start":"09:00","end":"11:30","slot_minutes":10}'),
  ('agenda_automations', '{"rdv_prep":true,"rdv_cr":true,"weekly_review":true}')
on conflict (key) do nothing;

-- 7. (Décision D1) Un membre du dashboard supprime SES tâches. La policy admin_full reste.
create policy "Dashboard admins delete own tasks" on public.tasks
  for delete to authenticated
  using (public.is_dashboard_admin(auth.uid()) and created_by = auth.uid());
```

Étapes :
1. Rejouer la requête de contrôle du § 0. Si `lead_calls` n'est plus vide, **s'arrêter** et relire les
   valeurs d'`outcome` présentes avant de toucher à la contrainte.
2. Écrire la migration. Si D1 est refusée, retirer le bloc 7.
3. `src/types/database.ts` : ajouter les colonnes et les deux tables. `src/types/tasks.ts` :
   `scheduled_at: string | null`, `duration_min: number`, `auto_key: string | null`, et les rendre
   optionnelles dans `TaskInsert`. `src/types/leads.ts` : `direction: 'envoyé' | 'reçu' | 'appel'`.
   Même élargissement dans `_shared/campaign.ts` (`TimelineEntry`).
4. `npx tsc -b` : aucun nouvel échec par rapport à `main` (les écrivains de `tasks` n'envoient pas les
   nouvelles colonnes, les défauts suffisent).
5. Après le merge, appliquer la migration, puis relire :
   ```sql
   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('lead_calls'::regclass, 'tasks'::regclass) and contype = 'c';
   select tablename, policyname, cmd from pg_policies where tablename in ('agenda_sessions', 'debrief_messages', 'tasks');
   select grantee, privilege_type from information_schema.role_table_grants where table_name in ('agenda_sessions', 'debrief_messages') and grantee = 'anon';  -- 0 ligne attendue
   select key from dashboard_settings where key like 'agenda_%';
   ```
5 bis. Si un écran dit encore « migration non appliquée » juste après l'application : c'est le cache
   de schéma de PostgREST sur les nouvelles tables. `notify pgrst, 'reload schema';` puis recharger.
6. Test de non-régression, en prod, sans rien créer : ouvrir `/leads` (les engagements s'affichent),
   vérifier que le briefing du lendemain liste toujours ses tâches échues, que le bot Telegram crée une
   tâche (`/tache test` puis la terminer).
7. Retour arrière : les colonnes et tables ajoutées ne gênent personne, on les laisse. En cas de
   besoin absolu : `drop policy`, `drop table agenda_sessions, debrief_messages`, puis remettre l'ancienne
   contrainte d'issues **seulement si** `select count(*) from lead_calls where outcome in ('joint','refus','interesse')` vaut 0.

### PR 3 — Cinq issues d'appel partout

Défaut corrigé : `useCampaigns.ts:470` ramène `joint`, `refus` et `interesse` à `repondu` quand la Revue
enregistre un appel. Un Refus et un Intéressé deviennent indiscernables en base.

Fichiers : `src/types/leads.ts`, `src/types/campagnes.ts`, `src/hooks/useLeads.ts`,
`src/hooks/useCampaigns.ts`, `src/modules/prospection/components/LogCallDialog.tsx`.

1. `types/leads.ts` : `CallOutcome = 'joint' | 'pas_repondu' | 'rappel' | 'refus' | 'interesse' | 'repondu'`.
   `repondu` reste lisible (libellé « Répondu, ancien »), n'est plus proposé à la saisie. `CallResult`
   de `types/campagnes.ts` devient un alias de `CallOutcome` sans `repondu` : une seule liste.
2. `LogCallDialog` : 5 boutons, mêmes libellés que la Revue (`CALL_RESULT_LABELS`).
0. 🔴 **Ne pas merger avant que cette requête rende les 6 valeurs** (00056 appliquée) :
   `select pg_get_constraintdef(oid) from pg_constraint where conname = 'lead_calls_outcome_check';`
   Sinon tout appel noté Joint, Refus ou Intéressé est refusé par la base (`23514`), depuis `/leads`
   comme depuis la Revue.
3. `completeCall` : insérer l'issue telle quelle, avec `campaign_message_id: messageId`. Retirer le
   préfixe « Refus. » de la note. **L'appel s'insère AVANT que le message passe en `done`** (relecture
   du 18/09) : dans l'autre sens, un insert refusé laissait un message « fait » sans appel, que la
   garde `status = 'draft'` rendait impossible à réenregistrer. L'index unique
   `lead_calls_one_per_message` devient la garde contre le double enregistrement (`23505` →
   `message_not_sendable`) ; si le message n'est plus un brouillon, l'appel tout juste écrit est retiré.
4. `useLeads.logCall` : inchangé, sauf le type.
5. Tests : le test d'auth touché par la PR #31 (`src/test/auth.test.tsx`) et la suite existante passent ;
   ajouter un test qui vérifie que les 5 issues de la Revue et du dialogue Leads sont la même liste.
6. QA sur `ZZ TEST AGENDA` : loguer un appel depuis `/leads` avec « Intéressé », vérifier
   `select outcome, campaign_message_id from lead_calls order by called_at desc limit 1;`.
7. Retour arrière : `git revert`. Les lignes `interesse` déjà écrites restent valides (contrainte élargie).

### PR 4 — L'agenda en lecture seule, caché

Route `/agenda`, grille jour et semaine, fiche d'appel. **Aucune écriture** dans cette PR : c'est ce
qui permet de l'ouvrir en prod sur les vraies données sans risque.

Fichiers nouveaux :
- `src/lib/agenda.ts` (pur) et `src/test/Agenda.test.ts`
- `src/hooks/useAgenda.ts`
- `src/modules/agenda/AgendaPage.tsx`
- `src/modules/agenda/components/CalendarGrid.tsx`, `DayList.tsx` (mobile), `CallSheet.tsx`,
  `AgendaSummary.tsx`
- `src/types/agenda.ts`

Fichier modifié : `src/router/index.tsx` (une route `agenda`, en `lazy` + `Suspense`, sur le modèle de
`campagnes`). **Pas** `navigation.ts`. `section_visits` compte `agenda` tout seul (`AppLayout` lit le
premier segment de l'URL).

1. `src/types/agenda.ts` :
   ```ts
   type CallSignal = 'rappel_promis' | 'etape_retard' | 'etape_jour' | 'relance_retard' | 'relance_jour'
   interface CallItem { key: string; leadId: string; lead: LeadLite; signal: CallSignal; dueDay: string; lateDays: number;
     campaign?: { id: string; name: string; messageId: string; stepName: string; stepBrief: string | null; enrollmentId: string };
     callbackAt?: string; done?: { callId: string; outcome: CallOutcome; debriefed: boolean } }
   interface GridBlock { id: string; kind: 'calls' | 'rdv' | 'task'; day: string; startMin: number; durMin: number; ... }
   interface CallWindow { days: number[]; start: string; end: string; slot_minutes: number }
   ```
2. `src/lib/agenda.ts`, fonctions pures, toutes en heure de Paris (`Europe/Paris`), testées :
   - `parisDay(iso)`, `parisMinutes(iso)`, `toUtcIso(day, minutes)` ; cas de test : le 25/10/2026
     (changement d'heure) ;
   - `isCallDay(day, window, sessions)`, `nextCallDay(day, window, sessions)` ;
   - `sessionFor(day, window, sessions)` : la surcharge du jour, sinon le créneau par défaut, sinon rien ;
   - `prioritize(items)` : l'ordre A2 ;
   - `placeInSession(items, session)` : `{ placed, overflow }`, un créneau de `slot_minutes` par appel ;
   - `displayDay(item, window, sessions, today)` : A4, sans jamais modifier la donnée ;
   - `projectNextCalls(enrollments, steps)` : A5, une étape au plus ;
   - `snap(minutes, 15)`, `clampToDay(start, dur)`.
3. `useAgenda(range)` : motif maison (`useState`, `fetchAll`, rafraîchissement manuel, horodatage « à
   jour il y a X min », échec affiché). Requêtes, toutes bornées à la plage affichée :
   - `campaign_messages` `kind = 'call'`, `status = 'draft'`, avec `step:campaign_steps(...)`,
     `enrollment:campaign_enrollments(id, status, current_position, next_due_at, campaign:campaigns(id, name, status), lead:leads(id, name, contact_name, contact_role, contact_phone, contact_email, status, archived, maturity, last_contact_date, why, pitch, next_action, follow_up_date))` ;
     ne garder que les inscriptions `active` de campagnes `live` **ou** `draft` (une campagne en
     brouillon prépare ses brouillons par « Actualiser », ils doivent se voir) ;
   - `campaign_enrollments` actives, pour la projection ;
   - `lead_calls` de la plage (faits, avec ou sans CR) et ceux dont `callback_at` tombe dans la plage ;
   - `leads` prospects non archivés dont `follow_up_date` est dans la plage ou dépassée ; écarter ceux
     qui ont déjà un appel de campagne le même jour ;
   - `rdv` de la plage ; `tasks` par `useTasks` (il existe, temps réel compris) ;
   - `dashboard_settings` (`agenda_call_window`, `leads_script`) ; `agenda_sessions` de la plage.
4. `CalendarGrid` : **un seul composant** pour le jour (1 colonne, 156 px par heure, la séance affiche
   la liste de ses appels) et la semaine (5 colonnes, 64 px par heure). En-tête collant, ligne
   « journée », colonnes 8h–18h, blocs en position absolue, trait de l'heure courante. Reprendre la
   structure et les classes de la maquette (`.cal`, `.cal-head`, `.cal-allday`, `.cal-col`, `.blk`),
   en Tailwind et jetons du dépôt. Pas de `react-big-calendar`.
5. Tâches en lecture : sur la grille si `scheduled_at`, sinon dans la ligne « journée » de leur
   `due_date`. Une tâche ouverte dont l'échéance est passée s'affiche **aujourd'hui** avec « retard N j ».
   Une tâche sans échéance n'entre pas dans la grille (liste repliée « Sans échéance » du panneau).
   Filtre « Mes tâches » par défaut (D4), bascule « Toutes ».
6. `CallSheet` : les 7 rubriques de la spec. `Où on en est` lit les messages `sent` de l'inscription.
   `Interdits` lit la liste exportée par `_shared/campaignText.ts`. `Historique` lit `lead_calls` du lead
   et `splitTasksForLead` (existe dans `types/tasks.ts`). Bouton Appeler en `tel:`. Pas encore de barre
   d'issue.
7. Mobile (`md:hidden` / `hidden md:block`, comme `ProspectionPage`) : vue jour en cartes (Appels,
   Tâches, RDV) ; vue semaine en grille à défilement horizontal ; fiche en `fixed inset-0`,
   `h-[100dvh]`, cibles de 44 px.
8. États vides honnêtes : « Aucun appel dû aujourd'hui. Les appels apparaissent 4 jours après un premier
   mail validé » quand la campagne n'a pas d'inscrits.
9. Tests vitest : priorité, placement et trop-plein, report, projection, jours d'appels, changement
   d'heure, pas de 15 min.
10. QA : ouvrir `/agenda` connecté en `admin_bizdev` ; les 10 tâches ouvertes réelles s'affichent au
    bon jour ; aucune requête d'écriture dans l'onglet réseau ; 375 px et 1280 px.
11. Retour arrière : `git revert`, rien en base.

Limites connues de cette PR, assumées et écrites pour ne pas les redécouvrir :
- une seule carte par lead : un lead inscrit dans deux campagnes montre son brouillon d'appel le plus
  ancien ; un lead déjà appelé aujourd'hui depuis la section Leads ne réapparaît pas « à appeler » le
  même jour, même si son étape de campagne est restée en brouillon (elle revient le lendemain) ;
- les brouillons d'appel d'une campagne en pause ou archivée ne s'affichent nulle part ;
- l'historique de la fiche d'appel couvre 90 jours (c'est écrit dans le titre de la rubrique) ;
- un rappel demandé sans date, vieux de plus de 30 jours, n'est plus traité comme une promesse ;
- hors navigation, le titre mobile de la page reste « Dashboard » jusqu'à la PR 9.

### PR 5 — L'agenda en écriture : tâches, déplacements, issue d'appel

Fichiers : `CalendarGrid.tsx` (glisser-déposer), `TaskPanel.tsx`, `BlockForm.tsx`, `CallOutcomeBar.tsx`
(extrait de `ReviewTab.tsx:341-398`), `useAgenda.ts` (mutations), `ReviewTab.tsx` (utilise le composant
extrait, comportement identique).

1. **Tâches** par `useTasks` : `createTask` (titre, `due_date`, `scheduled_at` facultatif,
   `duration_min`, `lead_id`, `assigned_to` = la personne connectée, `priority: 'normale'`,
   `is_private: false`), `updateTask`, case à cocher → `status: 'done'` / `'todo'`. Supprimer : proposé
   seulement si la base l'acceptera, c'est-à-dire `created_by` = le compte connecté (ou rôle
   `admin_full`), et jamais pour une tâche dont `auto_key` n'est pas nul. 23 tâches sur 33 ont un
   `created_by` nul (créées par des fonctions edge) : sur elles, « Terminer » seulement. Un bouton qui
   échoue en silence est pire que pas de bouton.
2. **Créer** : clic sur un créneau vide → formulaire (type : tâche, RDV, séance ; titre ; durée ; lead).
   RDV → `rdv` (`title`, `rdv_date`, `duration_min`, `lead_id`), même insertion que le module RDV.
   Séance → `upsert` dans `agenda_sessions`.
3. **Déplacer** avec `@dnd-kit/core` : `PointerSensor` (distance 4 px) pour la souris, `TouchSensor`
   sur la poignée seulement. Une zone déposable par colonne de jour, une par case « journée ». Le pas de
   15 min se calcule dans `onDragMove` à partir de la position dans la colonne (fonction `snap` de la
   PR 4), `DragOverlay` pour le fantôme avec l'heure d'arrivée, cadre pointillé sur le créneau.
   - tâche → `scheduled_at` et `due_date` ; déposée dans « journée » → `scheduled_at = null` ;
   - RDV → `rdv_date` ; refusé dans « journée » ;
   - séance → `agenda_sessions` du jour d'arrivée ; si elle change de jour, la séance du jour de
     départ est marquée `cancelled` (les appels dus ce jour-là s'affichent alors au prochain jour
     d'appels, A4) ;
   - mise à jour optimiste, retour à la position d'origine et toast si l'écriture échoue.
   - Alternative clavier et mobile : le formulaire (jour, heure) fait tout ce que fait le glisser.
4. **Issue d'appel depuis la fiche** : `CallOutcomeBar` appelle le `completeCall` existant pour un appel
   de campagne, `logCall` pour une relance hors campagne. Aucune logique nouvelle ici, la même garde
   `.eq('status', 'draft')`.
5. **Décaler** : pour un appel de campagne, `postponeMessage` existe (`useCampaigns.ts:433`) ; lui passer
   le nombre de jours jusqu'à `nextCallDay`, pas `1`. Pour une relance : `follow_up_date`.
6. `ReviewTab` : l'étape d'appel garde sa fiche actuelle et gagne un lien « Ouvrir dans l'agenda ».
7. Tests : règles de dépôt (un RDV refusé dans « journée »), bornes 8h–18h, tâche qui perd son heure.
8. QA Playwright (script jetable) : les 5 scénarios de la maquette (glisser mardi 15h → mercredi 10h,
   créer par clic, changer l'heure, planifier une tâche sans heure, ajouter par le champ), plus :
   deux onglets, la même tâche déplacée des deux côtés (le dernier gagne, pas d'erreur) ; enregistrer
   deux fois la même issue (second refus `message_not_sendable`).
9. Retour arrière : `git revert`. Les tâches créées restent des tâches normales du dashboard.

**Fait le 18/09 (branche `feat/agenda-ecriture`), et ce qui a changé en route :**

- **Viser au pointeur.** La colonne d'arrivée est celle sous le pointeur (`elementsFromPoint` et les
  attributs `data-drop-id` / `data-hour-px`), mesurée à l'instant. Viser par la surface du fantôme
  (plus large qu'une colonne) ou par le déplacement de dnd-kit (qui compte le défilement de la grille)
  envoyait un bloc lâché sur mer. 10:00 à jeu. 10:30. Vérifié au vrai navigateur : 10 gestes sur 10,
  dont un avec 336 px de défilement automatique.
- **Les écritures d'un appel sont dans `src/lib/callActions.ts`**, partagées par la Revue, Leads et
  l'agenda. `CallPartiallySavedError` distingue « rien n'est écrit » de « l'appel est écrit, la suite
  non » : dans le second cas, on ferme la fiche au lieu d'inviter à ressaisir (doublon).
- **Modifier n'écrit que ce qui change** (`taskUpdate`) : `tasks` sert aussi au Kanban, au bot et au
  MCP. Une tâche « en cours » renommée depuis l'agenda le reste ; une tâche sans échéance terminée ne
  reçoit pas de date.
- **Reporter** part du plus tardif de : aujourd'hui, l'échéance, le jour où l'appel s'affiche
  (`postponeTarget`). Partir d'aujourd'hui avançait un appel ouvert dans un jour futur. Le report ne
  touche un brouillon que s'il en est encore un (`status = 'draft'`, inscription `active`), puisque
  l'agenda n'est pas en temps réel.
- **Séance** : refusée sur un jour qui a déjà la sienne et le week-end (`sessionMoveRefusal`).
- **Relance hors campagne** : la fiche propose la prochaine relance selon l'issue (J+2 sans réponse ou
  rappel, J+7 joint ou intéressé, aucune après un refus), sur un jour de séance, modifiable.
- La PR 6 remplacera les écritures en plusieurs temps par `apply_call_outcome` (une transaction) :
  `CallPartiallySavedError` disparaîtra avec elles.

### PR 6 — Le débrief en chat

Trois morceaux : la fonction SQL qui écrit, la fonction edge qui comprend, le chat.

**6a. Migration `00057_agenda_cr.sql` : `apply_call_outcome`.** `security invoker` (la RLS s'applique à
l'appelant), une transaction par fiche. Squelette, à compléter et à relire ligne à ligne :

```sql
create or replace function public.apply_call_outcome(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_lead_id  uuid := (p->>'lead_id')::uuid;
  v_msg_id   uuid := nullif(p->>'campaign_message_id', '')::uuid;
  v_call_id  uuid := nullif(p->>'call_id', '')::uuid;          -- appel déjà enregistré par la fiche
  v_outcome  text := p->>'outcome';
  v_callback timestamptz := nullif(p->>'callback_at', '')::timestamptz;
  v_has_cr   boolean := coalesce(p->>'cr', '') <> '';
  v_fresh    boolean := false;                                  -- l'issue s'applique pour la 1re fois
  v_old      text;
  v_enr      public.campaign_enrollments%rowtype;
begin
  if not public.is_dashboard_admin(auth.uid()) then raise exception 'forbidden'; end if;
  if v_outcome not in ('joint','pas_repondu','rappel','refus','interesse') then raise exception 'bad_outcome'; end if;
  -- tasks_assigned_to_check n'accepte que 'naoufel' | 'emir' : une autre valeur annulerait TOUT le CR.
  if coalesce(p->>'assigned_to', '') not in ('', 'naoufel', 'emir') then raise exception 'bad_assignee'; end if;
  perform 1 from public.leads where id = v_lead_id for update;          -- sérialise deux validations
  if not found then raise exception 'lead_not_found'; end if;

  -- 1. L'appel
  if v_call_id is null then
    if v_msg_id is not null then
      -- Le message doit appartenir à CE lead : sinon un rattachement faux (deux onglets, texte de
      -- débrief mal compris) écrirait l'appel sur A et arrêterait la séquence de B.
      perform 1 from public.campaign_messages m join public.campaign_enrollments e on e.id = m.enrollment_id
       where m.id = v_msg_id and e.lead_id = v_lead_id;
      if not found then raise exception 'message_lead_mismatch'; end if;
      update public.campaign_messages set status = 'done', outcome = v_outcome, note = nullif(p->>'note', ''), updated_at = now()
       where id = v_msg_id and kind = 'call' and status = 'draft';
      if not found then raise exception 'message_not_draft'; end if;
    end if;
    insert into public.lead_calls (lead_id, outcome, note, campaign_message_id, callback_at)
    values (v_lead_id, v_outcome, nullif(p->>'note', ''), v_msg_id, v_callback) returning id into v_call_id;
    v_fresh := true;
  else
    -- Cas NOMINAL du débrief : l'appel a déjà été enregistré par la fiche. Le lien vers l'étape de
    -- campagne est DANS la ligne lead_calls : on le lit là, on ne l'attend pas du front. Sans cela
    -- v_msg_id reste nul, le bloc 3 est sauté, et un Refus validé au débrief n'arrête jamais la séquence.
    select outcome, campaign_message_id into v_old, v_msg_id
      from public.lead_calls where id = v_call_id and lead_id = v_lead_id;
    if not found then raise exception 'call_not_found'; end if;
  end if;

  if v_has_cr then
    update public.lead_calls
       set cr = p->>'cr', cr_data = p->'cr_data', objection = nullif(p->>'objection', ''), outcome = v_outcome,
           callback_at = coalesce(v_callback, callback_at), debriefed_at = now(), debriefed_by = auth.uid()
     where id = v_call_id and debriefed_at is null;
    if not found then raise exception 'already_debriefed'; end if;
  end if;

  -- 2. La fiche : jamais notes, maturity, name, archived ; statut jamais vers l'arrière.
  update public.leads set
      last_contact_date = greatest(coalesce(last_contact_date, '1970-01-01'), (now() at time zone 'Europe/Paris')::date),
      canal = 'appel',
      next_action    = coalesce(nullif(p->>'next_action', ''), next_action),
      follow_up_date = coalesce(nullif(p->>'follow_up_date', '')::date, follow_up_date),
      status = case when v_outcome = 'interesse' and status in ('nouveau','contacte') then 'en_discussion'
                    when v_outcome = 'refus' and status in ('nouveau','contacte','en_discussion','proposition') then 'perdu'
                    else status end,
      contact_name = case when coalesce((p->>'update_contact')::boolean, false) then coalesce(nullif(p->>'contact_name', ''), contact_name) else contact_name end,
      contact_role = case when coalesce((p->>'update_contact')::boolean, false) then coalesce(nullif(p->>'contact_role', ''), contact_role) else contact_role end,
      timeline = case when v_has_cr then coalesce(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                   'date', to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD'), 'direction', 'appel',
                   'sujet', 'Appel · ' || v_outcome, 'résumé', left(p->>'cr', 120))) else timeline end
   where id = v_lead_id;

  -- 3. La séquence : à la 1re application de l'issue, ou quand une correction l'arrête.
  if v_msg_id is not null then
    select e.* into v_enr from public.campaign_enrollments e join public.campaign_messages m on m.enrollment_id = e.id
     where m.id = v_msg_id and e.lead_id = v_lead_id for update of e;
    if v_enr.id is null then raise exception 'message_lead_mismatch'; end if;
  end if;
  if v_enr.id is not null and v_enr.status = 'active' then
    if v_outcome in ('refus', 'interesse') and (v_fresh or v_old is distinct from v_outcome) then
      update public.campaign_enrollments set status = 'stopped', stop_reason = case v_outcome when 'refus' then 'refused' else 'interested' end, updated_at = now() where id = v_enr.id;
      update public.campaign_messages set status = 'skipped', updated_at = now() where enrollment_id = v_enr.id and status = 'draft';
    elsif v_fresh and v_outcome = 'rappel' then
      update public.campaign_enrollments set next_due_at = coalesce(v_callback, now() + interval '2 days'), updated_at = now() where id = v_enr.id;
    elsif v_fresh then
      perform public.campaign_advance(v_enr.id);      -- même règle que advanceEnrollment, voir ci-dessous
    end if;
  end if;

  -- 4. La tâche (A9), une seule par appel, et pas de doublon avec une tâche déjà ouverte sur ce lead
  --    pour la même échéance (lead-hot-trigger crée ses propres « Relancer X » quand un prospect répond).
  if coalesce(p->>'task_title', '') <> ''
     and not exists (select 1 from public.tasks t where t.lead_id = v_lead_id and t.status <> 'done'
                       and t.due_date is not distinct from nullif(p->>'task_due', '')::date) then
    insert into public.tasks (title, due_date, lead_id, assigned_to, status, priority, created_by, auto_key)
    values (p->>'task_title', nullif(p->>'task_due', '')::date, v_lead_id, nullif(p->>'assigned_to', ''), 'todo', 'normale', auth.uid(), 'cr:' || v_call_id)
    on conflict (auto_key) where auto_key is not null do nothing;
  end if;

  return jsonb_build_object('call_id', v_call_id, 'fresh', v_fresh);
end $$;
revoke all on function public.apply_call_outcome(jsonb) from public, anon;
grant execute on function public.apply_call_outcome(jsonb) to authenticated;
```

`campaign_advance(enrollment_id)` reproduit `advanceEnrollment` (`_shared/campaign.ts:300`) : étape
suivante, `next_due_at = campaign_next_due(now(), wait_days, business_days)`, `done` + `finished` s'il
n'y a pas de suite ou si la suite est `stop`, avec la garde `where current_position = <position lue>`.

**Une seule implémentation du calcul de date, en SQL** (relecture du 18/09 : trois versions, TS edge,
TS front et SQL, réconciliées par une table de cas, auraient fini par diverger). `campaign_next_due`
est une fonction SQL `immutable` ; dans cette PR elle vaut `p_from + p_wait_days * interval '1 day'`,
exactement le calcul actuel. La PR 7 lui apprend les jours ouvrés, et c'est le seul endroit qui change.

Puis, dans la même PR, `completeCall` (`useCampaigns.ts:461`) et `logCall` (`useLeads.ts:83`) deviennent
deux appels à `supabase.rpc('apply_call_outcome', …)`. Ce sont aujourd'hui des suites d'écritures sans
transaction (le code le dit lui-même, `useLeads.ts:80-82`) : la fonction SQL les remplace, à
comportement égal. Comparer avant / après sur le lead de test, issue par issue (5 cas en campagne,
5 hors campagne) : mêmes lignes, mêmes valeurs.

**6b. Fonction edge `call-debrief`** (`verify_jwt` activé, plus `validateAuth` et garde
`dashboard_profiles`, comme `accueil-assistant`). Le client Supabase porte le **jeton de l'utilisateur**,
pas la clé de service : la RLS et `auth.uid()` jouent.

- `action: 'message'`, corps `{ day, text, slots: [{ n, lead_id, campaign_message_id?, call_id? }] }`.
  Le front envoie la numérotation qu'il affiche : « 3 » désigne forcément ce que l'utilisateur voit en
  3. Le serveur **revérifie** chaque identifiant en base.
  1. Découpage par le code des passages numérotés (`N :`, `prospect N :`) ; le reste part au modèle.
  2. Un seul appel Gemini 2.5 Flash (`thinkingBudget: 0`, `responseMimeType: 'application/json'`,
     30 s) avec : les passages, les appels du jour, et pour les passages sans numéro la liste des
     prospects (`id`, `name`, `contact_name`). Sortie par passage : `lead_id | null`, `confiance`,
     `issue`, `interlocuteur`, `resume` (3 lignes, au neutre), `objection`, `rqth`, `prochaine_action`
     `{ quoi, type: 'rappel' | 'tache' | 'aucune', date, heure }`, `changement_contact`.
  3. Validation serveur : `lead_id` dans la liste autorisée, sinon « à qui rattacher ? » ; issue dans
     l'énumération ; date dans le futur ; le résumé passe les interdits (`BANNED_PHRASES`) ; un chiffre
     absent du texte de l'utilisateur est retiré (aucune preuve inventée).
     🔴 **Le maillon faible n'est pas l'identifiant, c'est « Valider tout »** : un rattachement faux mais
     valide passerait tous les contrôles. Donc deux classes de cartes dans le récapitulatif :
     - **sûres**, appliquées par « Valider tout » : passage numéroté (résolu par le code, pas par le
       modèle) ou lead ayant un appel du jour, et `confiance` haute ;
     - **à confirmer**, avec une case **décochée par défaut** : lead hors séance du jour (appel entrant,
       mail reçu ailleurs), rattachement par un nom seulement avec plusieurs candidats, `confiance`
       moyenne ou basse. « Valider tout » n'applique que les cases cochées. Un seul geste de plus, et
       seulement sur les cartes qui le méritent.
  4. Écrit deux lignes `debrief_messages` (le message, la réponse avec son `recap`). Rien d'autre.
  5. Gemini en panne : réponse « je n'ai pas pu rédiger, votre texte est gardé », le message utilisateur
     est quand même enregistré.
- `action: 'apply'`, corps `{ message_id, contacts: { [lead_id]: boolean } }`.
  1. `update debrief_messages set applied_at = now() where id = $1 and applied_at is null returning recap` ;
     aucune ligne → **409 `already_applied`**.
  2. Pour chaque fiche du récapitulatif : `rpc('apply_call_outcome', …)`. Une fiche en erreur n'arrête
     pas les autres ; la réponse liste `{ lead_id, ok | erreur }` et le chat affiche l'échec en clair.
  3. Si tout a échoué, remettre `applied_at` à `null` pour permettre un nouvel essai.
- Tests : le découpage et la validation vivent dans `_shared/debrief.ts` (pur), testés par vitest :
  numéros, noms, phrase sans nom rattachée au passage précédent, correction qui l'emporte, passage
  sans fiche, numéro hors liste, identifiant falsifié refusé.
- Déploiement : `npx supabase functions deploy call-debrief --project-ref mzjzwffpqubpruyaaxew`
  (**sans** `--no-verify-jwt`). Tests négatifs : 401 sans jeton, 401 avec la clé anon, 403 pour un
  compte hors `dashboard_profiles`, 409 sur un second `apply`.

**6c. Le chat** : `src/modules/agenda/components/DebriefChat.tsx` (interface reprise de
`AssistantCard.tsx`), `src/hooks/useDebrief.ts`. Fil du jour rechargé depuis `debrief_messages`,
récapitulatif en cartes, **un seul bouton « Valider tout »**, correction par un nouveau message, puis
proposition de décaler les appels non passés. Bloc « Débrief » calculé en fin de séance (A6), bandeau
rouge « N appels sans CR » dans l'en-tête.

**6d. Le CR dans le mail suivant (A10)** : `campaign-tick` lit en une requête les CR validés des leads
du run (`lead_calls` où `debriefed_at is not null`, 2 par lead, les plus récents) et les passe à
`generateEmailDraft`. `buildPrompt` ajoute le bloc « Ce qui s'est dit au téléphone » **seulement s'il y
a un CR**. Test bloquant : sans CR, `buildPrompt` rend exactement la même chaîne qu'avant la PR
(capturer la sortie sur `main` dans un fichier de référence). Déployer `campaign-tick` **avec**
`--no-verify-jwt` (son réglage actuel).

QA de la PR sur `ZZ TEST AGENDA` : les 5 passages de l'exemple de la maquette ; vérifier en base
`lead_calls`, `leads` (dont `notes` inchangé), `timeline`, inscription, tâche ; rejouer « Valider tout »
(409) ; valider depuis deux onglets ; couper le réseau au milieu (aucune fiche à moitié écrite).

Retour arrière : `git revert` du front et redéploiement de `campaign-tick` depuis `main`. La fonction
SQL et la table du fil restent, inertes.

### PR 7 — Les automatisations qui écrivent

**7a. `agenda-tick`** (nouvelle fonction edge, modèle : `campaign-tick`) : `isAuthenticatedCronCall`
sinon `validateAuth`, client de service, délai global 60 s, réponse `{ created: {rdv_prep, rdv_cr,
weekly_review}, errors }`. Lit `agenda_automations` ; une clé à `false` saute son travail.
- A11 : RDV dont `rdv_date` tombe le prochain jour ouvré → tâche `Préparer le RDV : <titre>`,
  `due_date` = aujourd'hui, `lead_id` du RDV, `auto_key = 'rdv-prep:<id>'`.
- A12 : RDV passé, `cr_status = 'manquant'` → tâche `Écrire le CR : <titre>`, `auto_key = 'rdv-cr:<id>'`.
- A13 : le vendredi, si au moins un CR validé depuis lundi → tâche planifiée à 16:00 **heure de
  Paris**, `auto_key = 'weekly-review:<IYYY-IW>'`. Le `scheduled_at` se calcule en SQL,
  `((current_date + time '16:00') at time zone 'Europe/Paris')`, jamais dans la fonction edge (elle
  tourne en UTC : la revue s'afficherait à 17h ou 18h selon la saison). Test sur le 25/10.
- Toutes les insertions : `on conflict (auto_key) where auto_key is not null do nothing`,
  `assigned_to: 'emir'`, `priority: 'normale'`.
- Les réglages se lisent avec `value::jsonb` (`dashboard_settings.value` est `text`) ; une valeur
  illisible équivaut à « tout coupé », jamais à une erreur qui ferait échouer le cron.
- Le cron tourne du lundi au vendredi : un RDV posé un samedi ou un dimanche n'aura pas de tâche de
  prépa. Accepté : il n'y en a pas, et la prépa du lundi est bien créée le vendredi.

**7b. Migration `00058_agenda_tick.sql`** : le cron, copié sur celui de `00054` (désinscription si
existe, `net.http_post`, secret Vault `dashboard_cron_secret`, `timeout_milliseconds := 120000`) :
`'agenda-tick-daily'`, `'20 5 * * 1-5'`. Et `alter table public.campaigns add column if not exists
business_days boolean not null default false;`.

**7c. Jours ouvrés (A14)** : une seule implémentation, la fonction SQL `campaign_next_due(p_from,
p_wait_days, p_business)` créée en PR 6. Cette PR lui apprend à sauter samedi et dimanche quand
`p_business` est vrai. Les deux appelants TypeScript lui délèguent le calcul par
`rpc('campaign_next_due', …)` : `advanceEnrollment` (`_shared/campaign.ts`, il faut lui passer la
campagne) et `useCampaigns.advance`. Plus de date calculée côté TypeScript, donc rien qui puisse
diverger. **Avec `business_days = false`, la fonction rend exactement la date d'aujourd'hui** : c'est
le premier cas de son test SQL, rejoué après la migration. Une case « Compter les attentes en jours
ouvrés » dans l'onglet Séquence, à côté de la fenêtre d'envoi.

Déploiement : `agenda-tick` avec `--no-verify-jwt` ; `campaign-send` n'est **pas** redéployée si son
code ne change pas (vérifier : elle importe `advanceEnrollment`, donc elle change ; la redéployer seule,
avec `--no-verify-jwt`, puis rejouer le test d'envoi réel vers l'adresse de l'équipe et contrôler
`INBOX.Sent`, comme l'exige le CLAUDE.md).

Vérification : appeler `agenda-tick` deux fois de suite à la main → la seconde crée 0 tâche. Le
lendemain : `select status, start_time from cron.job_run_details d join cron.job j using (jobid) where
j.jobname = 'agenda-tick-daily' order by start_time desc limit 3;`.

Retour arrière : `select cron.unschedule('agenda-tick-daily');` et mettre les trois clés à `false`.

### PR 8 — Les ajustements de campagne

`campaign-insights` (edge, `verify_jwt` activé) : corps `{ campaign_id }`. Lit les CR validés des leads
inscrits depuis leur inscription, et les modèles d'étapes. Moins de 5 CR → 422 `not_enough_cr`. Gemini
en JSON : 1 à 3 propositions `{ step_id, field, before, after, why, support }`, `field` parmi
`ai_brief | subject_template | body_template | wait_days`. Le serveur écarte une proposition dont
`before` ne correspond plus au texte en base, et une proposition dont `after` contient un interdit.
N'écrit rien.

`RapportsTab.tsx` : bloc « Ce que disent les appels » (issues par étape : requête SQL simple sur
`lead_calls` joints aux messages ; objections par code), bouton « Proposer des ajustements », cartes
avant / après. « Appliquer » appelle le `updateStep` existant après avoir relu l'étape (si elle a
changé entre-temps : refus et rafraîchissement). « Écarter » est local.

### PR 9 — Mise en service

1. `src/config/navigation.ts` : entrée `agenda` juste après `accueil` (icône `CalendarDays`).
   Mettre à jour `src/test/TopNav.test.tsx` (nombre et ordre des entrées).
2. `AccueilPage.tsx` : puce « appel » dans le planning de 14 jours, lien vers `/agenda?date=`.
3. Documentation : section « Module Agenda » dans le `CLAUDE.md` du dépôt (sur le modèle de la section
   Campagnes : tableau des pièces, comportements à connaître, pièges), phase 9 dans `REFONT_PLAN.md`,
   statut de la spec.
4. **Deux semaines plus tard, pas avant**, migration de resserrage, seulement si la requête rend 0 :
   ```sql
   select count(*) from lead_calls where outcome = 'repondu';
   -- puis : contrainte ramenée aux 5 issues, et 'repondu' retiré du type CallOutcome.
   ```
5. Quatre semaines après la mise en service, lire `section_visits` pour `agenda` : c'est le critère de
   la refonte v2 (moins de 3 ouvertures par semaine pendant 4 semaines = on retire).

---

## 5. Ce qui n'est pas dans ce plan

Rappels Telegram ou mail (D5) · synchro Google Calendar ou Outlook · vue mois · redimensionner un bloc
à la souris · tâches récurrentes · sortir un appel de sa séance · enregistrement audio · numérotation
automatique · application d'un ajustement sans clic.

Deux préalables qui ne sont pas du code, sans lesquels l'agenda restera vide ou pauvre : **rédiger le
script d'appel partagé** (`leads_script`, aujourd'hui « à rédiger » partout) et **inscrire des contacts
dans la campagne**. Les premiers appels tombent 4 jours après les premiers mails validés.

---

## 6. Données de test et nettoyage

Création (une fois, à la main, dans l'UI) : lead `ZZ TEST AGENDA`, type `cfa`, statut `nouveau`,
adresse et téléphone de l'équipe ; campagne `ZZ TEST`, en brouillon, copie des 5 étapes ; inscription
du lead ; « Actualiser » pour préparer les brouillons. Pour obtenir un appel dû sans attendre 4 jours :
« Sauter cette étape » sur le Mail 1, puis ramener `next_due_at` à maintenant **sur cette inscription
seulement**.

Nettoyage, dans cet ordre (`tasks.lead_id` n'est pas en cascade) :

```sql
delete from tasks where lead_id in (select id from leads where name = 'ZZ TEST AGENDA');
delete from debrief_messages where day >= current_date - 30 and recap::text like '%ZZ TEST AGENDA%';
delete from leads where name = 'ZZ TEST AGENDA';        -- cascade : inscriptions, messages, lead_calls
delete from campaigns where name = 'ZZ TEST';           -- cascade : étapes
```

Contrôle final : `select count(*) from leads where name like 'ZZ TEST%';` → 0.

---

## 7. Si quelque chose tourne mal

| Symptôme | Geste immédiat | Ensuite |
|---|---|---|
| L'agenda plante | il n'est pas dans la nav avant la PR 9 : rien à faire pour les autres écrans ; `git revert` de la PR | — |
| Une automatisation crée trop de tâches | passer sa clé à `false` dans `agenda_automations` | `delete from tasks where auto_key like 'rdv-%' and status <> 'done' and created_at > '<date>'` après relecture |
| Le cron `agenda-tick` échoue | `select cron.unschedule('agenda-tick-daily');` | lire `cron.job_run_details` et les logs de la fonction |
| Un CR a mal mis à jour une fiche | la fiche se corrige à la main ; `lead_calls.cr_data` garde ce qui a été écrit et par qui | corriger la règle, ajouter le cas aux tests |
| Un brouillon de mail cite mal un appel | il est dans la Revue, pas envoyé : le corriger ou le sauter | retirer le bloc CR du prompt en redéployant `campaign-tick` depuis `main` |
| Une fonction edge répond 401 au cron | son `verify_jwt` a changé au déploiement : la redéployer avec le bon réglage (§ 0) | — |
| Doute sur une migration | ne rien supprimer : les ajouts sont inertes | en parler avant tout `drop` |
