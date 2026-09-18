import { ChevronLeft, Phone } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { FIRST_QUESTION, scriptSection } from '@/lib/callScript'
import { parisDay } from '@/lib/agenda'
import type { ClassifiedCall, LeadCallLite, SessionRow, ThreadEntry } from '@/types/agenda'
import type { Task } from '@/types/tasks'
import { CALL_OUTCOME_LABELS, type CallResult } from '@/types/leads'
import { FORBIDDEN, FORBIDDEN_ORAL } from '@/modules/campagnes/forbidden'
import { TONE_STYLE, dateFr, rowChip, rowLeadName } from '../display'
import { CallOutcomeBar } from './CallOutcomeBar'

interface CallSheetProps {
  row: SessionRow
  thread: ThreadEntry[]
  calls: LeadCallLite[]
  openTasks: Task[]
  script: string | null
  onClose: () => void
  onRecord: (call: ClassifiedCall, outcome: CallResult, note: string, followUp?: string | null) => Promise<void>
  onPostpone: (call: ClassifiedCall) => Promise<void>
  suggestFollowUp: (outcome: CallResult) => string | null
}

// Même rendu que la fiche argumentaire (LeadPitchDialog) : why et pitch sont des notes en markdown.
const mdClass =
  'text-[13.5px] leading-relaxed text-[var(--text-primary)] [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[11px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-[var(--text-secondary)] [&_p]:mt-1 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-0.5'

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border-subtle)] py-3">
      <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{title}</h3>
      {children}
    </section>
  )
}

/**
 * La fiche d'appel, lisible en 30 secondes : qui, l'objectif, où on en est, pourquoi eux, quoi
 * demander, quoi ne pas dire, ce qui s'est déjà dit. En bas, l'issue de l'appel en un geste.
 */
export function CallSheet({ row, thread, calls, openTasks, script, onClose, onRecord, onPostpone, suggestFollowUp }: CallSheetProps) {
  const lead = row.call.lead
  const pending = row.kind === 'pending' ? row.call : null
  const campaign = pending?.campaign ?? null
  const chip = rowChip(row)
  const questions = scriptSection(script, 'Questions de qualification')
  const objections = scriptSection(script, 'Objections')

  const eyebrow = campaign
    ? `${campaign.campaignEmoji} ${campaign.campaignName} › ${campaign.stepName}`
    : pending
      ? 'Relance · hors campagne'
      : 'Appel passé'

  const objective = campaign?.stepBrief?.trim() || lead?.next_action?.trim()
    || 'Obtenir le référent handicap nommé et un échange avec lui. Au standard : demander son nom et son créneau, ne pas présenter le produit.'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[var(--border-color)] px-4 pb-3 pt-3.5">
        <button type="button" onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)]">
          <ChevronLeft className="h-4 w-4" /> Agenda
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--memovia-violet)]">{eyebrow}</div>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={TONE_STYLE[chip.tone]}>{chip.label}</span>
        </div>
        <h2 className="mt-0.5 text-[20px] font-bold tracking-tight text-[var(--text-primary)]">{rowLeadName(row)}</h2>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13.5px]">
            <b className="block text-[var(--text-primary)]">{lead?.contact_name || 'Contact à identifier'}</b>
            <span className="text-[12.5px] text-[var(--text-secondary)]">{lead?.contact_role || 'rôle à confirmer'}</span>
          </div>
          {lead?.contact_phone ? (
            <Button asChild variant="brand" className="h-10 gap-1.5">
              <a href={tel(lead.contact_phone)}><Phone className="h-4 w-4" /> Appeler · {lead.contact_phone}</a>
            </Button>
          ) : (
            <span className="text-[12.5px] text-[var(--text-muted)]">Numéro à trouver sur le site de l’établissement</span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <section className="py-3">
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Objectif de l’appel</h3>
          <p className="text-[13.5px] text-[var(--text-primary)]">{objective}</p>
        </section>

        <Section title="Où on en est">
          {thread.length === 0 ? (
            <p className="text-[13.5px] text-[var(--text-secondary)]">
              {campaign ? 'Aucun mail parti pour cette séquence.' : `Hors campagne.${lead?.last_contact_date ? ` Dernier contact le ${dateFr(lead.last_contact_date)}.` : ' Aucun contact noté.'}`}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {thread.map((t) => (
                <li key={t.id} className="relative pl-3.5 text-[13.5px] text-[var(--text-primary)] before:absolute before:left-0 before:top-[9px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--text-muted)]">
                  {t.kind === 'email'
                    ? <>{t.stepName} — envoyé le {dateFr(parisDay(t.at))}{t.subject ? <> · « {t.subject} »</> : null}</>
                    : <>{t.stepName} — le {dateFr(parisDay(t.at))} : {t.outcome ? CALL_OUTCOME_LABELS[t.outcome] : 'fait'}{t.note ? ` · ${t.note}` : ''}</>}
                </li>
              ))}
              {campaign && <li className="pl-3.5 text-[13.5px] text-[var(--text-secondary)]">Réponse écrite : aucune à ce jour (sinon la séquence se serait arrêtée).</li>}
            </ul>
          )}
        </Section>

        <Section title="Pourquoi eux">
          <div className={mdClass}><ReactMarkdown remarkPlugins={[remarkGfm]}>{lead?.why ?? 'Pas encore renseigné, à compléter sur la fiche du lead.'}</ReactMarkdown></div>
        </Section>

        <Section title="Pitch">
          <div className={mdClass}><ReactMarkdown remarkPlugins={[remarkGfm]}>{lead?.pitch ?? 'Pas encore renseigné, à compléter sur la fiche du lead.'}</ReactMarkdown></div>
        </Section>

        <Section title="À poser pendant l’appel">
          {questions ? (
            <div className={mdClass}><ReactMarkdown remarkPlugins={[remarkGfm]}>{questions}</ReactMarkdown></div>
          ) : (
            <>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{FIRST_QUESTION}</p>
              <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Le script partagé est encore à rédiger (Leads › Script & docs) : ses questions apparaîtront ici.</p>
            </>
          )}
          {!lead?.contact_name && <p className="mt-2 text-[13px] text-[var(--warning)]">Nom du référent handicap à obtenir et à confirmer avant tout envoi.</p>}
        </Section>

        {objections && (
          <Section title="Objections courantes">
            <div className={mdClass}><ReactMarkdown remarkPlugins={[remarkGfm]}>{objections}</ReactMarkdown></div>
          </Section>
        )}

        <Section title="Interdits">
          <ul className="space-y-0.5 text-[13px] leading-relaxed text-[var(--danger)]">
            {[...FORBIDDEN, ...FORBIDDEN_ORAL].map((f) => <li key={f}>{f}</li>)}
          </ul>
        </Section>

        <Section title="Historique · 90 derniers jours">
          {calls.length === 0 && openTasks.length === 0 && <p className="text-[13.5px] text-[var(--text-secondary)]">Aucun appel précédent, aucun engagement ouvert.</p>}
          {calls.length > 0 && (
            <ul className="space-y-1.5">
              {calls.map((c) => (
                <li key={c.id} className="text-[13.5px] text-[var(--text-primary)]">
                  <b className="font-semibold">{dateFr(parisDay(c.called_at))}</b> · {CALL_OUTCOME_LABELS[c.outcome]}
                  {c.cr ? <span className="block text-[13px] text-[var(--text-secondary)]">{c.cr}</span> : c.note ? <span className="block text-[13px] text-[var(--text-secondary)]">{c.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
          {openTasks.length > 0 && (
            <>
              <p className="mt-2 text-[12px] font-medium text-[var(--text-secondary)]">Engagements ouverts</p>
              <ul className="mt-1 space-y-1">
                {openTasks.map((t) => (
                  <li key={t.id} className="text-[13.5px] text-[var(--text-primary)]">{t.title}{t.due_date ? <span className="text-[var(--text-secondary)]"> · échéance {dateFr(t.due_date)}</span> : null}</li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      {pending ? (
        <CallOutcomeBar
          onRecord={(outcome, note, followUp) => onRecord(pending, outcome, note, followUp)}
          onPostpone={() => onPostpone(pending)}
          suggestFollowUp={pending.campaign ? undefined : suggestFollowUp}
        />
      ) : (
        <footer className="shrink-0 border-t border-[var(--border-color)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
          {row.kind === 'done' && !row.call.debriefed
            ? 'Appel enregistré. Son compte rendu reste à écrire : le débrief de séance arrive à l’étape suivante du chantier.'
            : 'Appel enregistré, compte rendu validé.'}
        </footer>
      )}
    </div>
  )
}
