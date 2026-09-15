import { useEffect, useState } from 'react'
import { Mail, Phone, Square, GitFork, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { UseCampaignResult, StepStats } from '@/hooks/useCampaigns'
import type { Campaign, CampaignStep } from '@/types/campagnes'

interface SequenceTabProps {
  data: UseCampaignResult
  campaign: Campaign
}

/** Interdits vérifiés par campaignText.ts avant chaque envoi (texte de la maquette). */
const FORBIDDEN = [
  '« 100 % financé par l\'OPCO », « gratuit pour vous »',
  '« partenaire Agefiph »',
  '« labellisée French Tech », « soutenue par TBSeeds »',
  '« sous 48 h », « 15 minutes », « je me permets de vous relancer », « envoyez-moi un support »',
  'Un chiffre « stagiaires » de la liste OF · logo ou accord national des Compagnons',
]

const VARIABLES: [string, string][] = [
  ['{{civilité}} {{nom}}', 'depuis la fiche du lead'],
  ['{{signature}}', 'signature Emir'],
  ['{{rgpd}}', 'pied RGPD (premier mail)'],
  ['{{objet_precedent}}', 'objet du mail précédent (relances)'],
  ['{{IA: consigne}}', 'passage écrit par l\'IA pour cette cible, surligné en jaune à la revue'],
]

function Connector({ plus }: { plus?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-5 w-0.5 bg-[var(--border-color)]" />
      {plus && (
        <>
          <div className="-my-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[13px] text-[var(--text-muted)]" aria-hidden>+</div>
          <div className="h-5 w-0.5 bg-[var(--border-color)]" />
        </>
      )}
    </div>
  )
}

function StepNode({ step, stat, selected, onSelect }: { step: CampaignStep; stat?: StepStats; selected: boolean; onSelect: () => void }) {
  const isCall = step.kind === 'call'
  const Icon = isCall ? Phone : Mail
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl border bg-[var(--bg-secondary)] text-left shadow-[var(--shadow-xs)] transition-shadow',
        selected ? 'border-[var(--memovia-violet)] ring-[3px] ring-[var(--memovia-violet-light)]' : 'border-[var(--border-color)] hover:border-[var(--text-muted)]',
      )}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 py-2 text-[12.5px] text-[var(--text-secondary)]">
        <span>
          {step.wait_days === 0 ? <>Envoyer <b className="font-semibold text-[var(--memovia-violet)]">immédiatement</b></> : <>Attendre <b className="font-semibold text-[var(--memovia-violet)]">{step.wait_days} jour{step.wait_days > 1 ? 's' : ''}</b></>}
        </span>
        <Pencil className="h-3 w-3 text-[var(--text-muted)]" aria-hidden />
      </div>
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={isCall ? { backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' } : { backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-[var(--text-primary)]">{step.name}</span>
          <span className="block truncate text-[12px] text-[var(--text-muted)]">
            {isCall ? 'Tâche · script dans la revue' : step.position === 1 ? 'Objet personnalisé · pied RGPD' : 'Même fil, réponse au mail précédent'}
          </span>
        </span>
        {stat && (
          <span className="ml-auto shrink-0 text-right text-[11.5px] leading-[1.35] text-[var(--text-muted)] tabular-nums">
            <b className="font-semibold text-[var(--text-primary)]">{stat.sent}</b> {isCall ? 'appel' : 'envoyé'}{stat.sent > 1 ? 's' : ''}<br />
            <b className="font-semibold text-[var(--text-primary)]">{stat.replies}</b> {isCall ? 'joint' : 'réponse'}{stat.replies > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}

/** Onglet Séquence : canevas à points (flux vertical, condition Oui/Non) + panneau d'édition de l'étape. */
export function SequenceTab({ data, campaign }: SequenceTabProps) {
  const { steps, stats, updateStep } = data
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = steps.find((s) => s.id === selectedId) || steps[0] || null

  const [form, setForm] = useState({ name: '', wait_days: 0, subject_template: '', body_template: '', ai_brief: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!selected) return
    setForm({
      name: selected.name,
      wait_days: selected.wait_days,
      subject_template: selected.subject_template || '',
      body_template: selected.body_template || '',
      ai_brief: selected.ai_brief || '',
    })
  }, [selected])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      await updateStep(selected.id, {
        name: form.name.trim() || selected.name,
        wait_days: Math.max(0, Number(form.wait_days) || 0),
        subject_template: selected.kind === 'email' ? form.subject_template : null,
        body_template: selected.kind === 'email' ? form.body_template : null,
        ai_brief: form.ai_brief || null,
      })
      toast.success('Étape enregistrée.')
    } catch {
      toast.error("Impossible d'enregistrer l'étape.")
    } finally {
      setSaving(false)
    }
  }

  const statOf = (step: CampaignStep) => stats.perStep.find((p) => p.step.id === step.id)
  const firstCall = steps.findIndex((s) => s.kind === 'call')
  const head = firstCall >= 0 ? steps.slice(0, firstCall + 1) : steps
  const tail = firstCall >= 0 ? steps.slice(firstCall + 1) : []

  const nodes = (list: CampaignStep[], plusFirst: boolean) =>
    list.map((step, i) => (
      <div key={step.id} className="w-full">
        {(i > 0 || plusFirst) && <Connector plus />}
        <StepNode step={step} stat={statOf(step)} selected={selected?.id === step.id} onSelect={() => setSelectedId(step.id)} />
      </div>
    ))

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_480px]">
      {/* ── Canevas ─────────────────────────────────────────────────────────── */}
      <div
        className="overflow-auto px-5 pb-14 pt-8"
        style={{ background: 'var(--bg-secondary) radial-gradient(#D6D8E0 1px, transparent 1px) 0 0/18px 18px' }}
      >
        <div className="mx-auto flex w-full max-w-[470px] flex-col items-center">
          <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[12px] text-[var(--text-muted)]">
            <div className="px-3.5 py-2.5">Expéditeur<b className="mt-0.5 block text-[13px] font-semibold text-[var(--text-primary)]">Emir Boutaleb</b><span className="block break-words text-[12.5px] text-[var(--text-secondary)]">{campaign.sender_email}</span></div>
            <div className="border-l border-[var(--border-color)] px-3.5 py-2.5">Envois<b className="mt-0.5 block text-[13px] font-semibold text-[var(--text-primary)]">Lun. à jeu., 9h à 11h30</b></div>
          </div>

          {steps.length === 0 && <p className="mt-6 text-[13px] text-[var(--text-muted)]">Aucune étape dans cette campagne.</p>}
          {nodes(head, true)}

          {firstCall >= 0 && (
            <>
              <Connector />
              <div className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3.5 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}><GitFork className="h-4 w-4" /></span>
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">A répondu ou refus logué ?</span>
              </div>
              <div className="relative grid w-full grid-cols-[150px_1fr] gap-4 sm:grid-cols-[170px_1fr]">
                <div className="absolute left-[75px] right-[calc((100%-166px)/2)] top-0 h-0.5 bg-[var(--border-color)] sm:left-[85px] sm:right-[calc((100%-186px)/2)]" aria-hidden />
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>Oui</span>
                  <div className="h-3.5 w-0.5 bg-[var(--border-color)]" />
                  <div className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
                    <div className="flex items-center gap-2.5 px-3.5 py-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}><Square className="h-3.5 w-3.5 fill-current" /></span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-[var(--text-primary)]">Séquence arrêtée</span>
                        <span className="block text-[12px] text-[var(--text-muted)]">Le lead remonte dans Leads</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>Non</span>
                  <div className="h-3.5 w-0.5 bg-[var(--border-color)]" />
                  {tail.length === 0 ? (
                    <p className="text-[12px] text-[var(--text-muted)]">Fin de séquence</p>
                  ) : (
                    tail.map((step, i) => (
                      <div key={step.id} className="w-full">
                        {i > 0 && <Connector plus />}
                        <StepNode step={step} stat={statOf(step)} selected={selected?.id === step.id} onSelect={() => setSelectedId(step.id)} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Panneau d'édition ───────────────────────────────────────────────── */}
      <aside className="flex flex-col border-t border-[var(--border-color)] md:border-l md:border-t-0">
        {selected ? (
          <form onSubmit={handleSave} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-3">
              {selected.kind === 'call' ? <Phone className="h-4 w-4 text-[var(--accent-blue)]" /> : <Mail className="h-4 w-4 text-[var(--memovia-violet)]" />}
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">{selected.name}</span>
              <span className="ml-auto text-[12px] text-[var(--text-muted)]">Étape {selected.position}</span>
            </div>
            <div className="grid gap-4 px-4 py-4">
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="step-name">Nom</Label>
                  <Input id="step-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-wait">Attente (jours)</Label>
                  <Input id="step-wait" type="number" min={0} value={form.wait_days} onChange={(e) => setForm({ ...form, wait_days: Number(e.target.value) })} />
                </div>
              </div>

              {selected.kind === 'email' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-subject">Objet</Label>
                    <Input id="step-subject" value={form.subject_template} onChange={(e) => setForm({ ...form, subject_template: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-body">Message</Label>
                    <textarea
                      id="step-body"
                      value={form.body_template}
                      onChange={(e) => setForm({ ...form, body_template: e.target.value })}
                      rows={18}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3.5 font-mono text-[12.5px] font-light leading-[1.6] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-[3px] focus:ring-[var(--memovia-violet-light)]"
                    />
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
                      {VARIABLES.map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt><code className="rounded-md border px-1.5 py-px text-[11px] font-semibold" style={k.startsWith('{{IA') ? { backgroundColor: '#FFF4C2', borderColor: '#E6C34A', color: '#6B5300' } : { backgroundColor: 'var(--memovia-violet-light)', borderColor: 'color-mix(in oklab, var(--memovia-violet) 40%, transparent)', color: 'var(--memovia-violet)' }}>{k}</code></dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="step-brief">{selected.kind === 'call' ? "Script de l'appel" : "Consigne à l'IA"}</Label>
                <textarea
                  id="step-brief"
                  value={form.ai_brief}
                  onChange={(e) => setForm({ ...form, ai_brief: e.target.value })}
                  rows={selected.kind === 'call' ? 8 : 4}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-[13px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-[3px] focus:ring-[var(--memovia-violet-light)]"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-[var(--text-muted)]">Sous 170 mots · une seule question</span>
                <Button type="submit" variant="brand" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </div>

              <div>
                <p className="mb-1.5 text-[12px] font-medium text-[var(--text-secondary)]">Interdits, vérifiés avant chaque envoi</p>
                <ul className="grid gap-1 text-[12.5px] text-[var(--text-secondary)]">
                  {FORBIDDEN.map((f) => (
                    <li key={f}><span className="mr-1 font-bold text-[var(--danger)]" aria-hidden>✕</span>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </form>
        ) : (
          <p className="p-4 text-[13px] text-[var(--text-muted)]">Sélectionne une étape pour la modifier.</p>
        )}
      </aside>
    </div>
  )
}
