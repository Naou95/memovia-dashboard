# Spec — Refonte email-lead-detector : analyse de maturité conversationnelle

Date : 2026-04-18  
Statut : approuvée  

## Contexte

La version actuelle de `email-lead-detector` analyse les emails **un par un** (email par email) depuis INBOX uniquement, crée un lead par email entrant, et skip si `contact_email` existe déjà. Elle ne reconstitue pas les fils de conversation, ne distingue pas les emails envoyés des reçus, et n'évalue pas la maturité du prospect.

## Objectif

Analyser les **fils de conversation complets** (INBOX + Sent) groupés par interlocuteur pour évaluer la maturité de chaque prospect (froid/tiède/chaud), son statut CRM (nouveau/contacte/en_discussion/proposition/relance), et mettre à jour les leads existants au lieu de créer des doublons.

---

## Section 1 — Edge Function refactorée

### Pipeline d'exécution

```
1. Connexion IMAP (Hostinger)
2. LIST des dossiers → détecter dynamiquement le dossier Sent
3. Fetch INBOX (30j) + Fetch Sent (30j) → pool d'emails bruts
4. Filtrer : exclure tout-interne, newsletters/notifications auto
5. Grouper par clé :
   - domaine générique (gmail.com, orange.fr, hotmail.com…) → clé = adresse exacte
   - domaine propre (@lycee-victorzugo.fr…) → clé = @domaine
6. Trier chaque groupe chronologiquement → conversation[]
7. Pour chaque conversation (max 20) :
   a. Construire le message utilisateur (timeline complète, ~2000 chars/email)
   b. Appeler Claude Haiku avec le prompt conversationnel
   c. Parser la réponse JSON
   d. UPSERT leads par contact_email (UPDATE si existe, INSERT sinon)
8. Retourner stats : analyzed, upserted, inserted, skipped, errors
```

### Paramètres

| Paramètre | Valeur |
|-----------|--------|
| Fenêtre | 30 derniers jours |
| Dossiers | INBOX + Sent (détecté dynamiquement) |
| Max conversations | 20 |
| Body max par email | 2000 chars |
| Délai entre appels Claude | 200ms |

### Détection dossier Sent

`client.list()` → chercher `\Sent` dans `specialUse` attributes. Sinon matcher parmi : `['Sent', 'Sent Items', 'INBOX.Sent', 'Sent Messages']`.

### Filtrage newsletters

Exclusion côté parsing (avant appel Claude) si le sujet ou headers contiennent :
`unsubscribe`, `List-Unsubscribe`, `noreply`, `no-reply`, `notification`, `newsletter`, `donotreply`

### Prompt Claude (nouveau)

```
Système : "Tu es un assistant CRM expert pour MEMOVIA AI, plateforme EdTech B2B pour CFAs et écoles
(12€/licence/mois). Analyse ce fil de conversation et détermine s'il s'agit d'un prospect.

Réponds UNIQUEMENT en JSON valide :
{
  "is_lead": true/false,
  "org_name": "nom de l'organisation",
  "contact_name": "prénom nom",
  "contact_email": "email principal",
  "contact_role": "poste/fonction si détecté",
  "lead_type": "ecole|cfa|entreprise|autre",
  "status": "nouveau|contacte|en_discussion|proposition|relance",
  "maturity": "froid|tiede|chaud",
  "last_contact_date": "YYYY-MM-DD",
  "next_action": "description de la prochaine action recommandée",
  "relance_count": 0,
  "notes": "résumé complet de la conversation",
  "timeline": [
    {"date": "YYYY-MM-DD", "direction": "envoyé|reçu", "sujet": "...", "résumé": "..."}
  ]
}

Statut :
- nouveau : aucun échange encore
- contacte : on a envoyé, pas de réponse
- en_discussion : échanges dans les deux sens
- proposition : on a envoyé une offre/démo/tarif
- relance : on a relancé sans réponse (compter les relances)

Maturité :
- froid : contact initial ou sans réponse depuis +14 jours
- tiede : échanges actifs mais pas de décision
- chaud : intérêt explicite, demande de devis ou démo imminente"
```

### UPSERT strategy

- Clé de dédup : `contact_email`
- Si `contact_email` est null dans la réponse Claude → skip (pas d'insertion possible sans clé de dédup)
- Lead existe → `UPDATE` : status, maturity, notes, next_action, relance_count, last_contact_date, timeline, contact_role, org_name
- Lead n'existe pas → `INSERT` complet

---

## Section 2 — Migration DB

Fichier : `supabase/migrations/00017_leads_maturity_fields.sql`

```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_role      TEXT,
  ADD COLUMN IF NOT EXISTS maturity          TEXT DEFAULT 'froid'
    CHECK (maturity IN ('froid', 'tiede', 'chaud')),
  ADD COLUMN IF NOT EXISTS relance_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_date DATE,
  ADD COLUMN IF NOT EXISTS timeline          JSONB;
```

Note : `tiede` sans accent dans la contrainte SQL (label affiché "Tiède" côté frontend).

---

## Section 3 — Frontend

### Types (`src/types/leads.ts`)

Nouveaux types :

```ts
export type LeadMaturity = 'froid' | 'tiede' | 'chaud'

export interface TimelineEntry {
  date: string
  direction: 'envoyé' | 'reçu'
  sujet: string
  résumé: string
}
```

Nouvelles colonnes dans `Lead` :

```ts
contact_role: string | null
maturity: LeadMaturity | null
relance_count: number
last_contact_date: string | null
timeline: TimelineEntry[] | null
```

Labels maturité :

```ts
export const LEAD_MATURITY_LABELS: Record<LeadMaturity, string> = {
  froid: 'Froid',
  tiede: 'Tiède',
  chaud: 'Chaud',
}
```

### Nouveau composant `LeadMaturityBadge`

Pill colorée :
- `froid` → fond gris (`var(--bg-secondary)`), texte `var(--text-label)`
- `tiede` → fond `#fef3c7`, texte `#d97706`
- `chaud` → fond `color-mix(in oklab, var(--success) 15%, white)`, texte `var(--success)`

### LeadKanban — cards

Sous les badges canal/assigné, ajouter :
- `LeadMaturityBadge` si `maturity` présent
- Compteur relances (ex: `2 relances`) si `relance_count > 0`
- Date dernier contact si `last_contact_date` présent

### LeadTable — colonnes

Avant (8 colonnes) : Lead | Type | Canal | Statut | Assigné | Prochaine action | Relance | Actions  
Après (9 colonnes) : Lead | Type | Canal | Statut | Maturité | Assigné | Prochaine action | Dernier contact | Relances | Actions

> La colonne "Relance" (follow_up_date) est remplacée par "Dernier contact" (last_contact_date) + "Relances" (relance_count). `follow_up_date` reste dans le modèle mais sort du tableau principal.

---

## Fichiers concernés

| Fichier | Changement |
|---------|------------|
| `supabase/migrations/00017_leads_maturity_fields.sql` | Nouveau — colonnes maturity, relance_count, last_contact_date, timeline, contact_role |
| `supabase/functions/email-lead-detector/index.ts` | Refonte complète — groupement conversations, prompt, UPSERT |
| `src/types/leads.ts` | Ajout LeadMaturity, TimelineEntry, nouvelles colonnes Lead |
| `src/modules/prospection/components/LeadMaturityBadge.tsx` | Nouveau composant |
| `src/modules/prospection/components/LeadKanban.tsx` | Ajout badges maturité + relances dans cards |
| `src/modules/prospection/components/LeadTable.tsx` | Colonnes remplacées/ajoutées |

---

## Ce qui ne change pas

- Auth et validation dans l'Edge Function (isCronCall + validateAuth)
- RLS Supabase sur `leads`
- Hook `useLeads` (select `*` → récupère automatiquement les nouvelles colonnes)
- `LeadForm` (le formulaire manuel reste inchangé)
- `LeadStats` (métriques existantes inchangées)
- Cron trigger existant (migration 00016)
