import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCampaigns } from '@/hooks/useCampaigns'
import { CampaignStatusChip } from './CampagnePage'
import { LEAD_ASSIGNEE_LABELS } from '@/types/leads'

/** Liste des campagnes de prospection (spec 2026-09-15-campagnes-design.md). */
export default function CampagnesPage() {
  const { campaigns, isLoading, error, duplicateCampaign } = useCampaigns()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const draftsTotal = campaigns.reduce((n, c) => n + c.draftsDue, 0)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const id = await duplicateCampaign(name.trim())
      toast.success(`Campagne « ${name.trim()} » créée.`)
      setDialogOpen(false)
      setName('')
      navigate(`/campagnes/${id}`)
    } catch {
      toast.error('Impossible de créer la campagne.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Campagnes</h1>
            {!isLoading && draftsTotal > 0 && (
              <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
                {draftsTotal} à revoir
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Séquences mail + appels sur les leads existants. Rien ne part sans validation.
          </p>
        </div>
        <Button variant="brand" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </Button>
      </motion.header>

      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[...Array(2)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-[var(--border-color)]" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucune campagne</p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">La migration 00054 crée la campagne « CFA · référent handicap ».</p>
          </div>
        ) : (
          <>
            {/* Desktop : table dense */}
            <table className="hidden w-full text-sm md:table" aria-label="Campagnes">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  {['Campagne', 'Statut', 'Contacts actifs', 'Brouillons à revoir', 'Responsable', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-primary)]">
                    <td className="px-4 py-3">
                      <Link to={`/campagnes/${c.id}`} className="font-semibold text-[var(--text-primary)] hover:underline">
                        <span className="mr-2">{c.emoji}</span>{c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><CampaignStatusChip status={c.status} /></td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-primary)]">{c.activeCount}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {c.draftsDue > 0 ? (
                        <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>{c.draftsDue}</span>
                      ) : <span className="text-[var(--text-muted)]">0</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{c.owner ? LEAD_ASSIGNEE_LABELS[c.owner] : ''}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm" className="gap-1">
                        <Link to={`/campagnes/${c.id}`}>Ouvrir <ArrowRight className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile : cartes */}
            <ul className="divide-y divide-[var(--border-color)] md:hidden">
              {campaigns.map((c) => (
                <li key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{c.emoji} {c.name}</div>
                      <div className="mt-1 text-[13px] text-[var(--text-secondary)]">
                        {c.activeCount} en séquence · {c.draftsDue} à revoir
                      </div>
                    </div>
                    <CampaignStatusChip status={c.status} />
                  </div>
                  <Button asChild variant="outline" className="mt-3 h-10 w-full">
                    <Link to={`/campagnes/${c.id}`}>Ouvrir</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.div>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">Nouvelle campagne</Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]" aria-label="Fermer"><X className="h-4 w-4" /></button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mb-4 text-[13px] text-[var(--text-secondary)]">
              Copie la séquence « CFA · référent handicap » (5 étapes) sous un nouveau nom, en brouillon.
            </Dialog.Description>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">Nom</Label>
                <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Vague 2 · réseaux" autoFocus />
              </div>
              <Button type="submit" variant="brand" disabled={!name.trim() || creating} className="w-full">
                {creating ? 'Création…' : 'Créer la campagne'}
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </motion.div>
  )
}
