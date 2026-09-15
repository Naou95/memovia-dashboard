import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, GitBranch, Users2, CheckCircle2, BarChart3, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useCampaign } from '@/hooks/useCampaigns'
import { CAMPAIGN_STATUS_LABELS } from '@/types/campagnes'
import type { CampaignStatus } from '@/types/campagnes'
import { LEAD_ASSIGNEE_LABELS } from '@/types/leads'
import { SequenceTab } from './components/SequenceTab'
import { ContactsTab } from './components/ContactsTab'
import { ReviewTab } from './components/ReviewTab'
import { RapportsTab } from './components/RapportsTab'

export type CampaignTab = 'sequence' | 'contacts' | 'revue' | 'rapports'

const STATUS_STYLE: Record<CampaignStatus, React.CSSProperties> = {
  draft: { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' },
  live: { backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid color-mix(in oklab, var(--success) 25%, transparent)' },
  paused: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid color-mix(in oklab, var(--warning) 25%, transparent)' },
  archived: { backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' },
}

export function CampaignStatusChip({ status, className }: { status: CampaignStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium', className)} style={STATUS_STYLE[status]}>
      {status === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  )
}

/** Page d'une campagne : Séquence › Contacts › Revue › Rapports (maquette du 15/09). */
export default function CampagnePage() {
  const { id } = useParams<{ id: string }>()
  const data = useCampaign(id)
  const { campaign, enrollments, items, isLoading, error, updateCampaign, runTick } = data
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as CampaignTab | null) || 'sequence'
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [ticking, setTicking] = useState(false)

  const now = Date.now()
  const draftsDue = items.filter((m) => m.status === 'draft' && new Date(m.due_at).getTime() <= now && m.enrollment.status === 'active').length

  function setTab(next: CampaignTab) {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    p.delete('message')
    setParams(p, { replace: true })
  }

  async function saveName() {
    setEditingName(false)
    const name = nameDraft.trim()
    if (!campaign || !name || name === campaign.name) return
    try {
      await updateCampaign({ name })
      toast.success('Nom mis à jour.')
    } catch {
      toast.error('Impossible de renommer la campagne.')
    }
  }

  async function changeStatus(status: CampaignStatus) {
    try {
      await updateCampaign({ status })
      toast.success(`Campagne « ${CAMPAIGN_STATUS_LABELS[status]} ».`)
    } catch {
      toast.error('Impossible de changer le statut.')
    }
  }

  async function handleTick() {
    setTicking(true)
    try {
      const r = await runTick()
      toast.success(`${r.processed} inscription${r.processed > 1 ? 's' : ''} traitée${r.processed > 1 ? 's' : ''} · ${r.drafts_created} brouillon${r.drafts_created > 1 ? 's' : ''} · ${r.replies_detected} réponse${r.replies_detected > 1 ? 's' : ''} · ${r.stopped} arrêt${r.stopped > 1 ? 's' : ''}${r.errors.length ? ` · ${r.errors.length} erreur${r.errors.length > 1 ? 's' : ''}` : ''}`)
      if (r.errors.length) console.error('[campaign-tick]', r.errors)
    } catch {
      toast.error("L'actualisation a échoué.")
    } finally {
      setTicking(false)
    }
  }

  if (!isLoading && (error || !campaign)) {
    return (
      <div className="space-y-4">
        <Link to="/campagnes" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:underline"><ArrowLeft className="h-4 w-4" /> Campagnes</Link>
        <div className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">{error || 'Campagne introuvable.'}</div>
      </div>
    )
  }

  const TABS: { id: CampaignTab; label: string; icon: typeof GitBranch; count?: number; warn?: boolean }[] = [
    { id: 'sequence', label: 'Séquence', icon: GitBranch },
    { id: 'contacts', label: 'Contacts', icon: Users2, count: enrollments.length },
    { id: 'revue', label: 'Revue', icon: CheckCircle2, count: draftsDue, warn: true },
    { id: 'rapports', label: 'Rapports', icon: BarChart3 },
  ]

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}>
        <Link to="/campagnes" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Campagnes
        </Link>
      </motion.div>

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <motion.header variants={staggerItem} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 shadow-[var(--shadow-xs)]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl" aria-hidden>{campaign?.emoji || '🎓'}</span>
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              className="h-8 min-w-[220px] rounded-md border border-[var(--memovia-violet)] bg-[var(--bg-primary)] px-2 text-[15px] font-semibold text-[var(--text-primary)] outline-none"
              aria-label="Nom de la campagne"
            />
          ) : (
            <h1 className="min-w-0 text-[15px] font-semibold text-[var(--text-primary)]">
              <button
                type="button"
                onClick={() => { setNameDraft(campaign?.name || ''); setEditingName(true) }}
                className="max-w-full truncate rounded-md px-1 hover:bg-[var(--bg-primary)]"
                title="Renommer"
              >
                {isLoading && !campaign ? 'Chargement…' : campaign?.name}
              </button>
            </h1>
          )}
        </div>

        {campaign && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)]" aria-label="Changer le statut">
                <CampaignStatusChip status={campaign.status} className="cursor-pointer" />
                <ChevronDown className="ml-1 inline h-3 w-3 text-[var(--text-muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(['draft', 'live', 'paused'] as CampaignStatus[]).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => changeStatus(s)}>{CAMPAIGN_STATUS_LABELS[s]}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {campaign?.owner && (
          <span className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--text-secondary)]">
            {LEAD_ASSIGNEE_LABELS[campaign.owner]}
          </span>
        )}

        {/* Fil d'ariane : Séquence › Contacts › Revue › Rapports */}
        <nav className="-mx-1 flex w-full items-center gap-0.5 overflow-x-auto md:ml-auto md:w-auto" aria-label="Onglets de la campagne">
          {TABS.map((t, i) => (
            <span key={t.id} className="flex items-center">
              {i > 0 && <span className="px-0.5 text-[var(--border-color)]" aria-hidden>›</span>}
              <button
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)]"
                style={tab === t.id ? { backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' } : { color: 'var(--text-secondary)' }}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count != null && (t.count > 0 || !t.warn) && (
                  <span
                    className="rounded-md border px-1.5 text-[11.5px] font-semibold tabular-nums"
                    style={t.warn ? { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'color-mix(in oklab, var(--warning) 30%, transparent)' } : { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTick} disabled={ticking || !campaign} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', ticking && 'animate-spin')} />
            Actualiser
          </Button>
          {draftsDue > 0 && tab !== 'revue' && (
            <Button variant="brand" size="sm" className="hidden md:inline-flex" onClick={() => setTab('revue')}>
              Revoir les {draftsDue} mail{draftsDue > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </motion.header>

      {/* ── Onglet ──────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
        {isLoading && !campaign ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-[var(--border-color)]" />)}
          </div>
        ) : campaign && (
          <>
            {tab === 'sequence' && <SequenceTab data={data} campaign={campaign} />}
            {tab === 'contacts' && <ContactsTab data={data} onOpenReview={(messageId) => { const p = new URLSearchParams(params); p.set('tab', 'revue'); if (messageId) p.set('message', messageId); setParams(p) }} />}
            {tab === 'revue' && <ReviewTab data={data} campaign={campaign} initialMessageId={params.get('message')} />}
            {tab === 'rapports' && <RapportsTab stats={data.stats} />}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
