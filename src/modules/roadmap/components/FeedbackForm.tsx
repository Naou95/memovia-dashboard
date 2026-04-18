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
import type {
  FeedbackItemWithVotes,
  FeedbackItemInsert,
  FeedbackStatus,
  FeedbackCategory,
} from '@/types/feedback'
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_CATEGORY_LABELS,
} from '@/types/feedback'

interface FeedbackFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FeedbackItemInsert) => Promise<void>
  initialItem?: FeedbackItemWithVotes | null
}

const CATEGORIES: FeedbackCategory[] = ['fonctionnalite', 'bug', 'amelioration']

const selectStyle: React.CSSProperties = {
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            {initialItem ? "Modifier l'item" : 'Nouvelle idée / demande'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fb-title" style={{ color: 'var(--text-label)' }}>
              Titre *
            </Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Export PDF des résultats"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fb-desc" style={{ color: 'var(--text-label)' }}>
              Description
            </Label>
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
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                style={selectStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {FEEDBACK_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label style={{ color: 'var(--text-label)' }}>Statut</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
                style={selectStyle}
              >
                {FEEDBACK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {FEEDBACK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fb-author" style={{ color: 'var(--text-label)' }}>
                Auteur
              </Label>
              <Input
                id="fb-author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fb-email" style={{ color: 'var(--text-label)' }}>
                Email
              </Label>
              <Input
                id="fb-email"
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Enregistrement…' : initialItem ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
