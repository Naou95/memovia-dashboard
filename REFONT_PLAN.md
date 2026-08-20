# Refonte v2 — MEMOVIA Dashboard (décidée le 20/08/2026)

> Remplace l'ancien plan « style Qonto » (re-skin des 18 modules, abandonné : le problème
> n'était pas le thème, c'était que rien ne justifiait d'ouvrir l'outil).

## Les 3 règles de la v2

1. **Un écran existe s'il est un système d'enregistrement (la donnée ne vit que là) ou s'il
   permet d'agir.** Un miroir en lecture seule d'un outil natif (Gmail, GitHub…) est supprimé.
2. **Push d'abord.** Le briefing Telegram quotidien est la porte d'entrée ; le dashboard est la
   page d'atterrissage des liens du briefing, jamais une destination à mémoriser.
3. **Critère de kill instrumenté** : compteur de visites par section. Une section ouverte
   < 3 fois/semaine pendant 4 semaines est supprimée, pas améliorée.

## Architecture cible — 5 sections (top-bar, pas de sidebar)

| Section | Type | Contenu |
|---|---|---|
| **Leads** | écriture, mobile-first | Liste CFA France (offre accessibilité), fiche lead avec **script d'appel affiché** + docs de vente attachés, log d'appel en < 30 s. Base = module prospection existant, liste actuelle archivée (périmée vs stratégie). |
| **RDV** | écriture, mobile-first | Un RDV/appel = une fiche. Audio uploadé → transcription → **compte rendu généré** (au neutre, sans attribution de locuteur) ; saisie manuelle en secours. Fiche sans CR = état anormal → rappel briefing. Google Calendar déjà branché (OAuth existant). |
| **Financements** | écriture | Concours & subventions : statut (veille → à déposer → déposé → jury → résultat), deadline, **prochaine action + qui**, docs. Rappels J-7 / J-1 dans le briefing. |
| **Argent** | lecture | Fusion Stripe + Qonto en un écran : solde, runway, MRR, mouvements avec deltas. Fetchers existants (`get-stripe-*`, `get-qonto-*`). |
| **Bugs** | lecture | Erreurs Sentry avec **l'utilisateur affecté**, deep link Sentry. Base = module monitoring. |

Supprimés/archivés : overview, email, github, seo, analytics, realtime, api-costs, copilot,
tasks, roadmap, calendar (absorbé par RDV), utilisateurs. Admin = utilitaire caché.

## Règles UX (s'appliquent partout)

- Thème **clair unique**, shadcn par défaut, une couleur d'accent, rouge réservé aux vrais
  problèmes. Zéro design system custom.
- Tables denses plutôt que cards, `tabular-nums` alignés à droite, delta vs hier/semaine à
  côté de chaque chiffre.
- **Horodatage partout** (« à jour il y a X min »). Un fetch en échec affiche l'échec, jamais
  l'ancienne valeur en silence.
- Chaque chiffre lu est un **deep link** vers l'outil natif où l'on agit.
- Leads et RDV se conçoivent au pouce sur téléphone d'abord (usage Emir), desktop ensuite.
- Snapshot + refresh manuel, pas de temps réel.

## Phases

### Phase 0 — Démolition & navigation
- [x] Top-bar 5 entrées (Leads, RDV, Financements « bientôt », Argent, Bugs), suppression de la sidebar et de la bulle copilot
- [x] Routes des modules retirés **conservées à leur URL** (liens du briefing Telegram intacts) mais retirées de la nav ; suppression réelle en Phase 6
- [x] Compteur de visites par section (table `section_visits`, 1 insert par ouverture)

### Phase 1 — Leads (CFA France)
- [ ] Archiver les leads existants (flag `archived`, pas de delete)
- [ ] Champs fiche : script d'appel (markdown), docs attachés, prochaine action + date
- [ ] Log d'appel < 30 s : issue (répondu/non/rappel), note courte, horodatage auto
- [ ] Vue mobile : liste triée par prochaine action, fiche lisible pendant un appel

### Phase 2 — RDV & comptes rendus
- [ ] Table `rdv` : lien lead optionnel, lien événement Google Calendar, statut CR
- [ ] Upload audio sur la fiche → edge function transcription (même fournisseur que l'app)
      → CR généré (résumé + décisions + prochaine action), éditable
- [ ] Saisie manuelle en secours (formulaire court)
- [ ] Briefing : « RDV d'hier sans compte rendu » tant que le CR manque

### Phase 3 — Financements & concours
- [ ] Table `financements` + CRUD (statut, deadline, prochaine action, responsable, docs)
- [ ] Seed : Handitech 2143-Emploi (dépôt 1/09, jury 14-15/09, 13/10 Paris, 16/11 remise),
      Agefiph AMI Handinnov, prêts d'honneur, concours cash
- [ ] Briefing : rappel J-7 et J-1 sur chaque deadline

### Phase 4 — Argent
- [ ] Un écran fusionné Stripe + Qonto sur les fetchers existants, deltas, horodatage,
      deep links vers Stripe/Qonto

### Phase 5 — Bugs
- [ ] Monitoring recentré : issue Sentry + utilisateur affecté + occurrence
- [ ] Vérifier que l'app envoie l'identité utilisateur à Sentry (sinon l'ajouter côté app)

### Phase 6 — Briefing enrichi & ménage
- [ ] Briefing Telegram : leads chauds, RDV sans CR, deadlines financements, bugs nouveaux,
      avec deep links vers les sections
- [ ] Après 4 semaines : suppression réelle des modules archivés jamais rouverts
      (edge functions et crons associés compris)

## Règles de chantier

- Une phase = une branche = une PR. `npm run typecheck` comparé à la baseline de main
  (re-mesurée) avant chaque push.
- Tester chaque écran en vue mobile avant de fermer la phase.
- Les clés restent en lecture seule sur les données MEMOVIA ; les nouvelles tables
  (leads, rdv, financements, section_visits) vivent dans le schéma du dashboard.
