# Contexte Business MEMOVIA AI

## Qui sommes-nous
MEMOVIA AI est une plateforme EdTech SaaS française qui génère automatiquement
du contenu pédagogique à partir de documents (PDF, DOCX, PPTX, MP3, TXT).

**Co-fondateurs :**
- Naoufel (CTO) — Toulouse, France. Développement produit, tech, stratégie.
- Emir Boutaleb (BizDev) — Italie (télétravail). Commercial, partenariats.
  Disponibilité MEMOVIA : ~50% de son temps. Fuseau horaire : UTC+1/+2 (même que Naoufel).

**Incubation :** TBSeeds / French Tech Toulouse
**Premier client B2B :** CFA Compagnons du Devoir (30 licences, contact : Antoaneta)

## La plateforme app.memovia.io
- **Stack :** React + TypeScript + Supabase (projet ID : mzjzwffpqubpruyaaxew)
- **Couleurs :** Violet #7C3AED + Cyan #00E5CC sur fond sombre
- **Modèles IA :** GPT-4o-mini + Gemini 2.5 Flash
- **6 types de contenu générés :** Résumé, Fiche de révision, Quiz, Flashcards, Carte mentale, Podcast
- **Formats d'import :** PDF, DOCX, PPTX, MP3, TXT (max 20 Mo)

**Tarification :**
- B2B : 12€/licence/mois (illimité sauf podcasts : 7/mois/user)
- B2C Free : système de crédits (100 crédits à l'inscription)
- B2C Payant : 29€/mois (illimité sauf podcasts : 7/mois)

**Fonctionnalité phare :** Quiz Live — les enseignants lancent des quiz en temps réel,
les participants rejoignent via QR code ou app.memovia.io/live sans compte,
jusqu'à 100 participants simultanés avec classement live.

## Utilisateurs du dashboard (ce projet)
Ce dashboard est un outil interne — PAS accessible aux clients MEMOVIA.

| Utilisateur | Rôle | Accès |
|------------|------|-------|
| Naoufel | Admin / CTO | Tout |
| Emir | Admin / BizDev | Tout sauf infos techniques |
| Collaborateurs futurs | Limité | Selon rôle assigné |

## Intégrations requises

### Supabase (existant)
- Projet ID : mzjzwffpqubpruyaaxew
- Accès en LECTURE SEULE sur les tables existantes (users, organizations, subscriptions)
- Nouvelles tables créées dans ce même projet pour le dashboard

### Stripe
- Récupération : MRR, abonnés, churns, transactions, revenus
- Lecture seule via Edge Function (clé secrète jamais côté client)

### Qonto
- Récupération : solde compte, transactions, flux entrants/sortants
- API REST, polling toutes les heures via cron Supabase
- Alertes si solde sous seuil configurable

### Google Calendar
- Agenda de Naoufel
- Création d'événements depuis le dashboard
- Génération de liens Google Meet en un clic

### Microsoft Outlook (Graph API)
- Agenda pro d'Emir (son travail en Italie)
- Lecture seule pour voir ses disponibilités réelles
- Fusion avec son Google Calendar perso

### Hostinger Email
- IMAP : imap.hostinger.com:993 (lecture emails via Edge Function)
- SMTP : smtp.hostinger.com:465 (envoi depuis le dashboard)
- Notifications in-app si email non lu depuis +24h sur mots-clés critiques
- Mots-clés critiques : contrat, devis, résiliation, facturation, urgent

**Module 12 — Détection automatique de leads via IMAP :**
Edge Function analyse les emails entrants avec Claude. Si un lead potentiel est
détecté (demande de démo, renseignement tarif, contact commercial…) → création
automatique dans la table `leads` avec `status = 'nouveau'` et `canal = 'email'`.
Champ `notes` pré-rempli avec l'objet et l'expéditeur. Éviter les doublons via
vérification sur l'adresse email ou le nom de domaine expéditeur.

### GitHub
- API REST : derniers commits, issues ouvertes, PRs, statut déploiements
- Repo : app.memovia.io
- Utile principalement pour Naoufel

### DataForSEO
- Recherche mots-clés (volume, difficulté, intent)
- Analyse SERP (top 10 Google sur un mot-clé donné)
- Score On-Page des articles générés
- Pay-as-you-go, Standard Queue ($0.0006/requête)

### memovia.io (site vitrine)
- Connecté au même projet Supabase (mzjzwffpqubpruyaaxew)
- Tables dédiées : blog_articles, blog_categories
- Construit sur Lovable.dev (pas de DB propre, connexion Supabase à faire)

## Contexte compétitif et financier
- Projections CA : ~38k€ an 1, 102k€ an 2, 190k€ an 3
- Marge brute : 86%
- Coût API : ~0,17$/user/mois
- Financement : Crealia 30k€ + BPI French Tech 30k€
- Concours CRECE deadline : 28 mai 2026

## Données sensibles
Toutes les clés API, tokens et credentials sont dans `.env.local`.
Ne jamais les afficher dans l'UI, les logs ou les commits.
