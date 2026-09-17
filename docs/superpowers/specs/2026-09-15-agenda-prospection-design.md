# Agenda de prospection (appels, fiche d'appel, CR), spec du 15/09/2026

Statut : **brouillon à valider**. Maquette cliquable (données fictives) :
`maquette-agenda-prospection-2026-09-15.html`, dans ce dossier. S'appuie sur le module Campagnes
(`2026-09-15-campagnes-design.md`) et sur des rituels d'agenda éprouvés : priorités du jour posées
dans l'agenda, fiche de prépa avant un échange, CR avec actions datées réinjectées dans la fiche,
revue de fin de semaine.

## Ce que ça fait

Un onglet **Agenda** montre, façon Outlook, qui appeler chaque jour et pourquoi : les étapes
d'appel des campagnes (J+4, J+18), les rappels promis, les relances de leads, les RDV. Un clic
ouvre une **fiche d'appel** lisible en 30 s. Pendant la séance, on note l'issue en un geste. Juste
après la séance, un **débrief** rédige un CR écrit par appel ; on le corrige et on le valide. Le CR
validé met à jour le lead, nourrit le mail suivant du contact et, cumulé sur la campagne, sert à
proposer des ajustements de séquence que l'on applique ou écarte à la main.

## Principes

- **Rien ne part et rien ne change sans validation** : CR, prochaine action, ajustement de campagne.
- **Pas de rédaction à la main** : l'humain donne la matière (note, dictée du clavier du téléphone),
  l'IA rédige, l'humain corrige.
- **Un seul clic de validation par séance**, pas un par prospect : l'IA rattache chaque passage à sa
  fiche, l'humain relit et valide en bloc ; un rattachement douteux revient en question avant
  d'écrire, jamais en écriture.
- **Pas de rappel push en v1.** L'agenda signale en rouge tout appel enregistré sans CR, comme les
  RDV sans CR. Un rappel (Telegram ou autre) ne s'ajoute que si `section_visits` montre que
  l'onglet n'est pas ouvert les jours d'appel.
- Section comptée dans `section_visits` (`agenda`), même critère de suppression que les autres.
- Appels passés au téléphone : conçu au pouce d'abord, desktop ensuite.

## Ce que l'agenda affiche (calculé, aucune table d'événements)

| Élément | Source | Date |
|---|---|---|
| Appel de campagne dû | `campaign_messages` `kind='call'`, `status='draft'`, jointure inscription, lead, étape, campagne | `due_at` (jour, Europe/Paris), retards inclus |
| Appel de campagne prévu | inscription active dont l'étape courante est un appel (`next_due_at`), ou dont l'étape suivante est un appel (`next_due_at` + `wait_days`, marqué « estimé ») | projection d'une seule étape, en pointillé |
| Appel fait, CR à écrire | `lead_calls` du jour avec `debriefed_at is null` | `called_at` |
| Relance lead | `leads.follow_up_date`, non archivé, statut prospect, sans appel de campagne dû le même jour | `follow_up_date` |
| RDV | `rdv.rdv_date` | heure réelle |
| Mails à valider | compteur des brouillons mail dus | lien vers la Revue |

## Écran `/agenda`

- En-tête : bascule **Jour / Semaine**, flèches, « Aujourd'hui », « à jour il y a X min » et
  Actualiser (snapshot, pas de temps réel). Bandeau rouge « N appels sans CR » s'il y en a, tous
  jours confondus, qui ouvre le débrief.
- **Vue jour** (défaut) : grille horaire. Un bloc **Séance d'appels** sur le créneau réglé dans
  `dashboard_settings.agenda_call_window` (défaut : lundi à jeudi, 9h à 11h30, créneaux de
  10 min). Les appels du jour s'y placent dans l'ordre de priorité ; au-delà de la capacité du bloc,
  ils sont listés « à reporter » avec « Décaler à demain ». Les RDV à leur heure.
- **Ordre de priorité** (du plus fort au plus faible) : rappel promis arrivé à terme ; étape de
  campagne en retard ; étape de campagne du jour ; relance lead en retard ; relance du jour.
  Ex æquo : maturité la plus chaude, puis dernier contact le plus ancien.
- **Vue semaine** : grille horaire lundi à vendredi, 8h à 18h, façon Outlook : une colonne par
  jour, une ligne « journée » en haut (appels sans CR, rappel promis, appels dus hors créneau,
  revue du vendredi, tâches sans heure), puis les blocs : séance d'appels, RDV, tâches planifiées.
  L'en-tête reste visible au défilement ; un clic sur un jour ouvre la vue jour.
- **Blocs déplaçables**, en vue jour comme en vue semaine : séance d'appels, RDV et tâches se
  déplacent à la souris ou au doigt (poignée), par pas de 15 min, entre jours et heures ; un fantôme
  suit le pointeur avec l'heure d'arrivée et un cadre pointillé montre le créneau. Un clic sur un
  créneau vide crée (tâche, RDV ou séance) ; un clic sur un bloc ouvre sa modification dans le
  panneau.
- **Mobile** : la vue jour devient une liste de cartes (appels, tâches, RDV), bouton Appeler
  (`tel:`) sur chaque carte, fiche en plein écran. La vue semaine reste une grille, en défilement
  horizontal ; le déplacement se fait par la poignée du bloc, ou par le formulaire (jour, heure).

## Tâches, façon Outlook

- Les tâches sont celles du dashboard (`tasks`, déjà liées aux leads par `lead_id`, déjà relancées
  par le briefing quand elles sont échues). L'Agenda en devient l'écran d'action, comme le volet
  « Ma journée » d'Outlook.
- Une tâche a une échéance et, en option, un créneau. Sans créneau, elle apparaît dans la ligne
  « journée » de son jour et dans la liste « Tâches · aujourd'hui » du panneau ; avec un créneau,
  c'est un bloc sur la grille.
- **Créer** : champ « Nouvelle tâche » du panneau (échéance du jour, sans heure), ou clic sur un
  créneau vide (avec heure) : titre, durée, lead lié. Le même clic crée aussi un RDV ou une séance
  d'appels supplémentaire.
- **Modifier** : clic sur la tâche ; titre, jour, heure ou « sans heure », durée, lead, terminée,
  supprimer. Cocher la case termine la tâche (`status = 'done'`), la ligne se barre.
- **Déplacer** : glisser la tâche depuis le panneau ou la ligne « journée » vers un créneau (elle
  reçoit une heure), d'un créneau à un autre, ou vers la ligne « journée » (elle perd son heure).
  Le RDV et la séance d'appels se déplacent de la même façon ; une séance déplacée emmène les appels
  du jour.
- Une tâche liée à un lead apparaît dans sa fiche d'appel (« Engagements ouverts »), comme dans la
  fiche lead aujourd'hui.

## Fiche d'appel

Panneau latéral sur desktop, plein écran sur mobile, dans cet ordre :

1. **Qui** : établissement, contact et rôle, téléphone cliquable, campagne et étape
   (« CFA · référent handicap › Appel au standard, J+4 »).
2. **Objectif de l'appel** : consigne de l'étape (`campaign_steps.ai_brief`) ; hors campagne,
   `leads.next_action`.
3. **Où on en est** : fil de la séquence (mail 1 envoyé le…, réponse : aucune), dernier mail replié.
4. **Pourquoi eux et pitch** : `leads.why`, `leads.pitch`.
5. **À poser pendant l'appel** : section « Questions de qualification » du script partagé
   (`leads_script`), et « nom du référent à confirmer » tant que l'interlocuteur n'a pas été confirmé
   par un CR.
6. **Interdits** : la liste déjà vérifiée avant chaque envoi (`_shared/campaignText.ts`), en lecture.
7. **Historique** : CR des appels précédents, engagements ouverts (`tasks.lead_id`).

Barre collante en bas : les 5 issues (Joint, Pas répondu, Rappel demandé, Refus, Intéressé) et une
note rapide facultative. Cette barre est un raccourci, pas un passage obligé : l'issue peut aussi
être donnée dans le chat du débrief, qui enregistre alors l'appel. « Enregistrer » applique l'issue tout de suite, comme `completeCall`
aujourd'hui (avancer, rappeler à +2 j, arrêter), et crée l'appel « CR à écrire ». Le composant
d'issue est extrait de `ReviewTab` et partagé ; l'étape d'appel de la Revue renvoie vers la fiche
Agenda, seul endroit où l'on appelle.

## Débrief : un chat pour toute la séance

- **Un seul fil par jour**, dans le panneau de l'Agenda (plein écran sur mobile), gardé en base.
  Bouton « Débriefer la séance » dès qu'un appel est enregistré sans CR ; pas de cron.
- **On raconte la séance en une fois**, au clavier ou à la dictée du téléphone, sans cliquer sur
  chaque prospect : « 1 : … 2 : … » avec le numéro de l'appel dans la séance du jour, ou par nom
  d'établissement, de ville ou de contact. Un échange hors agenda (appel entrant, mail reçu
  ailleurs) se dit dans le même fil ; l'IA cherche alors le lead parmi tous les leads.
- **Rattachement** (`call-debrief`, action `message`) : Gemini 2.5 Flash, `thinkingBudget: 0`,
  sortie JSON. Chaque passage est rattaché à un appel du jour ou à un lead ; un passage ambigu ou
  sans correspondance revient en question (« à qui rattacher ? »), **jamais deviné**. Pour chaque
  passage rattaché, l'IA rend :
  - `issue` : déduite du texte ; si l'appel était déjà enregistré avec une autre issue, une
    correction est proposée, pas appliquée ; si l'appel n'était pas enregistré, il le sera à la
    validation ;
  - `interlocuteur` : nom, rôle, confirmé (oui ou non) ; un changement de contact détecté
    (« c'est M. X maintenant ») est proposé avec une case cochée par défaut ;
  - `resume` : 3 lignes au plus, au neutre, rien de personnel hors cadre professionnel ;
  - `objection` : un code parmi `mauvais_interlocuteur`, `pas_de_budget`, `deja_equipe`,
    `pas_le_moment`, `pas_concerne`, `veut_de_la_doc`, `autre`, ou rien ;
  - `qualification` : nombre d'apprentis RQTH déclarés s'il a été donné, sinon `null` ;
  - `prochaine_action` : quoi, date, qui ; sans date pour un rappel ou une démo, l'IA le signale ;
  - l'effet sur le lead et sur la séquence, en clair.
- **Le récapitulatif** est une réponse du chat : une carte par fiche, passages rédigés par l'IA
  surlignés, et **un seul bouton « Valider tout »** pour la séance. Deux sortes de cartes : les
  **sûres** (appel numéroté ou lead ayant un appel du jour, rattachement sans ambiguïté), que
  « Valider tout » applique ; et les cartes **à confirmer**, avec une case décochée par défaut
  (échange hors séance, nom qui désigne plusieurs leads, doute de l'IA). Un rattachement faux mais
  valide est le vrai risque de ce chat : il ne s'écrit jamais sans ce geste. Une correction se dit dans le
  chat (« 2 : jeudi 9h30 »), le récapitulatif se met à jour. Après validation, l'IA liste ce qui a
  été écrit et propose de décaler à demain les appels prévus non passés.
- **« Valider tout »** (`call-debrief`, action `apply`) écrit, fiche par fiche, en une fois et une
  seule (garde `debriefed_at is null`, 409 sinon) :
  - `lead_calls` : création si l'appel n'était pas enregistré ; `cr` (markdown), `cr_data` (JSON),
    `objection`, `debriefed_at`, `debriefed_by` ;
  - `leads` : `next_action` et `follow_up_date` si une date est donnée ; `status` seulement pour
    Intéressé (en discussion) et Refus (perdu) ; contact et rôle seulement si la case est cochée ;
    une entrée de timeline `direction: 'appel'` ;
  - inscription : mêmes règles que l'issue saisie dans la fiche (arrêt sur Refus ou Intéressé,
    rappel à la date donnée sinon +2 j, avancement sinon) ; une correction d'issue vers Refus ou
    Intéressé arrête la séquence et ignore les brouillons ;
  - **jamais `leads.notes`** (écrasé par le détecteur, voir plus bas), jamais un champ que le CR
    ne détermine pas.

## Boucle vers la campagne

- **Par contact, sans action de plus** : `buildPrompt` (`_shared/campaign.ts`) ajoute un bloc
  « Ce qui s'est dit au téléphone » avec les 2 derniers CR validés du lead (résumé, objection,
  prochaine action). Le mail suivant peut évoquer l'échange, sans verbatim ni chiffre donné
  oralement. Il passe par la Revue comme tout mail.
- **Par campagne, à la demande** : dans Campagnes › Rapports, un bloc « Ce que disent les appels »
  (issues par étape, objections par code) et un bouton « Proposer des ajustements ». Il appelle
  `campaign-insights`, qui lit les CR validés et les modèles d'étapes, puis rend 1 à 3
  propositions : étape, champ (`ai_brief`, `subject_template`, `body_template`, `wait_days`),
  avant et après, pourquoi, et nombre de CR qui l'appuient.
  - Chaque proposition : **Appliquer** (via `updateStep`, un corps modifié repasse les contrôles)
    ou **Écarter**.
  - Aucune proposition sous 5 CR validés dans la campagne : on ne réécrit pas une séquence sur deux
    appels.

## Données (migration 00056)

- `lead_calls` (table vide au 15/09/2026, rien à reprendre) :
  - CHECK `outcome` **élargi** aux 5 issues `joint | pas_repondu | rappel | refus | interesse`, en
    gardant `repondu` tant que l'ancien front tourne (le resserrage vient en dernier, après contrôle
    qu'aucun `repondu` n'existe) ; `completeCall` n'écrase plus les issues et `LogCallDialog` /
    `useLeads.logCall` passent aux mêmes 5 valeurs ;
  - `campaign_message_id uuid null` vers `campaign_messages(id)`, `on delete set null`, unique ;
  - `cr text`, `cr_data jsonb`, `objection text` (CHECK sur les codes), `debriefed_at timestamptz`,
    `debriefed_by uuid` ;
  - index `(lead_id, called_at desc)` ;
  - RLS inchangée (policy admin unique, anon révoqué).
- Type de timeline (`src/types/leads.ts`, `_shared/campaign.ts`) : `direction` accepte `'appel'`.
- `dashboard_settings` : clé `agenda_call_window`
  `{"days":[1,2,3,4],"start":"09:00","end":"11:30","slot_minutes":10}`.
- `debrief_messages` : `id`, `day date`, `role` (`user` | `assistant`), `content text`,
  `recap jsonb` (le récapitulatif proposé, s'il y en a un), `applied_at`, `created_by`,
  `created_at`. Une conversation par jour et par personne ; RLS admin unique, anon révoqué.
- `tasks` : `scheduled_at timestamptz null` (le créneau ; sans lui la tâche est « sans heure » sur
  son jour d'échéance), `duration_min int not null default 30` et `auto_key text` unique (clé des
  tâches créées automatiquement, pour ne jamais les créer deux fois). `due_date`, `status` et
  `lead_id` existent déjà. La table a 7 autres consommateurs : colonnes ajoutées seulement.
- `lead_calls.callback_at timestamptz` : la date du rappel promis, qui remonte l'appel en tête de
  séance ce jour-là.
- `campaigns.business_days boolean not null default false` : les attentes entre étapes sautent le
  week-end quand la case est cochée. Décochée, rien ne change.
- `agenda_sessions` : `day date primary key`, `start_min int`, `end_min int` ; une ligne seulement
  quand la séance d'appels d'un jour a été déplacée par rapport au créneau par défaut.
- Un RDV déplacé sur la grille met à jour `rdv.rdv_date` ; sa durée vient d'une nouvelle colonne
  `rdv.duration_min int not null default 45`.

## Correctif préalable : le détecteur de leads n'écrase plus un lead existant

`email-lead-detector/index.ts:366-379` remplace, sur un lead existant, `notes`, `status`,
`next_action`, `timeline` et `relance_count` par l'analyse IA du fil mail. Un prospect de campagne
qui répond peut donc déjà perdre ses entrées « envoyé » et son statut, et perdrait demain ses
entrées d'appel. Correctif :
- timeline **fusionnée** (entrées absentes ajoutées, dédoublonnage sur date et sujet) ;
- statut jamais rétrogradé ;
- `notes` et `next_action` non vides conservés.

À livrer en premier, indépendamment de l'Agenda : il protège déjà Campagnes.

## Edge functions

- `call-debrief` (nouvelle) : action `message` (rattachement et récapitulatif ; n'écrit que le
  fil dans `debrief_messages`) et action `apply` (écritures ci-dessus, garde anti double
  validation). `validateAuth` et garde admin.
- `campaign-insights` (nouvelle) : propositions d'ajustement, n'écrit rien.
- `campaign-tick` : lit les 2 derniers CR validés du lead pour le prompt. Sans CR, le prompt est
  identique à aujourd'hui.
- `agenda-tick` (nouvelle) et son cron `agenda-tick-daily` (05:20 UTC, lundi à vendredi) : crée,
  une seule fois chacune grâce à `tasks.auto_key`, la tâche de prépa d'un RDV la veille ouvrée, la
  tâche « Écrire le CR » d'un RDV passé sans CR, et la revue du vendredi. Chaque travail se coupe
  dans `dashboard_settings.agenda_automations`.
- Toute écriture d'un appel (issue, CR, fiche, historique, séquence, tâche) passe par la fonction
  SQL `apply_call_outcome` : une transaction par fiche. `completeCall` et `logCall` l'appellent
  aussi, à comportement égal.

## Front

- `src/modules/agenda/AgendaPage.tsx`, composants `CalendarGrid` (une seule grille pour le jour et
  la semaine : colonnes de jours, ligne « journée », blocs positionnés par heure), `CallSheet`,
  `CallOutcomeBar` (extrait de `ReviewTab`), `TaskPanel` (liste, création, modification),
  `DebriefChat` (interface reprise de `AssistantCard`).
- Glisser-déposer avec `@dnd-kit` (déjà installé, utilisé par le kanban Leads) : capteurs souris et
  tactile (poignée), pas de 15 min, fantôme avec l'heure d'arrivée, zone « journée » qui n'accepte
  que les tâches.
- `src/hooks/useAgenda.ts`, motif maison du dépôt (state, fetch, refresh manuel).
- `src/lib/agenda.ts`, logique pure testée par vitest : priorisation, placement dans le créneau,
  projection des appels prévus, week-ends sautés.
- Navigation : entrée « Agenda » juste après Accueil. Accueil : puces « appel » dans le planning de
  14 jours, lien vers `/agenda?date=`.
- Pas de react-big-calendar : grille en CSS (colonnes et positions absolues), liste sur mobile en
  vue jour. **Rien ne dépend de l'ancien module calendrier**, dont la suppression prévue vers le
  17/09 peut suivre son cours.

## Point remonté par la maquette : le J+4 tombe toujours le lundi

Avec des envois du lundi au jeudi et un appel à J+4 calendaires, un mail du jeudi donne un appel le
lundi, un mail du lundi un appel le vendredi (hors créneau, donc lundi aussi) : **tous les appels
J+4 s'empilent le lundi**. À trancher côté Campagnes, pas côté Agenda : compter `wait_days` en
jours ouvrés, ou laisser l'Agenda étaler les appels dus sur les jours suivants selon la priorité et
la capacité du créneau.

## Préalables non techniques

- Rédiger le script partagé (`leads_script`, aujourd'hui « à rédiger ») : au moins les sections
  « Questions de qualification » et « Objections courantes », que la fiche affiche.
- Lancer la campagne : l'agenda reste vide sans inscrits ; les premiers appels tombent 4 jours après
  les premiers mails validés.

## Tests

- vitest : `lib/agenda.ts`, lecture du JSON de CR, fusion de timeline du détecteur.
- vitest sur la grille : placement et pas de 15 min, bornes 8h–18h, une tâche déposée dans la
  ligne « journée » perd son heure, un RDV ou une séance ne peut pas y être déposé.
- vitest sur le rattachement des passages : numéro de séance, nom de ville, de contact ou
  d'établissement, phrase sans nom rattachée au passage précédent, correction qui l'emporte sur le
  passage initial, passage sans fiche laissé en question.
- Test réel sur un lead fictif avec adresse et téléphone de l'équipe, jamais un vrai prospect :
  vérifier en base `lead_calls`, lead, timeline, inscription.
- Cas négatifs : CR validé deux fois (409), appel déjà enregistré dans un autre onglet, détecteur
  rejoué sur un lead qui porte des entrées `appel` (timeline conservée).

## Chantier, dans l'ordre

Le plan détaillé, PR par PR, avec les règles pour ne rien casser et la liste des automatisations :
`docs/superpowers/plans/2026-09-17-agenda-prospection.md`. Il fait foi sur l'ordre ci-dessous.

1. PR correctif détecteur (fusion de timeline, statut non rétrogradé).
2. PR migration 00056, 5 issues partout, onglet Agenda (grille jour et semaine, fiche, tâches,
   glisser-déposer), nav, puces Accueil.
3. PR `call-debrief`, chat de débrief (`debrief_messages`), CR dans le prompt des mails.
4. PR `campaign-insights` et bloc « Ce que disent les appels » dans Rapports.

## Hors périmètre v1

Rappels push (Telegram, mail) · synchro Google Calendar ou Outlook · enregistrement audio dans le
navigateur · vue mois · redimensionner un bloc à la souris · tâches récurrentes · sortir un appel de
sa séance pour le placer seul · numérotation automatique · application automatique d'un ajustement
de campagne.
