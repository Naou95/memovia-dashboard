# MEMOVIA Dashboard — Instructions Claude Code

## Projet
Dashboard interne de pilotage business pour MEMOVIA AI (EdTech SaaS français).
Repo séparé de app.memovia.io. Ne jamais modifier le code de la plateforme principale depuis ce repo.

## Stack technique
- **Frontend** : React + TypeScript + Vite
- **UI** : Tailwind CSS + shadcn/ui
- **Backend/DB** : Supabase (projet existant : mzjzwffpqubpruyaaxew, partagé avec app.memovia.io)
- **Auth** : Supabase Auth (email/password + magic link)
- **Realtime** : Supabase Realtime
- **Edge Functions** : Supabase Edge Functions (Deno/TypeScript)
- **Déploiement** : **Vercel** (pas Cloudflare, contrairement aux autres sites MEMOVIA). Merge sur `main` = déploiement prod.

## Règles absolues
1. Ne jamais écrire de clé API ou secret en dur dans le code — toujours `.env.local`
2. Ne jamais modifier les tables Supabase existantes de app.memovia.io sans validation explicite
3. Toutes les clés sont en lecture seule sur les données MEMOVIA (jamais d'écriture destructive)
4. Chaque Edge Function doit valider l'authentification avant d'exécuter quoi que ce soit
5. Commits atomiques et descriptifs en français
6. Tests sur chaque module avant de passer au suivant
7. **Jamais un mail réel à un prospect pendant un test** : tout test d'envoi vise une adresse de l'équipe

## Variables d'environnement requises
Voir `.env.example` pour la liste complète. Créer `.env.local` avec les vraies valeurs.
Ne jamais committer `.env.local` (déjà dans `.gitignore`).

## Plan courant

Le plan qui fait foi est `REFONT_PLAN.md` (refonte v2 : 5 sections + accueil).

## Commandes

```bash
npm run dev                 # dev local
npx tsc -b                  # typecheck
npm run build               # tsc + vite build
npx vitest run src/test/CampaignText.test.ts src/test/CampaignCsv.test.ts   # tests du module Campagnes
# Edge functions : vérifier puis déployer UNE PAR UNE, jamais en parallèle
deno check --node-modules-dir=none supabase/functions/<nom>/index.ts
npx supabase functions deploy <nom> --project-ref mzjzwffpqubpruyaaxew --no-verify-jwt
```

La suite complète (`npm test`) peut contenir des échecs antérieurs à ton changement : relancer la même commande
sur `main` avant de conclure qu'on a cassé quelque chose.

## Module Campagnes (`/campagnes`)

Séquences de prospection mail + appels façon Lemlist, sur les `leads` existants. Spec :
`docs/superpowers/specs/2026-09-15-campagnes-design.md`.

**Principe non négociable : rien ne part sans validation humaine.** L'IA prépare des brouillons, un humain
clique « Valider et envoyer » dans l'onglet Revue, relances comprises.

| Pièce | Où |
|---|---|
| Tables `campaigns`, `campaign_steps`, `campaign_enrollments`, `campaign_messages`, cron `campaign-tick-daily` (05:00 UTC lun-ven) | `supabase/migrations/00054_campagnes.sql` |
| Un seul message vivant par étape d'une inscription (index unique anti double envoi) | `supabase/migrations/00055_campagnes_un_message_par_etape.sql` |
| Assemblage des modèles (`{{civilité}}`, `{{nom}}`, `{{IA: consigne}}`, `{{signature}}`, `{{rgpd}}`), zones IA entre `[[ ]]`, contrôles et interdits | `supabase/functions/_shared/campaignText.ts` (logique pure, testée) |
| Gemini, IMAP (détection de réponse), avancer / arrêter une inscription | `supabase/functions/_shared/campaign.ts` |
| Préparer les brouillons dus, arrêter si réponse ou lead sorti de la prospection | `supabase/functions/campaign-tick/index.ts` (cron ou bouton Actualiser) |
| Envoyer un message validé (SMTP Hostinger, dans le fil) | `supabase/functions/campaign-send/index.ts` |
| Front : liste, page campagne à 4 onglets (Séquence, Contacts, Revue, Rapports) | `src/modules/campagnes/`, hook `src/hooks/useCampaigns.ts`, import CSV `src/lib/campaignCsv.ts` |

Comportements à connaître avant de toucher :
- Le cron ne traite que les campagnes au statut `live`. Une campagne `draft` ne prépare rien seule ; le bouton
  Actualiser marche quel que soit le statut.
- Seuls les leads au statut `nouveau` ou `contacte`, non archivés, peuvent entrer dans une campagne, par l'ajout
  comme par le CSV (`isProspect` dans `_shared/campaign.ts`, même règle dans `useCampaigns.ts`).
- Une séquence s'arrête : côté tick, dès qu'une réponse du contact est détectée dans la boîte ou que le lead sort de
  la prospection (perdu, en discussion, archivé…) ; côté front, quand l'issue d'appel saisie est « Refus » ou
  « Intéressé ». Les réponses automatiques (absence) ne comptent pas comme une réponse.
- `campaign-send` revérifie tout juste avant d'envoyer (inscription arrêtée, étape dépassée, campagne en pause, lead
  plus prospect, réponse arrivée entre-temps) et répond 409 si un envoi n'a plus lieu d'être. Il réserve le message
  avant le SMTP : ne pas retirer cette réservation, c'est elle qui empêche deux onglets d'envoyer le même mail.
- `campaign-tick` et `campaign-send` sont déployées `--no-verify-jwt` mais valident l'auth elles-mêmes
  (`validateAuth`, ou secret cron pour le tick). Test négatif attendu : 401 sans jeton ou avec la clé anon.
- Gemini tourne avec `thinkingBudget: 0` (sans lui, 500 intermittents). Si Gemini échoue, le brouillon est quand
  même créé avec un avertissement « zones à écrire à la main ».
- Le brouillon d'un appel n'avance pas l'inscription côté edge : c'est l'issue d'appel saisie dans le front qui
  avance ou arrête.

## Pièges

- **Boîte mail Hostinger** : `emir@memovia.io` est une identité de la boîte `naoufel@memovia.io`, pas une boîte à
  part. Les dossiers IMAP portent le préfixe `INBOX.` (`INBOX.Prospects-BizDev`, `INBOX.Sent`) : un nom sans
  préfixe échoue, et si l'erreur est avalée la détection lit un dossier en moins sans rien dire.
- **Un envoi SMTP n'arrive jamais tout seul dans `INBOX.Sent`** : tout code qui envoie doit y copier le message brut
  (`campaign-send` le fait). Seul `INBOX.Sent` prouve qu'un mail est parti.
- **Vercel Security Checkpoint** : une boucle de `curl` sur dashboard.memovia.io bloque l'IP (403) pendant plus de
  10 min. Pour prouver un déploiement : `gh api "repos/Naou95/memovia-dashboard/deployments?sha=<sha>"`, jamais une
  boucle.
- **QA navigateur** : `npm run build` + `npx vite preview --port 4173`, login par le vrai formulaire (injecter une
  session en localStorage ne marche pas), Playwright avec `chromium.launch({ channel: 'chrome' })`. Écrire le script
  dans le dépôt (depuis un autre dossier, `playwright` est introuvable) et le supprimer après.
- **Migrations** : appliquées sur la base de prod partagée avec l'app. Relire en SQL après application (tables,
  RLS, droits anon, cron). Une table n'émet du realtime que si elle est dans la publication `supabase_realtime`.
- **Pile de PR** : recibler vers `main` avant de merger, sinon elles mergent dans leur branche de base.

## Skills installés
Ces skills sont installés sur la machine de Naoufel, **pas dans le dépôt** (`.claude/` est gitignoré). Si un skill
n'existe pas dans ta session, ignore les consignes qui l'appellent (workflow et routing ci-dessous) et fais l'étape
à la main : planifier, implémenter, relire l'UI, tester, relire le code.

- gstack : /office-hours, /plan-ceo-review, /plan-eng-review, /review, /qa, /ship, /retro, /autoplan
- frontend-design : qualité visuelle production
- Emil Kowalski : animations et motion
- Impeccable : /polish pour nettoyer l'UI après chaque module
- Taste Skill : références visuelles réelles
- UI/UX Pro Max : `/ui-ux-pro-max` — 67 styles UI, 161 palettes, 57 font pairings, 99 guidelines UX, 25 types de charts (React/Next.js/Tailwind/shadcn)

## Workflow obligatoire
Avant de coder un nouveau module :
1. /plan-eng-review sur le module
2. Implémenter
3. /polish sur l'UI produite
4. /qa sur le rendu
5. /review sur le code
6. Commit propre

Pour un changement qui envoie des mails, touche la base ou déploie une edge function, ajouter : test réel sur une
adresse de l'équipe vérifié en base et dans `INBOX.Sent`, puis une relecture qui cherche à casser le changement
(double envoi, garde manquante, cas négatif) avant le merge.

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
- UI styles, color palettes, font pairings, charts, UX guidelines → invoke ui-ux-pro-max
- Design new page/component, choose color scheme, review UI code → invoke ui-ux-pro-max
