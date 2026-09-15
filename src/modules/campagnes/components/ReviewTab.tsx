import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, MoreHorizontal, Check, Mail, Phone, PhoneIncoming, PhoneMissed, PhoneForwarded, PhoneOff, ThumbsUp } from 'lucide-react'
import { format, differenceInCalendarDays, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SendBlockedError, nextStep } from '@/hooks/useCampaigns'
import type { UseCampaignResult } from '@/hooks/useCampaigns'
import type { Campaign, CallResult, MessageCheck, ReviewItem } from '@/types/campagnes'
import { CALL_RESULT_LABELS } from '@/types/campagnes'

interface ReviewTabProps {
  data: UseCampaignResult
  campaign: Campaign
  initialMessageId: string | null
}

const AI_YELLOW = '#FFF4C2'

const CALL_ICONS: Record<CallResult, typeof PhoneIncoming> = {
  joint: PhoneIncoming,
  pas_repondu: PhoneMissed,
  rappel: PhoneForwarded,
  refus: PhoneOff,
  interesse: ThumbsUp,
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Corps du brouillon en HTML : les [[ ]] deviennent des <mark> jaunes. */
function bodyHtml(body: string): string {
  return escapeHtml(body).replace(/\[\[/g, `<mark style="background:${AI_YELLOW};color:inherit;border-radius:3px;padding:0 2px">`).replace(/\]\]/g, '</mark>')
}

function DueChip({ item }: { item: ReviewItem }) {
  if (item.status !== 'draft') {
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>Validé</span>
  }
  const late = differenceInCalendarDays(new Date(), new Date(item.due_at))
  if (late > 0) {
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>En retard {late} j</span>
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={late === 0 ? { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' } : { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
      {late === 0 ? "Aujourd'hui" : format(new Date(item.due_at), 'dd/MM', { locale: fr })}
    </span>
  )
}

function CheckLine({ check }: { check: MessageCheck }) {
  const color = check.status === 'ok' ? 'var(--success)' : check.status === 'warn' ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="flex gap-2 py-1 text-[12.5px] text-[var(--text-primary)]">
      <span className="font-bold" style={{ color }} aria-hidden>{check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✕'}</span>
      <span>{check.label}</span>
    </div>
  )
}

/** Onglet Revue : file des brouillons, mail tel qu'il sera reçu, panneau « pourquoi / lu / vérifié ». */
export function ReviewTab({ data, campaign, initialMessageId }: ReviewTabProps) {
  const { items, steps, sendMessage, skipMessage, postponeMessage, stopEnrollment, completeCall } = data
  const { toReview, scheduled, validated } = useMemo(() => {
    const now = Date.now()
    const active = items.filter((m) => m.status === 'draft' && m.enrollment.status === 'active')
    const due = active.filter((m) => new Date(m.due_at).getTime() <= now)
    const byDue = (a: ReviewItem, b: ReviewItem) => a.due_at.localeCompare(b.due_at)
    const weekAgo = subDays(new Date(), 7).toISOString()
    return {
      toReview: [...due.filter((m) => m.kind === 'email').sort(byDue), ...due.filter((m) => m.kind === 'call').sort(byDue)],
      scheduled: active.filter((m) => new Date(m.due_at).getTime() > now).sort(byDue),
      validated: items
        .filter((m) => (m.status === 'sent' || m.status === 'done') && (m.sent_at || m.updated_at) >= weekAgo)
        .sort((a, b) => (b.sent_at || b.updated_at).localeCompare(a.sent_at || a.updated_at)),
    }
  }, [items])

  const [selectedId, setSelectedId] = useState<string | null>(initialMessageId)
  const [mobileOpen, setMobileOpen] = useState(Boolean(initialMessageId))
  const [subject, setSubject] = useState('')
  const [blocked, setBlocked] = useState<MessageCheck[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<CallResult | null>(null)
  const [note, setNote] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  const selected = items.find((m) => m.id === selectedId) || (selectedId == null ? toReview[0] : undefined) || null
  const selectedKey = selected?.id ?? null
  const selectedSubject = selected?.subject || ''

  useEffect(() => {
    setSubject(selectedSubject)
    setBlocked(null)
    setOutcome(null)
    setNote('')
  }, [selectedKey, selectedSubject])

  function select(item: ReviewItem) {
    setSelectedId(item.id)
    setMobileOpen(true)
  }

  /** Après une action sur le brouillon courant : passer au suivant de la file. */
  function goNext(currentId: string) {
    const next = toReview.find((m) => m.id !== currentId) || null
    setSelectedId(next ? next.id : null)
    if (!next) setMobileOpen(false)
  }

  async function handleSend() {
    if (!selected) return
    const body = (bodyRef.current?.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
    setBusy(true)
    setBlocked(null)
    try {
      await sendMessage(selected.id, subject.trim(), body)
      const remaining = toReview.filter((m) => m.id !== selected.id).length
      toast.success(`Envoyé à ${selected.enrollment.lead.name}. ${remaining} restant${remaining > 1 ? 's' : ''}.`)
      goNext(selected.id)
    } catch (err) {
      if (err instanceof SendBlockedError) {
        setBlocked(err.checks)
        toast.error(`Envoi bloqué : ${err.checks.map((c) => c.label).join(' · ')}`)
      } else {
        toast.error("L'envoi a échoué.")
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleOther(action: 'postpone' | 'skip' | 'stop') {
    if (!selected) return
    setBusy(true)
    try {
      if (action === 'postpone') { await postponeMessage(selected.id, 1); toast.success('Décalé à demain.') }
      if (action === 'skip') { await skipMessage(selected.id); toast.success('Étape sautée.') }
      if (action === 'stop') { await stopEnrollment(selected.enrollment.id); toast.success(`Séquence arrêtée pour ${selected.enrollment.lead.name}.`) }
      goNext(selected.id)
    } catch {
      toast.error('Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCall() {
    if (!selected || !outcome) return
    setBusy(true)
    try {
      await completeCall(selected.id, outcome, note)
      toast.success('Appel enregistré.')
      goNext(selected.id)
    } catch {
      toast.error("Impossible d'enregistrer l'appel.")
    } finally {
      setBusy(false)
    }
  }

  const listGroup = (title: string, list: ReviewItem[], dim = false) => (
    <>
      <div className="flex justify-between px-3.5 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
        <span>{title}</span><span className="tabular-nums">{list.length}</span>
      </div>
      {list.length === 0 && <p className="px-3.5 pb-2 text-[12.5px] text-[var(--text-muted)]">Rien ici.</p>}
      {list.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => select(m)}
          aria-pressed={selected?.id === m.id}
          className={cn(
            'grid w-full grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-[var(--border-color)] px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--bg-primary)]',
            selected?.id === m.id && 'bg-[var(--memovia-violet-light)] hover:bg-[var(--memovia-violet-light)]',
            dim && 'opacity-70',
          )}
        >
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full text-[11px] font-bold" style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}>{initials(m.enrollment.lead.name)}</span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold leading-tight text-[var(--text-primary)]">{m.enrollment.lead.name}</span>
            <span className="block truncate text-[12px] text-[var(--text-muted)]">{m.kind === 'call' ? '✆ ' : ''}{m.step.name}</span>
          </span>
          <DueChip item={m} />
        </button>
      ))}
    </>
  )

  const lead = selected?.enrollment.lead
  const following = selected ? nextStep(selected.step, steps) : null
  const okChecks = (selected?.checks || []).filter((c) => c.status === 'ok')
  const badChecks = (selected?.checks || []).filter((c) => c.status !== 'ok')
  const readOnly = selected?.status !== 'draft'

  return (
    <div className="grid min-h-[70vh] grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)_300px]">
      {/* ── Liste ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col border-[var(--border-color)] md:border-r">
        {listGroup('À revoir', toReview)}
        {listGroup('Programmés', scheduled, true)}
        {listGroup('Validés cette semaine', validated, true)}
      </div>

      {/* ── Mail ou fiche d'appel ──────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-col bg-[var(--bg-secondary)]',
          mobileOpen ? 'fixed inset-0 z-50 flex overflow-y-auto' : 'hidden',
          'md:static md:z-auto md:flex md:overflow-visible',
        )}
      >
        {!selected ? (
          <div className="px-8 py-20 text-center">
            <p className="text-[18px] font-semibold text-[var(--text-primary)]">Tout est validé.</p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">Les brouillons apparaissent ici à chaque actualisation (cron à 7h, ou le bouton Actualiser).</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--border-color)] px-5 py-3">
              <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] md:hidden">
                <ChevronLeft className="h-4 w-4" /> Revue
              </button>
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}>{initials(lead!.name)}</span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{lead!.name}</div>
                <div className="truncate text-[12.5px] text-[var(--text-muted)]">{lead!.contact_name || 'Contact à identifier'}{lead!.contact_role ? `, ${lead!.contact_role}` : ''} · {lead!.contact_email}</div>
              </div>
              <span className="ml-auto hidden shrink-0 items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--text-secondary)] md:inline-flex">
                {selected.kind === 'call' ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />} {selected.step.name}
              </span>
            </div>

            {selected.kind === 'email' ? (
              <>
                <div className="flex-1 px-5 pb-5">
                  <div className="flex gap-2.5 border-b border-[var(--border-color)] py-2.5 text-[13.5px]">
                    <span className="w-14 shrink-0 text-[var(--text-muted)]">De</span>
                    {/* Même nom que le From posé par campaign-send. */}
                    <span className="text-[var(--text-primary)]">Emir Boutaleb &lt;{campaign.sender_email}&gt;</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border-color)] py-2.5 text-[13.5px]">
                    <span className="w-14 shrink-0 text-[var(--text-muted)]">À</span>
                    <span className="flex-1 text-[var(--text-primary)]">{lead!.contact_email}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}>
                      {selected.enrollment.thread_message_id ? 'Même fil que le premier mail' : 'Nouveau fil'}
                    </span>
                  </div>
                  <div className="flex gap-2.5 border-b border-[var(--border-color)] py-2.5 text-[13.5px]">
                    <label htmlFor="review-subject" className="w-14 shrink-0 text-[var(--text-muted)]">Objet</label>
                    <input
                      id="review-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      readOnly={readOnly}
                      className="w-full bg-transparent text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  {selected.context?.previous_body && (
                    <details className="border-b border-[var(--border-color)] py-2 text-[12.5px] text-[var(--text-muted)]">
                      <summary className="cursor-pointer">
                        Le mail{selected.context.previous_subject ? ` « ${selected.context.previous_subject} »` : ''} auquel on répond
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-secondary)]">{selected.context.previous_body}</div>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-3.5 py-2 text-[11.5px] text-[var(--text-muted)]">
                    <span><i className="mr-1 inline-block h-3 w-3 rounded-[3px] align-[-2px]" style={{ backgroundColor: AI_YELLOW }} />Écrit par l'IA pour cette cible : c'est ça qu'on relit</span>
                    <span><i className="mr-1 inline-block h-3 w-3 rounded-[3px] border border-[var(--border-color)] bg-[var(--bg-secondary)] align-[-2px]" />Gabarit validé, identique pour tous</span>
                  </div>
                  <div
                    key={selected.id}
                    ref={bodyRef}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Corps du mail"
                    className="min-h-[200px] whitespace-pre-wrap py-1.5 text-[13.5px] leading-[1.65] text-[var(--text-primary)] outline-none"
                    dangerouslySetInnerHTML={{ __html: bodyHtml(selected.body || '') }}
                  />
                  {blocked && (
                    <div className="mt-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
                      <p className="font-semibold">Envoi bloqué</p>
                      {blocked.map((c) => <div key={c.label}>✕ {c.label}</div>)}
                    </div>
                  )}
                </div>

                {readOnly ? (
                  <div className="border-t border-[var(--border-color)] px-5 py-3 text-[12.5px] text-[var(--text-muted)]">
                    Envoyé le {format(new Date(selected.sent_at || selected.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}.
                  </div>
                ) : (
                  <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-5 py-3">
                    <span className="w-full text-[12.5px] text-[var(--text-muted)] md:mr-auto md:w-auto">
                      <b className="font-semibold text-[var(--text-primary)]">{selected.step.name}</b>
                      {following ? ` · après envoi : ${following.name.toLowerCase()} dans ${following.wait_days} jour${following.wait_days > 1 ? 's' : ''}` : ' · dernière étape'}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" disabled={busy} className="gap-1"><MoreHorizontal className="h-4 w-4" /> Autres</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleOther('postpone')}>Décaler à demain</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleOther('skip')}>Sauter cette étape</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleOther('stop')} className="text-[var(--danger)]">Arrêter la séquence</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="brand" onClick={handleSend} disabled={busy || !subject.trim()} className="h-11 flex-1 gap-1.5 md:h-10 md:flex-none">
                      <Check className="h-4 w-4" /> {busy ? 'Envoi…' : 'Valider et envoyer'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              /* ── Fiche d'appel ─────────────────────────────────────────── */
              <div className="flex-1 space-y-4 px-5 py-4">
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                  <div className="text-[13px] text-[var(--text-secondary)]">{lead!.contact_name || 'Demander le référent handicap au standard'}{lead!.contact_role ? ` · ${lead!.contact_role}` : ''}</div>
                  {lead!.contact_phone ? (
                    <a href={`tel:${lead!.contact_phone.replace(/\s/g, '')}`} className="mt-1 block text-[26px] font-semibold tabular-nums text-[var(--memovia-violet)] hover:underline">{lead!.contact_phone}</a>
                  ) : (
                    <p className="mt-1 text-[15px] font-medium text-[var(--text-muted)]">Numéro à trouver sur le site de l'établissement</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Script</p>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-primary)]">{selected.step.ai_brief || 'Aucun script pour cette étape.'}</p>
                </div>
                {readOnly ? (
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Appel enregistré{selected.outcome ? ` : ${CALL_RESULT_LABELS[selected.outcome]}` : ''}{selected.note ? ` · ${selected.note}` : ''}.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Issue de l'appel">
                      {(Object.keys(CALL_ICONS) as CallResult[]).map((o) => {
                        const Icon = CALL_ICONS[o]
                        const active = outcome === o
                        return (
                          <button
                            key={o}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setOutcome(o)}
                            className={cn(
                              'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[12px] font-medium transition-colors',
                              active ? 'border-[var(--memovia-violet)] bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]' : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]',
                            )}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                            {CALL_RESULT_LABELS[o]}
                          </button>
                        )
                      })}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note : qui a répondu, ce qui a été dit, qui rappeler"
                      rows={3}
                      aria-label="Note d'appel"
                      className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
                    />
                    <div className="sticky bottom-0 bg-[var(--bg-secondary)] py-2">
                      <Button variant="brand" onClick={handleCall} disabled={!outcome || busy} className="h-11 w-full md:h-10 md:w-auto">
                        {busy ? 'Enregistrement…' : "Enregistrer l'appel"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Panneau droit ──────────────────────────────────────────────────── */}
      <aside className="hidden content-start gap-4 border-l border-[var(--border-color)] bg-[var(--bg-primary)] p-4 md:grid">
        {selected && (
          <>
            {selected.context?.why && (
              <div>
                <h4 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Pourquoi ce mail</h4>
                <p className="text-[13px] text-[var(--text-primary)]">{selected.context.why}</p>
              </div>
            )}
            {selected.context?.facts && selected.context.facts.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Ce que l'IA a lu</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-[12.5px]">
                  {selected.context.facts.map(([k, v], i) => (
                    <div key={`${k}-${i}`} className="contents">
                      <dt className="text-[var(--text-muted)]">{k}</dt>
                      <dd className="text-[var(--text-primary)]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {(selected.checks || blocked) && (
              <div>
                <h4 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Vérifié avant que vous le voyiez</h4>
                {okChecks.length > 0 && (
                  <details className="text-[12.5px]">
                    <summary className="cursor-pointer py-1 text-[var(--text-primary)]"><span className="font-bold text-[var(--success)]">✓</span> {okChecks.length} vérification{okChecks.length > 1 ? 's' : ''} passée{okChecks.length > 1 ? 's' : ''}</summary>
                    <div className="pl-4">{okChecks.map((c, i) => <CheckLine key={i} check={c} />)}</div>
                  </details>
                )}
                {badChecks.map((c, i) => <CheckLine key={i} check={c} />)}
                {blocked?.map((c, i) => <CheckLine key={`b-${i}`} check={{ ...c, status: 'ko' }} />)}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
