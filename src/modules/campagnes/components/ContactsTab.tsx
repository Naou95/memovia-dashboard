import { useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, Upload, Plus, X, Square, Play, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useLeads } from '@/hooks/useLeads'
import { currentStep, isProspect } from '@/hooks/useCampaigns'
import type { UseCampaignResult, TickResult } from '@/hooks/useCampaigns'
import type { CampaignMessage, CampaignStep, EnrollmentWithLead } from '@/types/campagnes'
import { CALL_RESULT_LABELS, STOP_REASON_LABELS } from '@/types/campagnes'

interface ContactsTabProps {
  data: UseCampaignResult
  onOpenReview: (messageId?: string) => void
}

type DerivedStatus = 'À revoir' | 'En attente' | 'A répondu' | 'Refus' | 'En pause' | 'Terminée' | 'Pas lancée'

const STATUS_STYLE: Record<DerivedStatus, React.CSSProperties> = {
  'À revoir': { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' },
  'En attente': { backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' },
  'A répondu': { backgroundColor: 'var(--success-bg)', color: 'var(--success)' },
  'Refus': { backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' },
  'En pause': { backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' },
  'Terminée': { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' },
  'Pas lancée': { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' },
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'
}

function tickToast(r: TickResult | null, enrolled: number) {
  const parts = [`${enrolled} contact${enrolled > 1 ? 's' : ''} ajouté${enrolled > 1 ? 's' : ''}`]
  if (r) parts.push(`${r.drafts_created} brouillon${r.drafts_created > 1 ? 's' : ''} créé${r.drafts_created > 1 ? 's' : ''}`)
  toast.success(parts.join(' · ') + '.')
}

interface Row {
  enrollment: EnrollmentWithLead
  draft: CampaignMessage | null
  status: DerivedStatus
  stepLabel: string
  activity: string
}

function deriveRow(e: EnrollmentWithLead, steps: CampaignStep[], messages: CampaignMessage[], now: number): Row {
  const own = messages.filter((m) => m.enrollment_id === e.id)
  const draft = own.find((m) => m.status === 'draft') || null
  const step = currentStep(e, steps)
  let status: DerivedStatus
  if (e.status === 'done') status = 'Terminée'
  else if (e.status === 'stopped') status = e.stop_reason === 'replied' || e.stop_reason === 'interested' ? 'A répondu' : e.stop_reason === 'refused' || e.stop_reason === 'lost' ? 'Refus' : 'En pause'
  else if (own.length === 0) status = 'Pas lancée'
  else if (draft && new Date(draft.due_at).getTime() <= now) status = 'À revoir'
  else status = 'En attente'

  const stepLabel =
    e.status === 'stopped' ? `Arrêtée · ${(STOP_REASON_LABELS[e.stop_reason || ''] || 'à la main').toLowerCase()}`
    : e.status === 'done' ? 'Séquence terminée'
    : own.length === 0 ? 'Pas lancée'
    : step ? `${step.name} · ${draft ? 'à revoir' : `le ${format(new Date(e.next_due_at), 'dd/MM', { locale: fr })}`}` : ''

  const past = own.filter((m) => m.status === 'sent' || m.status === 'done').sort((a, b) => (b.sent_at || b.updated_at).localeCompare(a.sent_at || a.updated_at))
  const last = past[0]
  const lastStep = last && steps.find((s) => s.id === last.step_id)
  const activity = last
    ? last.kind === 'call'
      ? `Appel ${format(new Date(last.updated_at), 'dd/MM', { locale: fr })}${last.outcome ? ` · ${CALL_RESULT_LABELS[last.outcome].toLowerCase()}` : ''}`
      : `${lastStep?.name || 'Mail'} envoyé le ${format(new Date(last.sent_at || last.updated_at), 'dd/MM', { locale: fr })}`
    : `Inscrit le ${format(new Date(e.started_at), 'dd/MM', { locale: fr })}`
  return { enrollment: e, draft, status, stepLabel, activity }
}

function StepDots({ enrollment, steps }: { enrollment: EnrollmentWithLead; steps: CampaignStep[] }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {steps.map((s) => {
        const p = s.position
        const cur = enrollment.current_position
        let cls = 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
        if (enrollment.status === 'done' || p < cur) cls = 'border-[var(--memovia-violet)] bg-[var(--memovia-violet)]'
        else if (enrollment.status === 'stopped') cls = p === cur && (enrollment.stop_reason === 'replied' || enrollment.stop_reason === 'interested') ? 'border-[var(--success)] bg-[var(--success)]' : 'border-[var(--border-color)] bg-[var(--border-color)]'
        else if (p === cur) cls = 'border-[var(--memovia-violet)] ring-[3px] ring-[var(--memovia-violet-light)] bg-[var(--bg-secondary)]'
        return <i key={s.id} className={cn('block h-2.5 w-2.5 rounded-full border-[1.5px]', cls)} />
      })}
    </div>
  )
}

/** Dialog « Ajouter des contacts » : leads non archivés, avec email, pas encore inscrits. */
function AddContactsDialog({ enrolledLeadIds, onClose, onConfirm }: { enrolledLeadIds: Set<string>; onClose: () => void; onConfirm: (ids: string[]) => Promise<void> }) {
  const { leads, isLoading } = useLeads()
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const q = query.trim().toLowerCase()
  const candidates = leads
    .filter((l) => isProspect(l) && l.contact_email && !enrolledLeadIds.has(l.id))
    .filter((l) => !q || [l.name, l.contact_name, l.contact_email].some((v) => (v || '').toLowerCase().includes(q)))

  function toggle(id: string) {
    setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function submit() {
    setSubmitting(true)
    try {
      await onConfirm([...checked])
      onClose()
    } catch {
      // Le parent a toasté l'erreur ; on reste ouvert pour réessayer.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">Ajouter des contacts</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-3 text-[13px] text-[var(--text-secondary)]">Prospects (nouveau ou contacté) avec un email, pas encore dans cette campagne.</Dialog.Description>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un établissement, un contact, un email" className="mb-3" />
          <ul className="min-h-0 flex-1 divide-y divide-[var(--border-color)] overflow-y-auto rounded-lg border border-[var(--border-color)]">
            {isLoading && <li className="p-3 text-[13px] text-[var(--text-muted)]">Chargement…</li>}
            {!isLoading && candidates.length === 0 && <li className="p-3 text-[13px] text-[var(--text-muted)]">Aucun lead à ajouter.</li>}
            {candidates.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-primary)]">
                  <input type="checkbox" checked={checked.has(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 accent-[var(--memovia-violet)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-[var(--text-primary)]">{l.name}</span>
                    <span className="block truncate text-[12px] text-[var(--text-muted)]">{l.contact_name ? `${l.contact_name} · ` : ''}{l.contact_email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button variant="brand" className="mt-4 h-10 w-full" disabled={checked.size === 0 || submitting} onClick={submit}>
            {submitting ? 'Ajout…' : `Ajouter ${checked.size || ''} contact${checked.size > 1 ? 's' : ''}`}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Onglet Contacts : inscriptions de la campagne, ajout depuis les leads, import CSV. */
export function ContactsTab({ data, onOpenReview }: ContactsTabProps) {
  const { enrollments, steps, messages, enrollLeads, importCsv, stopEnrollment, resumeEnrollment } = data
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const now = Date.now()
  const rows = useMemo(() => enrollments.map((e) => deriveRow(e, steps, messages, now)), [enrollments, steps, messages, now])
  const q = query.trim().toLowerCase()
  const visible = rows.filter((r) => !q || [r.enrollment.lead.name, r.enrollment.lead.contact_name, r.enrollment.lead.contact_email].some((v) => (v || '').toLowerCase().includes(q)))
  const activeCount = rows.filter((r) => r.enrollment.status === 'active').length
  const toReview = rows.filter((r) => r.status === 'À revoir').length
  const enrolledLeadIds = useMemo(() => new Set(enrollments.map((e) => e.lead_id)), [enrollments])

  async function handleAdd(ids: string[]) {
    try {
      const r = await enrollLeads(ids)
      tickToast(r, ids.length)
    } catch {
      toast.error("Impossible d'ajouter ces contacts.")
      throw new Error('enroll failed') // le dialog reste ouvert
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const r = await importCsv(await file.text())
      toast.success(`${r.created} lead${r.created > 1 ? 's' : ''} créé${r.created > 1 ? 's' : ''}, ${r.reused} réutilisé${r.reused > 1 ? 's' : ''}, ${r.enrolled} inscrit${r.enrolled > 1 ? 's' : ''}${r.skipped ? `, ${r.skipped} ligne${r.skipped > 1 ? 's' : ''} sans email` : ''}${r.notProspect ? `, ${r.notProspect} déjà client ou en discussion, non inscrit${r.notProspect > 1 ? 's' : ''}` : ''}.`)
    } catch {
      toast.error("L'import a échoué.")
    } finally {
      setImporting(false)
    }
  }

  async function toggleEnrollment(row: Row) {
    setBusyId(row.enrollment.id)
    try {
      if (row.enrollment.status === 'active') {
        await stopEnrollment(row.enrollment.id)
        toast.success(`Séquence arrêtée pour ${row.enrollment.lead.name}.`)
      } else {
        await resumeEnrollment(row.enrollment.id)
        toast.success(`Séquence reprise pour ${row.enrollment.lead.name}.`)
      }
    } catch {
      toast.error('Action impossible.')
    } finally {
      setBusyId(null)
    }
  }

  const actionButtons = (row: Row, mobile: boolean) => (
    <>
      <Button variant={mobile ? 'outline' : 'ghost'} size="sm" className={cn('gap-1', mobile && 'h-10 flex-1')} onClick={() => onOpenReview(row.draft?.id)}>
        <ExternalLink className="h-3.5 w-3.5" /> Revue
      </Button>
      {row.enrollment.status !== 'done' && (
        <Button variant={mobile ? 'outline' : 'ghost'} size="sm" className={cn('gap-1', mobile && 'h-10 flex-1')} disabled={busyId === row.enrollment.id} onClick={() => toggleEnrollment(row)}>
          {row.enrollment.status === 'active' ? <><Square className="h-3.5 w-3.5" /> Arrêter</> : <><Play className="h-3.5 w-3.5" /> Reprendre</>}
        </Button>
      )}
    </>
  )

  return (
    <div>
      {/* ── Barre ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-3">
        <div className="relative w-full sm:max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par établissement, nom, email" className="pl-9" aria-label="Rechercher un contact" />
        </div>
        <span className="text-[12.5px] text-[var(--text-muted)]">
          {rows.length} contact{rows.length > 1 ? 's' : ''} · {activeCount} en séquence · {toReview} à revoir
        </span>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          <Button variant="outline" size="sm" className="h-10 flex-1 gap-1.5 sm:h-9 sm:flex-none" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> {importing ? 'Import…' : <>Importer<span className="hidden sm:inline"> un CSV</span></>}
          </Button>
          <Button variant="brand" size="sm" className="h-10 flex-1 gap-1.5 sm:h-9 sm:flex-none" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Ajouter<span className="hidden sm:inline"> des contacts</span>
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-[15px] font-medium text-[var(--text-primary)]">{rows.length === 0 ? 'Aucun contact dans cette campagne' : 'Aucun contact ne correspond'}</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Ajoute des leads existants ou importe la liste CSV du 13/09.</p>
        </div>
      ) : (
        <>
          {/* ── Desktop : table dense ─────────────────────────────────────── */}
          <table className="hidden w-full text-[13.5px] md:table" aria-label="Contacts de la campagne">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                {['Établissement', 'Contact', 'Étape', 'Statut', 'Dernière activité', ''].map((h) => (
                  <th key={h} scope="col" className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const lead = row.enrollment.lead
                return (
                  <tr key={row.enrollment.id} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-primary)]">
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}>{initials(lead.name)}</span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[var(--text-primary)]">{lead.name}</div>
                          <div className="truncate text-[12px] text-[var(--text-muted)]">{lead.source || lead.why || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="text-[var(--text-primary)]">{lead.contact_name || <span className="text-[var(--text-muted)]">Contact à identifier</span>}</div>
                      <div className="truncate text-[12px] text-[var(--text-muted)]">{lead.contact_email}</div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <StepDots enrollment={row.enrollment} steps={steps} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{row.stepLabel}</div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={STATUS_STYLE[row.status]}>{row.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-[12.5px] text-[var(--text-muted)]">{row.activity}</td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">{actionButtons(row, false)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Mobile : cartes ───────────────────────────────────────────── */}
          <ul className="divide-y divide-[var(--border-color)] md:hidden">
            {visible.map((row) => {
              const lead = row.enrollment.lead
              return (
                <li key={row.enrollment.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{lead.name}</div>
                      <div className="truncate text-[13px] text-[var(--text-secondary)]">{lead.contact_name || 'Contact à identifier'} · {lead.contact_email}</div>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={STATUS_STYLE[row.status]}>{row.status}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StepDots enrollment={row.enrollment} steps={steps} />
                    <span className="text-[12px] text-[var(--text-muted)]">{row.stepLabel}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{row.activity}</div>
                  <div className="mt-3 flex gap-2">{actionButtons(row, true)}</div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {adding && <AddContactsDialog enrolledLeadIds={enrolledLeadIds} onClose={() => setAdding(false)} onConfirm={handleAdd} />}
    </div>
  )
}
