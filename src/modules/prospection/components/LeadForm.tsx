import { useState, useEffect, useRef, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Lead, LeadInsert, LeadUpdate } from '@/types/leads'

interface LeadFormProps {
  open: boolean
  onClose: () => void
  lead?: Lead | null
  onSubmit: (data: LeadInsert | LeadUpdate) => Promise<void>
  // Onglet Partenaires (mémoire d'entreprise, 21/08/2026) : création directe en
  // type='partenaire' / status='actif'. À l'édition, le mode se déduit de la fiche.
  partnerMode?: boolean
}

interface FormState {
  name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  contact_role: string
  type: string
  canal: string
  status: string
  next_action: string
  follow_up_date: string
  assigned_to: string
  notes: string
}

function emptyForm(partner: boolean): FormState {
  return {
    name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    contact_role: '',
    type: partner ? 'partenaire' : 'cfa',
    canal: partner ? 'autre' : 'linkedin',
    status: partner ? 'actif' : 'nouveau',
    next_action: '',
    follow_up_date: '',
    assigned_to: '',
    notes: '',
  }
}

function leadToForm(lead: Lead): FormState {
  return {
    name: lead.name,
    contact_name: lead.contact_name ?? '',
    contact_phone: lead.contact_phone ?? '',
    contact_email: lead.contact_email ?? '',
    contact_role: lead.contact_role ?? '',
    type: lead.type,
    canal: lead.canal,
    status: lead.status,
    next_action: lead.next_action ?? '',
    follow_up_date: lead.follow_up_date ?? '',
    assigned_to: lead.assigned_to ?? '',
    notes: lead.notes ?? '',
  }
}

const selectClass =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

export function LeadForm({ open, onClose, lead, onSubmit, partnerMode = false }: LeadFormProps) {
  const isEdit = lead != null
  // Une fiche existante fait foi sur son propre mode : éditer un partenaire depuis
  // n'importe où affiche le formulaire partenaire, et réciproquement.
  const isPartner = lead ? lead.type === 'partenaire' : partnerMode
  const [form, setForm] = useState<FormState>(emptyForm(isPartner))
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    if (open) {
      setForm(lead ? leadToForm(lead) : emptyForm(isPartner))
      setNameError(null)
      // Reset textarea height when dialog opens
      setTimeout(() => {
        if (notesRef.current) autoResize(notesRef.current)
      }, 0)
    }
  }, [open, lead, isPartner, autoResize])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'name') setNameError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      setNameError('Le nom du lead est requis.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: LeadInsert = {
        name: form.name.trim(),
        // Un partenaire ne sort jamais de son mode : type/statut forcés (les selects
        // sont masqués dans ce cas).
        type: (isPartner ? 'partenaire' : form.type) as LeadInsert['type'],
        canal: form.canal as LeadInsert['canal'],
        status: (isPartner ? 'actif' : form.status) as LeadInsert['status'],
        next_action: form.next_action.trim() || null,
        follow_up_date: form.follow_up_date || null,
        assigned_to: (form.assigned_to || null) as LeadInsert['assigned_to'],
        notes: form.notes.trim() || null,
        created_by: null,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        archived: lead?.archived ?? false,
        // Éditables en mode partenaire, portés tels quels sinon (champs gérés par le
        // détecteur email : leadToForm les charge, les inputs n'existent que côté partenaire)
        contact_email: form.contact_email.trim() || null,
        contact_role: form.contact_role.trim() || null,
        // Preserve AI-managed fields — carry through existing values on edit, null on create
        source: lead?.source ?? null,
        maturity: lead?.maturity ?? null,
        relance_count: lead?.relance_count ?? 0,
        last_contact_date: lead?.last_contact_date ?? null,
        timeline: lead?.timeline ?? null,
      }
      await onSubmit(payload)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
              {isPartner
                ? isEdit ? 'Modifier le partenaire' : 'Nouveau partenaire'
                : isEdit ? 'Modifier le lead' : 'Nouveau lead'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Nom */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nom <span className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ex : Lycée Jean Moulin"
                aria-invalid={nameError != null}
              />
              {nameError && <p className="text-[12px] text-[var(--danger)]">{nameError}</p>}
            </div>

            {/* Contact : nom + téléphone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact_name">Nom du contact</Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  placeholder="Ex : Marie Dupont"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">Téléphone</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  value={form.contact_phone}
                  onChange={handleChange}
                  placeholder="Ex : 05 61 00 00 00"
                />
              </div>
            </div>

            {/* Partenaire : email + rôle du contact (chez les prospects, ces champs
                sont alimentés par le détecteur email, pas à la main) */}
            {isPartner && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact_email">Email du contact</Label>
                  <Input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    value={form.contact_email}
                    onChange={handleChange}
                    placeholder="Ex : c.martin@compagnons.fr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_role">Rôle</Label>
                  <Input
                    id="contact_role"
                    name="contact_role"
                    value={form.contact_role}
                    onChange={handleChange}
                    placeholder="Ex : Responsable formation"
                  />
                </div>
              </div>
            )}

            {/* Type + Canal — type figé côté partenaire */}
            <div className="grid grid-cols-2 gap-4">
              {!isPartner && (
                <div className="space-y-1.5">
                  <Label htmlFor="type">Type</Label>
                  <select id="type" name="type" value={form.type} onChange={handleChange} className={selectClass}>
                    <option value="ecole">École</option>
                    <option value="cfa">CFA</option>
                    <option value="entreprise">Entreprise</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="canal">Canal</Label>
                <select id="canal" name="canal" value={form.canal} onChange={handleChange} className={selectClass}>
                  <option value="linkedin">LinkedIn</option>
                  <option value="email">Email</option>
                  <option value="referral">Référence</option>
                  <option value="appel">Appel</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              {isPartner && (
                <div className="space-y-1.5">
                  <Label htmlFor="assigned_to">Assigné à</Label>
                  <select id="assigned_to" name="assigned_to" value={form.assigned_to} onChange={handleChange} className={selectClass}>
                    <option value="">— Non assigné</option>
                    <option value="naoufel">Naoufel</option>
                    <option value="emir">Emir</option>
                  </select>
                </div>
              )}
            </div>

            {/* Statut + Assigné — pipeline de prospection uniquement (partenaire = 'actif' d'office) */}
            {!isPartner && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="status">Statut</Label>
                  <select id="status" name="status" value={form.status} onChange={handleChange} className={selectClass}>
                    <option value="nouveau">Nouveau</option>
                    <option value="contacte">Contacté</option>
                    <option value="en_discussion">En discussion</option>
                    <option value="proposition">Proposition envoyée</option>
                    <option value="gagne">Gagné</option>
                    <option value="perdu">Perdu</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="assigned_to">Assigné à</Label>
                  <select id="assigned_to" name="assigned_to" value={form.assigned_to} onChange={handleChange} className={selectClass}>
                    <option value="">— Non assigné</option>
                    <option value="naoufel">Naoufel</option>
                    <option value="emir">Emir</option>
                  </select>
                </div>
              </div>
            )}

            {/* Prochaine action */}
            <div className="space-y-1.5">
              <Label htmlFor="next_action">Prochaine action</Label>
              <Input
                id="next_action"
                name="next_action"
                value={form.next_action}
                onChange={handleChange}
                placeholder="Ex : Envoyer démo, Rappel téléphonique…"
              />
            </div>

            {/* Date relance — pipeline de prospection uniquement */}
            {!isPartner && (
              <div className="space-y-1.5">
                <Label htmlFor="follow_up_date">Date de relance</Label>
                <Input
                  id="follow_up_date"
                  name="follow_up_date"
                  type="date"
                  value={form.follow_up_date}
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                ref={notesRef}
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                onInput={(e) => autoResize(e.currentTarget)}
                placeholder="Informations complémentaires…"
                style={{ minHeight: '150px', fontSize: '14px', padding: '12px' }}
                className="w-full overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le lead'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
