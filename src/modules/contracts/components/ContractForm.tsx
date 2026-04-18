import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Contract, ContractInsert, ContractUpdate } from '@/types/contracts'

interface ContractFormProps {
  open: boolean
  onClose: () => void
  contract?: Contract | null
  onSubmit: (data: ContractInsert | ContractUpdate) => Promise<void>
}

interface FormState {
  organization_name: string
  organization_type: string
  status: string
  license_count: string
  contact_name: string
  contact_email: string
  mrr_eur: string
  renewal_date: string
  notes: string
}

function emptyForm(): FormState {
  return {
    organization_name: '',
    organization_type: 'ecole',
    status: 'prospect',
    license_count: '0',
    contact_name: '',
    contact_email: '',
    mrr_eur: '',
    renewal_date: '',
    notes: '',
  }
}

function contractToForm(contract: Contract): FormState {
  return {
    organization_name: contract.organization_name,
    organization_type: contract.organization_type,
    status: contract.status,
    license_count: String(contract.license_count),
    contact_name: contract.contact_name ?? '',
    contact_email: contract.contact_email ?? '',
    mrr_eur: contract.mrr_eur != null ? String(contract.mrr_eur) : '',
    renewal_date: contract.renewal_date ?? '',
    notes: contract.notes ?? '',
  }
}

const selectClass =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

export function ContractForm({ open, onClose, contract, onSubmit }: ContractFormProps) {
  const isEdit = contract != null
  const [form, setForm] = useState<FormState>(emptyForm())
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync form when contract prop changes
  useEffect(() => {
    if (open) {
      setForm(contract ? contractToForm(contract) : emptyForm())
      setNameError(null)
    }
  }, [open, contract])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'organization_name') setNameError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.organization_name.trim()) {
      setNameError("Le nom de l'organisation est requis.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Omit<ContractInsert, 'contact_phone' | 'created_by'> = {
        organization_name: form.organization_name.trim(),
        organization_type: form.organization_type as ContractInsert['organization_type'],
        status: form.status as ContractInsert['status'],
        license_count: parseInt(form.license_count, 10) || 0,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        mrr_eur: form.mrr_eur !== '' ? parseFloat(form.mrr_eur) : null,
        renewal_date: form.renewal_date || null,
        notes: form.notes.trim() || null,
      }
      await onSubmit(payload as ContractInsert)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-xl"
        >
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
              {isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
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
            {/* Organisation name */}
            <div className="space-y-1.5">
              <Label htmlFor="organization_name">
                Nom de l'organisation <span className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="organization_name"
                name="organization_name"
                value={form.organization_name}
                onChange={handleChange}
                placeholder="Ex : CFA Compagnons du Devoir"
                aria-invalid={nameError != null}
              />
              {nameError && (
                <p className="text-[12px] text-[var(--danger)]">{nameError}</p>
              )}
            </div>

            {/* Type + Statut */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="organization_type">Type</Label>
                <select
                  id="organization_type"
                  name="organization_type"
                  value={form.organization_type}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="ecole">École</option>
                  <option value="cfa">CFA</option>
                  <option value="entreprise">Entreprise</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Statut</Label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="prospect">Prospect</option>
                  <option value="negotiation">Négociation</option>
                  <option value="signe">Signé</option>
                  <option value="actif">Actif</option>
                  <option value="resilie">Résilié</option>
                </select>
              </div>
            </div>

            {/* Licences + MRR */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="license_count">Licences</Label>
                <Input
                  id="license_count"
                  name="license_count"
                  type="number"
                  min={0}
                  value={form.license_count}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mrr_eur">MRR (€/mois)</Label>
                <Input
                  id="mrr_eur"
                  name="mrr_eur"
                  type="number"
                  step={0.01}
                  min={0}
                  value={form.mrr_eur}
                  onChange={handleChange}
                  placeholder="360"
                />
              </div>
            </div>

            {/* Contact name + email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact_name">Contact</Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  placeholder="Prénom Nom"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_email">Email contact</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={handleChange}
                  placeholder="contact@exemple.fr"
                />
              </div>
            </div>

            {/* Renouvellement */}
            <div className="space-y-1.5">
              <Label htmlFor="renewal_date">Date de renouvellement</Label>
              <Input
                id="renewal_date"
                name="renewal_date"
                type="date"
                value={form.renewal_date}
                onChange={handleChange}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Informations complémentaires..."
                className="w-full resize-none rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Enregistrement...'
                  : isEdit
                  ? 'Enregistrer'
                  : 'Créer le contrat'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
