# Module 11 — Roadmap & Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page `/roadmap` avec Kanban 4 colonnes (backlog/planifié/en dev/livré), votes par utilisateur authentifié, CRUD admin, et sync temps réel via Supabase.

**Architecture:** Deux tables Supabase (`feedback_items` + `feedback_votes`) avec RLS stricte ; un hook `useFeedback` centralise fetch/mutations/realtime ; le board est un Kanban DnD (admin drag entre colonnes) rendu par `FeedbackBoard` → `FeedbackCard`.

**Tech Stack:** React + TypeScript, Supabase (PostgreSQL + RLS + Realtime), @dnd-kit/core (déjà installé), shadcn/ui (Button, Dialog), Tailwind CSS variables MEMOVIA

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `supabase/migrations/00010_feedback.sql` | Créer | Tables + RLS + seed |
| `src/types/database.ts` | Modifier | Ajouter feedback_items + feedback_votes |
| `src/types/feedback.ts` | Créer | Types domaine FeedbackItem, statuts, catégories |
| `src/hooks/useFeedback.ts` | Créer | Fetch, vote toggle, CRUD, realtime |
| `src/modules/roadmap/components/RoadmapStats.tsx` | Créer | 4 KPI cards |
| `src/modules/roadmap/components/FeedbackCard.tsx` | Créer | Card avec vote button + admin menu |
| `src/modules/roadmap/components/FeedbackForm.tsx` | Créer | Dialog create/edit |
| `src/modules/roadmap/components/FeedbackBoard.tsx` | Créer | 4 colonnes Kanban + DnD |
| `src/modules/roadmap/RoadmapPage.tsx` | Créer | Page principale |
| `src/router/index.tsx` | Modifier | Ajouter route `/roadmap` |
| `src/config/navigation.ts` | Modifier | Passer roadmap `status: 'active'` |

---

### Task 1 : Migration Supabase — Tables feedback_items + feedback_votes

**Files:**
- Create: `supabase/migrations/00010_feedback.sql`

- [ ] **Étape 1 : Créer le fichier de migration**

```sql
-- Migration 00010: Roadmap & Feedback
-- Module 11 — feedback_items (idées/demandes) + feedback_votes (votes utilisateurs)

CREATE TABLE IF NOT EXISTS public.feedback_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'backlog'
                           CHECK (status IN ('backlog', 'planifie', 'en_dev', 'livre')),
  category     TEXT        NOT NULL DEFAULT 'fonctionnalite'
                           CHECK (category IN ('fonctionnalite', 'bug', 'amelioration')),
  author_name  TEXT,
  author_email TEXT,
  created_by   UUID        REFERENCES public.dashboard_profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS feedback_items_updated_at ON public.feedback_items;
CREATE TRIGGER feedback_items_updated_at
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feedback items"
  ON public.feedback_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert feedback items"
  ON public.feedback_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update feedback items"
  ON public.feedback_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin full can delete feedback items"
  ON public.feedback_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_items TO authenticated;

-- ─── feedback_votes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES public.feedback_items(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view votes"
  ON public.feedback_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can vote"
  ON public.feedback_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own vote"
  ON public.feedback_votes FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.feedback_votes TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_votes;

-- Seed data
INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Mode hors-ligne pour les apprenants', 'Pouvoir continuer les exercices sans connexion internet.', 'planifie', 'fonctionnalite', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Mode hors-ligne pour les apprenants');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Tableau de bord enseignant amélioré', 'Afficher la progression de chaque apprenant par compétence.', 'en_dev', 'fonctionnalite', 'Emir'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Tableau de bord enseignant amélioré');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Notifications email hebdomadaires', 'Récap des progrès envoyé chaque lundi aux apprenants.', 'backlog', 'amelioration', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Notifications email hebdomadaires');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Export PDF des certificats', 'Télécharger un certificat de complétion en PDF.', 'livre', 'fonctionnalite', 'Emir'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Export PDF des certificats');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Bug : video ne charge pas sur Safari iOS', 'Les vidéos MP4 restent bloquées sur l''écran de chargement.', 'en_dev', 'bug', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Bug : video ne charge pas sur Safari iOS');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Intégration Google Classroom', 'Synchroniser les classes et devoirs avec Google Classroom.', 'backlog', 'fonctionnalite', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Intégration Google Classroom');
```

- [ ] **Étape 2 : Appliquer la migration via Supabase MCP**

Utiliser l'outil `mcp__b7e81b82-4869-498e-af23-1deda851a5a6__apply_migration` avec le contenu SQL ci-dessus et le nom `00010_feedback`.

- [ ] **Étape 3 : Commit**

```bash
git add supabase/migrations/00010_feedback.sql
git commit -m "feat: migration 00010 — tables feedback_items et feedback_votes avec RLS"
```

---

### Task 2 : TypeScript types

**Files:**
- Create: `src/types/feedback.ts`
- Modify: `src/types/database.ts`

- [ ] **Étape 1 : Créer `src/types/feedback.ts`**

```typescript
export type FeedbackStatus = 'backlog' | 'planifie' | 'en_dev' | 'livre'
export type FeedbackCategory = 'fonctionnalite' | 'bug' | 'amelioration'

export interface FeedbackItem {
  id: string
  title: string
  description: string | null
  status: FeedbackStatus
  category: FeedbackCategory
  author_name: string | null
  author_email: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackItemWithVotes extends FeedbackItem {
  vote_count: number
}

export type FeedbackItemInsert = {
  title: string
  description?: string | null
  status?: FeedbackStatus
  category?: FeedbackCategory
  author_name?: string | null
  author_email?: string | null
  created_by?: string | null
}

export type FeedbackItemUpdate = Partial<FeedbackItemInsert>

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  backlog: 'Backlog',
  planifie: 'Planifié',
  en_dev: 'En développement',
  livre: 'Livré',
}

export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = [
  'backlog',
  'planifie',
  'en_dev',
  'livre',
]

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  fonctionnalite: 'Fonctionnalité',
  bug: 'Bug',
  amelioration: 'Amélioration',
}

export const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, { bg: string; text: string; border: string }> = {
  backlog:  { bg: 'var(--bg-secondary)', text: 'var(--text-secondary)', border: 'var(--border-color)' },
  planifie: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  en_dev:   { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  livre:    { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
}

export const FEEDBACK_CATEGORY_COLORS: Record<FeedbackCategory, { bg: string; text: string }> = {
  fonctionnalite: { bg: 'rgba(139,92,246,0.12)', text: 'var(--memovia-violet)' },
  bug:            { bg: 'rgba(239,68,68,0.12)',   text: 'var(--danger)' },
  amelioration:   { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6' },
}
```

- [ ] **Étape 2 : Ajouter les types dans `src/types/database.ts`**

Insérer dans le bloc `Tables: {` après la dernière table, avant la fermeture `}`:

```typescript
      feedback_items: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'backlog' | 'planifie' | 'en_dev' | 'livre'
          category: 'fonctionnalite' | 'bug' | 'amelioration'
          author_name: string | null
          author_email: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'backlog' | 'planifie' | 'en_dev' | 'livre'
          category?: 'fonctionnalite' | 'bug' | 'amelioration'
          author_name?: string | null
          author_email?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'backlog' | 'planifie' | 'en_dev' | 'livre'
          category?: 'fonctionnalite' | 'bug' | 'amelioration'
          author_name?: string | null
          author_email?: string | null
          created_by?: string | null
          updated_at?: string
        }
      }
      feedback_votes: {
        Row: {
          id: string
          item_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string
          created_at?: string
        }
      }
```

- [ ] **Étape 3 : Commit**

```bash
git add src/types/feedback.ts src/types/database.ts
git commit -m "feat: types TypeScript pour feedback_items et feedback_votes"
```

---

### Task 3 : Hook `useFeedback`

**Files:**
- Create: `src/hooks/useFeedback.ts`

- [ ] **Étape 1 : Créer `src/hooks/useFeedback.ts`**

```typescript
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  FeedbackItemWithVotes,
  FeedbackItemInsert,
  FeedbackItemUpdate,
  FeedbackStatus,
} from '@/types/feedback'
import { toast } from 'sonner'

interface UseFeedbackResult {
  items: FeedbackItemWithVotes[]
  userVotes: Set<string>
  isLoading: boolean
  error: string | null
  toggleVote: (itemId: string) => Promise<void>
  createItem: (data: FeedbackItemInsert) => Promise<void>
  updateItem: (id: string, data: FeedbackItemUpdate) => Promise<void>
  updateStatus: (id: string, status: FeedbackStatus) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export function useFeedback(): UseFeedbackResult {
  const [items, setItems] = useState<FeedbackItemWithVotes[]>([])
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [itemsResult, allVotesResult, userResult] = await Promise.all([
      supabase
        .from('feedback_items')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('feedback_votes').select('item_id, user_id'),
      supabase.auth.getUser(),
    ])

    if (itemsResult.error) {
      setError('Impossible de charger les feedbacks')
      setIsLoading(false)
      return
    }

    const allVotes = allVotesResult.data ?? []
    const currentUserId = userResult.data.user?.id

    const voteCounts = allVotes.reduce<Record<string, number>>((acc, v) => {
      acc[v.item_id] = (acc[v.item_id] ?? 0) + 1
      return acc
    }, {})

    const myVoteSet = new Set(
      currentUserId
        ? allVotes.filter((v) => v.user_id === currentUserId).map((v) => v.item_id)
        : []
    )

    setItems(
      (itemsResult.data ?? []).map((item) => ({
        ...item,
        vote_count: voteCounts[item.id] ?? 0,
      })) as FeedbackItemWithVotes[]
    )
    setUserVotes(myVoteSet)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('feedback-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_votes' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const toggleVote = async (itemId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const hasVoted = userVotes.has(itemId)

    // Optimistic update
    setUserVotes((prev) => {
      const next = new Set(prev)
      if (hasVoted) next.delete(itemId)
      else next.add(itemId)
      return next
    })
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, vote_count: item.vote_count + (hasVoted ? -1 : 1) }
          : item
      )
    )

    if (hasVoted) {
      const { error } = await supabase
        .from('feedback_votes')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', user.id)
      if (error) {
        await fetchAll()
        toast.error('Erreur lors de la suppression du vote')
      }
    } else {
      const { error } = await supabase
        .from('feedback_votes')
        .insert({ item_id: itemId, user_id: user.id })
      if (error) {
        await fetchAll()
        toast.error('Erreur lors du vote')
      }
    }
  }

  const createItem = async (data: FeedbackItemInsert) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('feedback_items')
      .insert({ ...data, created_by: user?.id ?? null })
    if (error) {
      toast.error('Impossible de créer l'item')
      return
    }
    toast.success('Item créé')
    await fetchAll()
  }

  const updateItem = async (id: string, data: FeedbackItemUpdate) => {
    const { error } = await supabase
      .from('feedback_items')
      .update(data)
      .eq('id', id)
    if (error) {
      toast.error('Impossible de modifier l'item')
      return
    }
    await fetchAll()
  }

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    await updateItem(id, { status })
  }

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('feedback_items').delete().eq('id', id)
    if (error) {
      toast.error('Impossible de supprimer l'item')
      return
    }
    toast.success('Item supprimé')
    await fetchAll()
  }

  return { items, userVotes, isLoading, error, toggleVote, createItem, updateItem, updateStatus, deleteItem }
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/hooks/useFeedback.ts
git commit -m "feat: hook useFeedback — fetch, vote toggle, CRUD, realtime"
```

---

### Task 4 : Composant RoadmapStats

**Files:**
- Create: `src/modules/roadmap/components/RoadmapStats.tsx`

- [ ] **Étape 1 : Créer `src/modules/roadmap/components/RoadmapStats.tsx`**

```tsx
import type { FeedbackItemWithVotes } from '@/types/feedback'

interface RoadmapStatsProps {
  items: FeedbackItemWithVotes[]
}

export function RoadmapStats({ items }: RoadmapStatsProps) {
  const totalVotes = items.reduce((sum, i) => sum + i.vote_count, 0)
  const enDev = items.filter((i) => i.status === 'en_dev').length
  const livre = items.filter((i) => i.status === 'livre').length

  const stats = [
    { label: 'Idées totales', value: items.length, color: 'var(--memovia-violet)' },
    { label: 'Votes cumulés', value: totalVotes, color: '#3b82f6' },
    { label: 'En développement', value: enDev, color: '#f59e0b' },
    { label: 'Livrées', value: livre, color: '#10b981' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: stat.color }}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/modules/roadmap/components/RoadmapStats.tsx
git commit -m "feat: composant RoadmapStats — 4 KPI cards"
```

---

### Task 5 : Composant FeedbackCard

**Files:**
- Create: `src/modules/roadmap/components/FeedbackCard.tsx`

- [ ] **Étape 1 : Créer `src/modules/roadmap/components/FeedbackCard.tsx`**

```tsx
import { ChevronUp, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FeedbackItemWithVotes } from '@/types/feedback'
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORY_COLORS,
} from '@/types/feedback'

interface FeedbackCardProps {
  item: FeedbackItemWithVotes
  hasVoted: boolean
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function FeedbackCard({
  item,
  hasVoted,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
  dragHandleProps,
}: FeedbackCardProps) {
  const catColor = FEEDBACK_CATEGORY_COLORS[item.category]

  return (
    <div
      className="rounded-xl border p-3 flex flex-col gap-2 transition-shadow hover:shadow-sm"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: catColor.bg, color: catColor.text }}
        >
          {FEEDBACK_CATEGORY_LABELS[item.category]}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <div {...dragHandleProps} className="cursor-grab p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]" title="Déplacer">
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="3" cy="2" r="1.5" /><circle cx="7" cy="2" r="1.5" />
                <circle cx="3" cy="7" r="1.5" /><circle cx="7" cy="7" r="1.5" />
                <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
              </svg>
            </div>
          )}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <Pencil size={14} className="mr-2" /> Modifier
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-500"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 size={14} className="mr-2" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Title + description */}
      <div>
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {item.title}
        </p>
        {item.description && (
          <p
            className="mt-0.5 text-xs line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {item.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        {item.author_name ? (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {item.author_name}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => onVote(item.id)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
          style={
            hasVoted
              ? { backgroundColor: 'var(--accent-purple-bg)', color: 'var(--memovia-violet)' }
              : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
          }
        >
          <ChevronUp size={14} strokeWidth={hasVoted ? 3 : 2} />
          {item.vote_count}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/modules/roadmap/components/FeedbackCard.tsx
git commit -m "feat: composant FeedbackCard — vote button, admin menu, category badge"
```

---

### Task 6 : Composant FeedbackForm (dialog create/edit)

**Files:**
- Create: `src/modules/roadmap/components/FeedbackForm.tsx`

- [ ] **Étape 1 : Créer `src/modules/roadmap/components/FeedbackForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FeedbackItemWithVotes, FeedbackItemInsert, FeedbackStatus, FeedbackCategory } from '@/types/feedback'
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUS_ORDER, FEEDBACK_CATEGORY_LABELS } from '@/types/feedback'

interface FeedbackFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FeedbackItemInsert) => Promise<void>
  initialItem?: FeedbackItemWithVotes | null
}

const CATEGORIES: FeedbackCategory[] = ['fonctionnalite', 'bug', 'amelioration']

export function FeedbackForm({ open, onClose, onSubmit, initialItem }: FeedbackFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<FeedbackStatus>('backlog')
  const [category, setCategory] = useState<FeedbackCategory>('fonctionnalite')
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.title)
      setDescription(initialItem.description ?? '')
      setStatus(initialItem.status)
      setCategory(initialItem.category)
      setAuthorName(initialItem.author_name ?? '')
      setAuthorEmail(initialItem.author_email ?? '')
    } else {
      setTitle('')
      setDescription('')
      setStatus('backlog')
      setCategory('fonctionnalite')
      setAuthorName('')
      setAuthorEmail('')
    }
  }, [initialItem, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setIsSubmitting(true)
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      status,
      category,
      author_name: authorName.trim() || null,
      author_email: authorEmail.trim() || null,
    })
    setIsSubmitting(false)
    onClose()
  }

  const selectStyle = {
    backgroundColor: 'var(--bg-secondary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '0.5rem',
    padding: '0.375rem 0.625rem',
    fontSize: '0.875rem',
    width: '100%',
    border: '1px solid var(--border-color)',
    outline: 'none',
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            {initialItem ? 'Modifier l'item' : 'Nouvelle idée / demande'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fb-title" style={{ color: 'var(--text-label)' }}>Titre *</Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Export PDF des résultats"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fb-desc" style={{ color: 'var(--text-label)' }}>Description</Label>
            <textarea
              id="fb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte, cas d'usage, priorité…"
              rows={3}
              style={{ ...selectStyle, resize: 'vertical' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label style={{ color: 'var(--text-label)' }}>Catégorie</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)} style={selectStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{FEEDBACK_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label style={{ color: 'var(--text-label)' }}>Statut</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} style={selectStyle}>
                {FEEDBACK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fb-author" style={{ color: 'var(--text-label)' }}>Auteur</Label>
              <Input id="fb-author" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fb-email" style={{ color: 'var(--text-label)' }}>Email</Label>
              <Input id="fb-email" type="email" value={authorEmail} onChange={(e) => setAuthorEmail(e.target.value)} placeholder="email@exemple.com" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="brand" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Enregistrement…' : initialItem ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Étape 2 : Vérifier que `Dialog` est bien exporté depuis `@/components/ui/dialog`**

```bash
ls /Users/naoufelbassou/memovia-dashboard/src/components/ui/dialog.tsx
```

Si le fichier n'existe pas, l'installer :
```bash
cd /Users/naoufelbassou/memovia-dashboard && npx shadcn@latest add dialog
```

- [ ] **Étape 3 : Commit**

```bash
git add src/modules/roadmap/components/FeedbackForm.tsx
git commit -m "feat: composant FeedbackForm — dialog create/edit avec tous les champs"
```

---

### Task 7 : Composant FeedbackBoard (Kanban + DnD)

**Files:**
- Create: `src/modules/roadmap/components/FeedbackBoard.tsx`

- [ ] **Étape 1 : Créer `src/modules/roadmap/components/FeedbackBoard.tsx`**

```tsx
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { FeedbackCard } from './FeedbackCard'
import type { FeedbackItemWithVotes, FeedbackStatus } from '@/types/feedback'
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_STATUS_COLORS,
} from '@/types/feedback'

// ─── Draggable card wrapper (admin only) ──────────────────────────────────────
function DraggableCard({
  item,
  hasVoted,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
}: {
  item: FeedbackItemWithVotes
  hasVoted: boolean
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !isAdmin,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <FeedbackCard
        item={item}
        hasVoted={hasVoted}
        isAdmin={isAdmin}
        onVote={onVote}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={isAdmin ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  )
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function Column({
  status,
  items,
  userVotes,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
}: {
  status: FeedbackStatus
  items: FeedbackItemWithVotes[]
  userVotes: Set<string>
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const colors = FEEDBACK_STATUS_COLORS[status]

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Column header */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text }}>
          {FEEDBACK_STATUS_LABELS[status]}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: colors.border, color: colors.text }}
        >
          {items.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-colors"
        style={{
          backgroundColor: isOver ? 'var(--accent-purple-bg)' : 'var(--bg-secondary)',
          border: `1px dashed ${isOver ? 'var(--memovia-violet)' : 'var(--border-color)'}`,
        }}
      >
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Aucun item
            </p>
          </div>
        ) : (
          items.map((item) => (
            <DraggableCard
              key={item.id}
              item={item}
              hasVoted={userVotes.has(item.id)}
              isAdmin={isAdmin}
              onVote={onVote}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Board ────────────────────────────────────────────────────────────────────
interface FeedbackBoardProps {
  items: FeedbackItemWithVotes[]
  userVotes: Set<string>
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: FeedbackStatus) => Promise<void>
}

export function FeedbackBoard({
  items,
  userVotes,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
  onStatusChange,
}: FeedbackBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const itemsByStatus = FEEDBACK_STATUS_ORDER.reduce<Record<FeedbackStatus, FeedbackItemWithVotes[]>>(
    (acc, s) => {
      acc[s] = items.filter((i) => i.status === s)
      return acc
    },
    { backlog: [], planifie: [], en_dev: [], livre: [] }
  )

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as FeedbackStatus
    const item = items.find((i) => i.id === active.id)
    if (item && item.status !== newStatus) {
      await onStatusChange(item.id, newStatus)
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FEEDBACK_STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            items={itemsByStatus[status]}
            userVotes={userVotes}
            isAdmin={isAdmin}
            onVote={onVote}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div style={{ transform: 'rotate(1.5deg)', opacity: 0.9 }}>
            <FeedbackCard
              item={activeItem}
              hasVoted={userVotes.has(activeItem.id)}
              isAdmin={isAdmin}
              onVote={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/modules/roadmap/components/FeedbackBoard.tsx
git commit -m "feat: composant FeedbackBoard — kanban 4 colonnes + drag-and-drop admin"
```

---

### Task 8 : Page principale RoadmapPage

**Files:**
- Create: `src/modules/roadmap/RoadmapPage.tsx`

- [ ] **Étape 1 : Créer `src/modules/roadmap/RoadmapPage.tsx`**

```tsx
import { useState } from 'react'
import { Plus, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/hooks/useFeedback'
import { useAuth } from '@/contexts/AuthContext'
import { RoadmapStats } from './components/RoadmapStats'
import { FeedbackBoard } from './components/FeedbackBoard'
import { FeedbackForm } from './components/FeedbackForm'
import type { FeedbackItemWithVotes, FeedbackCategory, FeedbackItemInsert } from '@/types/feedback'
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_LABELS } from '@/types/feedback'

const CATEGORY_FILTERS: Array<{ value: FeedbackCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'fonctionnalite', label: FEEDBACK_CATEGORY_LABELS.fonctionnalite },
  { value: 'bug', label: FEEDBACK_CATEGORY_LABELS.bug },
  { value: 'amelioration', label: FEEDBACK_CATEGORY_LABELS.amelioration },
]

export default function RoadmapPage() {
  const { user } = useAuth()
  const isAdmin = !!user

  const {
    items,
    userVotes,
    isLoading,
    error,
    toggleVote,
    createItem,
    updateItem,
    updateStatus,
    deleteItem,
  } = useFeedback()

  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FeedbackItemWithVotes | null>(null)

  const filteredItems =
    categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter)

  const handleEdit = (item: FeedbackItemWithVotes) => {
    setEditTarget(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditTarget(null)
  }

  const handleFormSubmit = async (data: FeedbackItemInsert) => {
    if (editTarget) {
      await updateItem(editTarget.id, data)
    } else {
      await createItem(data)
    }
  }

  const pillBase = {
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border-color)',
    transition: 'all 0.15s',
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--accent-purple-bg)' }}
          >
            <Map size={20} style={{ color: 'var(--memovia-violet)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Roadmap & Feedback
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Idées, demandes et avancement produit MEMOVIA
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="brand" size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={16} className="mr-1" />
            Nouvelle idée
          </Button>
        )}
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            />
          ))}
        </div>
      ) : (
        <RoadmapStats items={items} />
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setCategoryFilter(f.value)}
            style={
              categoryFilter === f.value
                ? { ...pillBase, backgroundColor: 'var(--memovia-violet)', color: '#fff', borderColor: 'var(--memovia-violet)' }
                : { ...pillBase, backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            />
          ))}
        </div>
      ) : (
        <FeedbackBoard
          items={filteredItems}
          userVotes={userVotes}
          isAdmin={isAdmin}
          onVote={toggleVote}
          onEdit={handleEdit}
          onDelete={deleteItem}
          onStatusChange={updateStatus}
        />
      )}

      {/* Create / Edit form */}
      <FeedbackForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialItem={editTarget}
      />
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/modules/roadmap/RoadmapPage.tsx
git commit -m "feat: page RoadmapPage — header, stats, filtres catégorie, board"
```

---

### Task 9 : Router + Navigation

**Files:**
- Modify: `src/router/index.tsx`
- Modify: `src/config/navigation.ts`

- [ ] **Étape 1 : Ajouter la route dans `src/router/index.tsx`**

Ajouter l'import lazy après la ligne `const RealtimePage`:
```typescript
const RoadmapPage = lazy(() => import('@/modules/roadmap/RoadmapPage'))
```

Ajouter la route après le bloc `realtime`:
```typescript
      {
        path: 'roadmap',
        element: (
          <Suspense fallback={<PageLoader />}>
            <RoadmapPage />
          </Suspense>
        ),
      },
```

- [ ] **Étape 2 : Activer l'item dans `src/config/navigation.ts`**

Changer le statut de l'item `roadmap` de `'soon'` à `'active'` :

```typescript
      {
        id: 'roadmap',
        label: 'Roadmap & Feedback',
        path: '/roadmap',
        icon: Map,
        status: 'active',   // était 'soon'
        allowedRoles: [],
      },
```

- [ ] **Étape 3 : Commit final**

```bash
git add src/router/index.tsx src/config/navigation.ts
git commit -m "feat: route /roadmap et navigation activée — Module 11 complet"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Page /roadmap | Task 8, 9 |
| Retours utilisateurs (feedback_items) | Task 1, 2 |
| Système de votes | Task 1 (DB), 3 (hook), 5 (card button) |
| Statuts backlog/planifié/en dev/livré | Task 1, 2, 7 |
| Table feedback_items dans Supabase | Task 1 |
| CRUD admin | Task 3 (hook), 6 (form), 5 (delete menu) |
| Votes publics (tous users auth) | Task 1 (RLS INSERT votes), 3 (toggleVote) |
| Supabase direct + RLS | Task 1 |
| Drag-and-drop pour changer statut | Task 7 |
| Realtime sync | Task 3 (channel feedback_items + feedback_votes) |

### Placeholder scan
Aucun TBD, TODO, ou "implement later" dans le plan.

### Type consistency
- `FeedbackStatus` défini dans Task 2, utilisé dans Tasks 3, 5, 6, 7, 8 ✓
- `FeedbackItemWithVotes` défini dans Task 2, utilisé dans Tasks 3, 5, 6, 7, 8 ✓
- `toggleVote(id: string)` dans Task 3, appelé avec `item.id` dans Tasks 5, 7, 8 ✓
- `updateStatus(id, status)` dans Task 3, passé comme `onStatusChange` dans Tasks 7, 8 ✓
- `onEdit(item: FeedbackItemWithVotes)` dans Task 5, handled dans Task 8 ✓
