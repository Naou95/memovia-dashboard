# Copilote IA — Contexte enrichi + Tool Use

**Date :** 2026-04-18  
**Statut :** Approuvé  

---

## Objectif

Améliorer le copilote IA sur deux axes :

1. **Contexte live enrichi** — au démarrage, charger les données réelles de tous les modules (tâches, leads, contrats, emails, calendrier, Stripe, Qonto) pour que Claude puisse répondre à des questions précises sans halluciner.
2. **Actions directes via tool use** — permettre au copilote de créer une tâche, changer le statut d'un lead, créer un contrat, et afficher une carte structurée dans le chat pour confirmer l'action.

---

## Section 1 — Contexte enrichi au démarrage

### Données chargées dans `useCopilot.ts → loadContext()`

Chargement en parallèle (`Promise.all`) :

| Source | Données |
|--------|---------|
| Supabase `tasks` (direct) | Toutes tâches non-`done` : titre, statut, priorité, assigned_to, due_date |
| Supabase `leads` (direct) | Leads non-`perdu`/non-`gagne` : nom, type, statut, assigned_to, next_action |
| Supabase `contracts` (direct) | Contrats actifs : org_name, statut, mrr_eur, license_count |
| Cache `useStripeFinance` | MRR, ARR, nb abonnements actifs |
| Cache `useQontoFinance` | Solde courant |
| Edge Function `email-list` | Nb emails non lus (count uniquement) |
| Edge Function `get-calendar-events` | Événements du jour : titre, heure début/fin |

### Format du système prompt

Le contexte est sérialisé en sections nommées dans le `system` prompt de Claude :

```
## TÂCHES EN COURS
- [todo] Relancer Lycée Victor Hugo — priorité haute — Emir — échéance 2026-04-20
- [en_cours] Préparer démo CFA Rabelais — priorité normale — Naoufel

## LEADS ACTIFS
- CFA Rabelais — cfa — en_discussion — Naoufel — next: envoyer proposition
- Lycée Voltaire — ecole — nouveau — Emir

## CONTRATS ACTIFS
- CNAM — actif — 1 200 €/mois — 50 licences
...

## STRIPE
MRR : 4 200 € | ARR : 50 400 € | Abonnements actifs : 12

## QONTO
Solde : 18 430 €

## EMAILS
Non lus : 3

## CALENDRIER DU JOUR (2026-04-18)
- 10h00 Démo CFA Rabelais (Google Meet)
- 14h30 Point équipe
```

---

## Section 2 — Tool Use dans l'Edge Function

### Outils Anthropic définis dans `copilot-chat/index.ts`

**`create_task`**
- `title` (string, required)
- `description` (string, optional)
- `priority`: `"haute"` | `"normale"` | `"basse"` — défaut `"normale"`
- `assigned_to`: `"naoufel"` | `"emir"` (required)
- `due_date`: ISO date string (optional)
- `status`: `"todo"` | `"en_cours"` — défaut `"todo"`

**`update_lead_status`**
- `lead_name` (string, required) — résolution par correspondance de nom dans le contexte
- `new_status`: `"nouveau"` | `"contacte"` | `"en_discussion"` | `"proposition"` | `"gagne"` | `"perdu"` (required)

**`create_contract`**
- `organization_name` (string, required)
- `contact_name` (string, optional)
- `mrr_eur` (number, required)
- `license_count` (number, required)
- `organization_type`: `"ecole"` | `"cfa"` | `"entreprise"` | `"autre"` — défaut `"ecole"`
- `status`: `"prospect"` | `"negotiation"` | `"signe"` | `"actif"` — défaut `"prospect"`

### Flow d'exécution dans l'Edge Function

```
1. Recevoir message + historique + contexte du frontend
2. Appel Anthropic NON-STREAMING avec tools définis
3. Si stop_reason === "tool_use" :
   a. Extraire le tool_use block (name + input)
   b. Exécuter la DB op via Supabase admin client avec JWT user
   c. Émettre SSE : event: tool_result / data: {type, payload}
   d. Appel Anthropic STREAMING avec le tool_result
   e. Streamer la réponse textuelle finale
4. Si stop_reason === "end_turn" :
   a. Streamer la réponse directement (pas de tool call)
```

### Exécution DB

- `create_task` → `supabase.from('tasks').insert({...input, created_by: userId})`
- `update_lead_status` → `supabase.from('leads').update({status}).eq('id', resolvedId)` (résolution de l'id par correspondance du nom dans la liste du contexte passée au tool)
- `create_contract` → `supabase.from('contracts').insert({...input, created_by: userId})`

Le JWT user est extrait du header `Authorization` et utilisé pour créer un client Supabase avec les permissions de l'utilisateur (RLS respectée).

---

## Section 3 — Cartes d'action dans le frontend

### Protocole SSE étendu

Le stream peut contenir deux types d'événements :

```
event: tool_result
data: {"type":"create_task","payload":{"id":"uuid","title":"...","assigned_to":"emir","priority":"haute","status":"todo","due_date":null}}

event: text
data: Tâche créée avec succès.
```

### Types étendus dans `CopilotBubble.tsx`

```typescript
type CopilotMessage =
  | { role: 'user' | 'assistant'; content: string }
  | { role: 'assistant'; type: 'tool_result'; tool: ToolResultCard }

type ToolResultCard =
  | { kind: 'task'; data: { id: string; title: string; assigned_to: string; priority: string; status: string; due_date: string | null } }
  | { kind: 'lead'; data: { id: string; name: string; old_status: string; new_status: string; type: string } }
  | { kind: 'contract'; data: { id: string; organization_name: string; mrr_eur: number; license_count: number; status: string } }
```

### Rendu des cartes

3 composants inline dans le fil de chat (dans `CopilotBubble.tsx`) :

**TaskCard**
- Badge statut coloré (todo=gris, en_cours=bleu)
- Titre de la tâche
- Avatar initiales + nom assigné
- Badge priorité (haute=rouge, normale=orange, basse=vert)
- Date échéance si présente

**LeadCard**
- Nom de l'organisation
- Badge type (ecole/cfa/entreprise)
- Flèche : ancien statut → nouveau statut (badges colorés)

**ContractCard**
- Nom de l'organisation
- MRR formaté en € 
- Nb licences
- Badge statut pipeline

Après la carte, la réponse textuelle de Claude streame normalement.

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/hooks/useCopilot.ts` | Étendre `loadContext()` avec queries parallèles |
| `supabase/functions/copilot-chat/index.ts` | Ajouter tools + flow 2-phases + SSE étendu |
| `src/components/copilot/CopilotBubble.tsx` | Parser SSE étendu + types + rendu cartes |
| `src/components/copilot/TaskCard.tsx` | Nouveau composant (carte tâche) |
| `src/components/copilot/LeadCard.tsx` | Nouveau composant (carte lead) |
| `src/components/copilot/ContractCard.tsx` | Nouveau composant (carte contrat) |

---

## Hors scope

- Actions de suppression (delete task, delete lead)
- Mise à jour d'autres champs que le statut d'un lead
- Création d'événements calendrier via le copilote
- Pagination du contexte (on charge tout, max ~50 tâches/leads/contrats)
