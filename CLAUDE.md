# MEMOVIA Dashboard — Instructions Claude Code

## Projet
Dashboard interne de pilotage business pour MEMOVIA AI (EdTech SaaS français).
Repo séparé de app.memovia.io. Ne jamais modifier le code de la plateforme principale depuis ce repo.

## Stack technique
- **Frontend** : React + TypeScript + Vite
- **UI** : Tailwind CSS + shadcn/ui
- **Backend/DB** : Supabase (projet existant : mzjzwffpqubpruyaaxew)
- **Auth** : Supabase Auth (email/password + magic link)
- **Realtime** : Supabase Realtime
- **Edge Functions** : Supabase Edge Functions (Deno/TypeScript)
- **Déploiement** : Vercel

## Règles absolues
1. Ne jamais écrire de clé API ou secret en dur dans le code — toujours `.env.local`
2. Ne jamais modifier les tables Supabase existantes de app.memovia.io sans validation explicite
3. Toutes les clés sont en lecture seule sur les données MEMOVIA (jamais d'écriture destructive)
4. Chaque Edge Function doit valider l'authentification avant d'exécuter quoi que ce soit
5. Commits atomiques et descriptifs en français
6. Tests sur chaque module avant de passer au suivant

## Variables d'environnement requises
Voir `.env.example` pour la liste complète. Créer `.env.local` avec les vraies valeurs.
Ne jamais committer `.env.local` (déjà dans `.gitignore`).

## Structure des dossiers
```
src/
  components/     → composants réutilisables
  modules/        → un dossier par module (stripe/, qonto/, crm/, etc.)
  lib/            → clients API (supabase.ts, stripe.ts, qonto.ts...)
  hooks/          → custom hooks React
  types/          → types TypeScript globaux
supabase/
  functions/      → Edge Functions
  migrations/     → migrations SQL
public/
  assets/         → logos MEMOVIA (SVG/PNG fond transparent)
```

## Modules à construire (dans cet ordre)
1. Auth + Layout général (sidebar, navigation)
2. Overview (métriques clés temps réel)
3. Stripe & Finance
4. Qonto Trésorerie
5. Contrats B2B
6. Prospection / CRM
7. Tâches intelligentes (Kanban + suggestions IA)
8. Calendrier partagé (Google Calendar + Outlook)
9. Utilisateurs MEMOVIA (lecture DB existante)
10. Realtime (connexions live sur app.memovia.io)
11. Roadmap & Feedback utilisateurs
12. Email Hostinger (IMAP/SMTP via Edge Function)
13. GitHub
14. SEO & Blog (génération IA + DataForSEO)
15. Copilote IA (agent avec accès à tous les modules)

## Skills installés
- gstack : /office-hours, /plan-ceo-review, /plan-eng-review, /review, /qa, /ship, /retro, /autoplan
- frontend-design : qualité visuelle production
- Emil Kowalski : animations et motion
- Impeccable : /polish pour nettoyer l'UI après chaque module
- Taste Skill : références visuelles réelles

## Workflow obligatoire
Avant de coder un nouveau module :
1. /plan-eng-review sur le module
2. Implémenter
3. /polish sur l'UI produite
4. /qa sur le rendu
5. /review sur le code
6. Commit propre

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
