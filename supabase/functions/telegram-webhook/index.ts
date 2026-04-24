import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import nodemailer from 'npm:nodemailer'
import { sendTelegramMessage } from '../_shared/telegram.ts'

// verify_jwt: false — configured in supabase/config.toml
// Security: X-Telegram-Bot-Api-Secret-Token header verification + chat_id allowlist

function verifyTelegramSecret(req: Request): boolean {
  const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!expected) return false
  const provided = req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''
  if (provided.length !== expected.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  }
  return result === 0
}

// ── Telegram types ─────────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string }
    text?: string
    date: number
  }
}

interface AnthropicContent {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

// ── Dashboard data types ───────────────────────────────────────────────────────

interface Task {
  id: string
  title: string
  status: string
  priority: string
  assigned_to: string | null
  due_date: string | null
}

interface Lead {
  id: string
  name: string
  type: string
  status: string
  maturity: string | null
  assigned_to: string | null
  next_action: string | null
  updated_at: string
}

interface Contract {
  id: string
  organization_name: string
  organization_type: string
  status: string
  license_count: number
  mrr_eur: number | null
  contact_name: string | null
}

interface QontoBankAccount { balance_cents: number }

interface DashboardUser {
  email: string
  plan: string | null
  account_type: string | null
  created_at: string
}

interface FeedbackItem {
  id: string
  title: string
  status: string
  category: string
  voteCount: number
}

// ── Context loading ────────────────────────────────────────────────────────────

async function loadContext() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const todayIso = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [tasksRes, leadsRes, contractsRes, stripeRes, qontoRes, usersRes, feedbackRes] = await Promise.allSettled([
    supabase
      .from('tasks')
      .select('id, title, status, priority, assigned_to, due_date')
      .in('status', ['todo', 'en_cours'])
      .order('priority', { ascending: false }),

    supabase
      .from('leads')
      .select('id, name, type, status, maturity, assigned_to, next_action, updated_at')
      .not('status', 'in', '(gagne,perdu)')
      .order('updated_at', { ascending: true }),

    supabase
      .from('contracts')
      .select('id, organization_name, organization_type, status, license_count, mrr_eur, contact_name')
      .not('status', 'eq', 'resilie')
      .order('mrr_eur', { ascending: false, nullsFirst: false }),

    (async () => {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeKey) return null
      const stripe = new Stripe(stripeKey)
      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 }, { timeout: 8000 })
      const mrr = subs.data.reduce((sum, sub) => {
        const plan = sub.items.data[0]?.plan
        if (!plan?.amount) return sum
        return sum + (plan.interval === 'year' ? plan.amount / 12 : plan.amount) / 100
      }, 0)
      const paid = subs.data.filter((s) => (s.items.data[0]?.plan?.amount ?? 0) > 0)
      return {
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        active: paid.filter((s) => !s.cancel_at_period_end).length,
        canceling: paid.filter((s) => s.cancel_at_period_end).length,
      }
    })(),

    (async () => {
      const apiKey = Deno.env.get('QONTO_API_KEY')
      const orgSlug = Deno.env.get('QONTO_ORGANIZATION_SLUG')
      if (!apiKey || !orgSlug) return null
      const res = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
        signal: AbortSignal.timeout(8000),
        headers: { 'Authorization': `${orgSlug}:${apiKey}` },
      })
      if (!res.ok) return null
      const { bank_accounts } = await res.json() as { bank_accounts: QontoBankAccount[] }
      return Math.round(bank_accounts.reduce((s, a) => s + (a.balance_cents ?? 0), 0)) / 100
    })(),

    supabase
      .from('v_dashboard_users')
      .select('email, plan, account_type, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('feedback_items')
      .select('id, title, status, category, feedback_votes(count)')
      .in('status', ['en_dev', 'backlog'])
      .order('created_at', { ascending: false }),
  ])

  const tasks: Task[] = tasksRes.status === 'fulfilled' ? (tasksRes.value.data ?? []) : []
  const leads: Lead[] = leadsRes.status === 'fulfilled' ? (leadsRes.value.data ?? []) : []
  const contracts: Contract[] = contractsRes.status === 'fulfilled' ? (contractsRes.value.data ?? []) : []
  const stripe = stripeRes.status === 'fulfilled' ? stripeRes.value : null
  const qontoBalance = qontoRes.status === 'fulfilled' ? qontoRes.value : null
  const allUsers: DashboardUser[] = usersRes.status === 'fulfilled' ? (usersRes.value.data ?? []) : []

  const newLast24h = allUsers.filter((u) => u.created_at >= oneDayAgo)
  const newThisWeek = allUsers.filter((u) => u.created_at >= sevenDaysAgo)
  const byPlan = allUsers.reduce<Record<string, number>>((acc, u) => {
    const key = u.plan ?? u.account_type ?? 'inconnu'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const feedbackRaw: Array<Record<string, unknown>> = feedbackRes.status === 'fulfilled' ? (feedbackRes.value.data ?? []) : []

  const feedbackItems: FeedbackItem[] = feedbackRaw.map((item) => ({
    id: String(item.id),
    title: String(item.title),
    status: String(item.status),
    category: String(item.category),
    voteCount: Array.isArray(item.feedback_votes)
      ? (item.feedback_votes[0] as { count: number } | undefined)?.count ?? 0
      : 0,
  }))

  return {
    tasks,
    leads,
    contracts,
    stripe,
    qontoBalance,
    overdueTasks: tasks.filter((t) => t.due_date && t.due_date < todayIso),
    staleLeads: leads.filter((l) => new Date(l.updated_at) < new Date(sevenDaysAgo)),
    todayIso,
    users: { total: allUsers.length, newLast24h, newThisWeek, byPlan },
    feedbackItems,
  }
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(
  ctx: Awaited<ReturnType<typeof loadContext>>,
  callerName: string,
): string {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const lines: string[] = [
    `Tu es le Copilote IA interne de MEMOVIA, une EdTech SaaS française (outils pédagogiques IA pour établissements scolaires).`,
    `Tu réponds à *${callerName}* via Telegram. Date du jour : ${today}.`,
    `Réponds en français, de façon concise et directe (max 3-4 paragraphes pour Telegram).`,
    `Tu peux exécuter des actions : créer/modifier des tâches, leads, contrats, gérer la roadmap/feedback et envoyer des emails.`,
    `Utilise les outils dès qu'une action est clairement demandée. Ne demande pas de confirmation sauf si les paramètres sont ambigus.`,
    `Formate tes réponses en Markdown Telegram (*gras*, _italique_, \`code\`, tirets pour listes).`,
    ``,
  ]

  // ## FINANCES
  lines.push('## FINANCES')
  if (ctx.stripe) {
    lines.push(`- MRR : ${ctx.stripe.mrr.toLocaleString('fr-FR')} €`)
    lines.push(`- ARR : ${ctx.stripe.arr.toLocaleString('fr-FR')} €`)
    lines.push(`- Abonnements actifs : ${ctx.stripe.active}`)
    if (ctx.stripe.canceling > 0) lines.push(`- Annulations en cours : ${ctx.stripe.canceling} ⚠️`)
  } else {
    lines.push('- Données Stripe indisponibles')
  }
  if (ctx.qontoBalance !== null) {
    lines.push(`- Solde Qonto : ${ctx.qontoBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`)
  } else {
    lines.push('- Solde Qonto indisponible')
  }
  lines.push('')

  // ## TÂCHES
  lines.push('## TÂCHES EN COURS')
  if (ctx.tasks.length > 0) {
    for (const t of ctx.tasks) {
      const retard = t.due_date && t.due_date < ctx.todayIso ? ' [EN RETARD]' : ''
      const due = t.due_date ? ` — échéance ${t.due_date}` : ''
      lines.push(`- [${t.status}] ${t.title} — ${t.priority} — ${t.assigned_to ?? 'non assigné'}${due}${retard} (id:${t.id})`)
    }
  } else {
    lines.push('- Aucune tâche active.')
  }
  lines.push('')

  // ## LEADS
  lines.push('## LEADS ACTIFS (CRM)')
  if (ctx.leads.length > 0) {
    for (const l of ctx.leads) {
      const mat = l.maturity ? ` (${l.maturity})` : ''
      const action = l.next_action ? ` — next: ${l.next_action}` : ''
      lines.push(`- ${l.name} (${l.type})${mat} — ${l.status} — ${l.assigned_to ?? 'non assigné'}${action} (id:${l.id})`)
    }
  } else {
    lines.push('- Aucun lead actif.')
  }
  lines.push('')

  // ## CONTRATS
  lines.push('## CONTRATS')
  if (ctx.contracts.length > 0) {
    for (const c of ctx.contracts) {
      const mrr = c.mrr_eur !== null ? `${Number(c.mrr_eur).toLocaleString('fr-FR')} €/mois` : 'MRR inconnu'
      const contact = c.contact_name ? ` — contact: ${c.contact_name}` : ''
      lines.push(`- ${c.organization_name} (${c.organization_type}) — ${c.status} — ${mrr} — ${c.license_count} licences${contact} (id:${c.id})`)
    }
  } else {
    lines.push('- Aucun contrat actif.')
  }
  lines.push('')

  // ## UTILISATEURS
  lines.push('## UTILISATEURS')
  if (ctx.users.total > 0) {
    lines.push(`- Total inscrits : ${ctx.users.total}`)
    const planLines = Object.entries(ctx.users.byPlan)
      .sort((a, b) => b[1] - a[1])
      .map(([plan, count]) => `${plan}: ${count}`)
    if (planLines.length > 0) lines.push(`- Répartition : ${planLines.join(' | ')}`)
    lines.push(`- Nouvelles inscriptions 24h : ${ctx.users.newLast24h.length}`)
    if (ctx.users.newLast24h.length > 0) {
      for (const u of ctx.users.newLast24h.slice(0, 5)) {
        lines.push(`  · ${u.email} (${u.plan ?? u.account_type ?? 'inconnu'})`)
      }
      if (ctx.users.newLast24h.length > 5) lines.push(`  · … et ${ctx.users.newLast24h.length - 5} autres`)
    }
    lines.push(`- Nouvelles inscriptions 7j : ${ctx.users.newThisWeek.length}`)
  } else {
    lines.push('- Données utilisateurs indisponibles')
  }
  lines.push('')

  // ## ROADMAP (items en cours + backlog populaires)
  const inDev = ctx.feedbackItems.filter((f) => f.status === 'en_dev')
  const topBacklog = ctx.feedbackItems
    .filter((f) => f.status === 'backlog')
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 5)

  if (inDev.length > 0 || topBacklog.length > 0) {
    lines.push('## ROADMAP / FEEDBACK')
    if (inDev.length > 0) {
      lines.push('En développement :')
      for (const f of inDev) {
        lines.push(`- ${f.title} (${f.category}) — ${f.voteCount} vote(s)`)
      }
    }
    if (topBacklog.length > 0) {
      lines.push('Backlog populaire :')
      for (const f of topBacklog) {
        lines.push(`- ${f.title} (${f.category}) — ${f.voteCount} vote(s)`)
      }
    }
    lines.push('')
  }

  // ## ALERTES
  if (ctx.overdueTasks.length > 0 || ctx.staleLeads.length > 0) {
    lines.push('## ALERTES')
    if (ctx.overdueTasks.length > 0) {
      lines.push(`- ⚠️ ${ctx.overdueTasks.length} tâche(s) en retard : ${ctx.overdueTasks.map((t) => t.title).join(', ')}`)
    }
    if (ctx.staleLeads.length > 0) {
      lines.push(`- 👥 ${ctx.staleLeads.length} lead(s) sans action +7j : ${ctx.staleLeads.map((l) => l.name).join(', ')}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Tool definitions ───────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_task',
    description: 'Crée une tâche dans le système de gestion des tâches MEMOVIA.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de la tâche' },
        description: { type: 'string', description: 'Description optionnelle' },
        priority: { type: 'string', enum: ['haute', 'normale', 'basse'], description: 'Priorité. Défaut: normale' },
        assigned_to: {
          oneOf: [
            { type: 'string', enum: ['naoufel', 'emir'] },
            { type: 'array', items: { type: 'string', enum: ['naoufel', 'emir'] } }
          ],
          description: 'Personne(s) assignée(s) — string ou array de naoufel/emir'
        },
        due_date: { type: 'string', description: 'Date d\'échéance YYYY-MM-DD (optionnel)' },
        status: { type: 'string', enum: ['todo', 'en_cours'], description: 'Statut initial. Défaut: todo' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Change le statut d\'une tâche existante (todo, en_cours, done).',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID exact de la tâche (prioritaire sur task_title)' },
        task_title: { type: 'string', description: 'Titre ou partie du titre de la tâche' },
        new_status: { type: 'string', enum: ['todo', 'en_cours', 'done'], description: 'Nouveau statut' },
      },
      required: ['new_status'],
    },
  },
  {
    name: 'create_lead',
    description: 'Crée un nouveau lead dans le CRM MEMOVIA.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nom de l\'organisation ou du contact' },
        type: { type: 'string', enum: ['ecole', 'cfa', 'entreprise', 'autre'], description: 'Type. Défaut: autre' },
        canal: { type: 'string', enum: ['linkedin', 'email', 'referral', 'appel', 'autre'], description: 'Canal d\'acquisition. Défaut: autre' },
        status: { type: 'string', enum: ['nouveau', 'contacte', 'en_discussion', 'proposition'], description: 'Statut. Défaut: nouveau' },
        maturity: { type: 'string', enum: ['froid', 'tiede', 'chaud'], description: 'Maturité. Défaut: froid' },
        assigned_to: { type: 'string', enum: ['naoufel', 'emir'], description: 'Personne assignée (optionnel)' },
        next_action: { type: 'string', description: 'Prochaine action à effectuer (optionnel)' },
        notes: { type: 'string', description: 'Notes libres (optionnel)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Met à jour le statut, la maturité ou la prochaine action d\'un lead.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'ID exact du lead (prioritaire sur lead_name)' },
        lead_name: { type: 'string', description: 'Nom de l\'organisation ou du lead (recherche partielle)' },
        new_status: {
          type: 'string',
          enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
          description: 'Nouveau statut (optionnel)',
        },
        new_maturity: {
          type: 'string',
          enum: ['froid', 'tiede', 'chaud'],
          description: 'Nouvelle maturité (optionnel)',
        },
        next_action: { type: 'string', description: 'Prochaine action à effectuer (optionnel)' },
      },
      required: ['lead_name'],
    },
  },
  {
    name: 'create_contract',
    description: 'Crée un nouveau contrat B2B dans le système MEMOVIA.',
    input_schema: {
      type: 'object',
      properties: {
        organization_name: { type: 'string', description: 'Nom de l\'organisation cliente' },
        contact_name: { type: 'string', description: 'Nom du contact principal (optionnel)' },
        mrr_eur: { type: 'number', description: 'Revenu mensuel récurrent en euros' },
        license_count: { type: 'number', description: 'Nombre de licences' },
        organization_type: { type: 'string', enum: ['ecole', 'cfa', 'entreprise', 'autre'], description: 'Type. Défaut: ecole' },
        status: { type: 'string', enum: ['prospect', 'negotiation', 'signe', 'actif'], description: 'Statut. Défaut: prospect' },
      },
      required: ['organization_name', 'mrr_eur', 'license_count'],
    },
  },
  {
    name: 'send_email',
    description: 'Envoie un email professionnel depuis une adresse MEMOVIA via Hostinger SMTP.',
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          enum: ['naoufel@memovia.io', 'emir@memovia.io', 'contact@memovia.io', 'support@memovia.io'],
          description: 'Adresse expéditeur MEMOVIA',
        },
        to: { type: 'string', description: 'Adresse destinataire' },
        subject: { type: 'string', description: 'Objet de l\'email' },
        body: { type: 'string', description: 'Corps de l\'email (texte brut)' },
        cc: { type: 'string', description: 'Adresse en copie (optionnel)' },
      },
      required: ['from', 'to', 'subject', 'body'],
    },
  },
  {
    name: 'create_feedback_item',
    description: 'Crée un item dans la roadmap/feedback MEMOVIA.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de l\'item' },
        description: { type: 'string', description: 'Description optionnelle' },
        category: {
          type: 'string',
          enum: ['fonctionnalite', 'bug', 'amelioration'],
          description: 'Catégorie. Défaut: fonctionnalite',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_feedback_status',
    description: 'Met à jour le statut d\'un item de roadmap/feedback.',
    input_schema: {
      type: 'object',
      properties: {
        item_title: { type: 'string', description: 'Titre ou partie du titre (recherche partielle)' },
        new_status: {
          type: 'string',
          enum: ['backlog', 'planifie', 'en_dev', 'livre'],
          description: 'Nouveau statut',
        },
      },
      required: ['item_title', 'new_status'],
    },
  },
  {
    name: 'list_feedback_items',
    description: 'Liste les items de roadmap/feedback avec leur nombre de votes.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['backlog', 'planifie', 'en_dev', 'livre'],
          description: 'Filtre par statut (optionnel)',
        },
      },
      required: [],
    },
  },
]

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (name === 'create_task') {
    // Normalize assigned_to: accept string or array
    const assigneesRaw = Array.isArray(input.assigned_to) ? input.assigned_to as string[] : (input.assigned_to ? [String(input.assigned_to)] : [])
    const assignedTo = assigneesRaw[0] ?? null

    const { data, error } = await supabase.from('tasks').insert({
      title: String(input.title),
      description: input.description ? String(input.description) : null,
      priority: (input.priority as string) ?? 'normale',
      assigned_to: assignedTo,
      assignees: assigneesRaw,
      due_date: input.due_date ? String(input.due_date) : null,
      status: (input.status as string) ?? 'todo',
    }).select('id').single()
    if (error) throw new Error('Impossible de créer la tâche.')
    return `Tâche créée : "${input.title}" (id: ${data.id})`
  }

  if (name === 'update_task_status') {
    const query = supabase.from('tasks').select('id, title, status')
    const { data: tasks, error: findError } = input.task_id
      ? await query.eq('id', String(input.task_id)).limit(1)
      : await query.ilike('title', `%${String(input.task_title ?? '')}%`).limit(1)
    if (findError || !tasks?.[0]) throw new Error(`Tâche "${String(input.task_title ?? input.task_id)}" introuvable.`)
    const task = tasks[0] as { id: string; title: string; status: string }
    await supabase.from('tasks').update({ status: String(input.new_status) }).eq('id', task.id)
    return `Tâche "${task.title}" : ${task.status} → ${input.new_status}`
  }

  if (name === 'create_lead') {
    const { data, error } = await supabase.from('leads').insert({
      name: String(input.name),
      type: (input.type as string) ?? 'autre',
      canal: (input.canal as string) ?? 'autre',
      status: (input.status as string) ?? 'nouveau',
      maturity: (input.maturity as string) ?? 'froid',
      assigned_to: input.assigned_to ? String(input.assigned_to) : null,
      next_action: input.next_action ? String(input.next_action) : null,
      notes: input.notes ? String(input.notes) : null,
    }).select('id').single()
    if (error) throw new Error('Impossible de créer le lead.')
    return `Lead créé : "${input.name}" (id: ${data.id})`
  }

  if (name === 'update_lead_status') {
    const query = supabase.from('leads').select('id, name, status, maturity')
    const { data: leads, error: findError } = input.lead_id
      ? await query.eq('id', String(input.lead_id)).limit(1)
      : await query.ilike('name', `%${String(input.lead_name ?? '')}%`).limit(1)
    if (findError || !leads?.[0]) throw new Error(`Lead "${String(input.lead_name ?? input.lead_id)}" introuvable.`)
    const lead = leads[0] as { id: string; name: string; status: string; maturity: string }
    const updates: Record<string, string> = {}
    if (input.new_status) updates.status = String(input.new_status)
    if (input.new_maturity) updates.maturity = String(input.new_maturity)
    if (input.next_action) updates.next_action = String(input.next_action)
    await supabase.from('leads').update(updates).eq('id', lead.id)
    const changes: string[] = []
    if (input.new_status) changes.push(`statut: ${lead.status} → ${input.new_status}`)
    if (input.new_maturity) changes.push(`maturité: ${lead.maturity} → ${input.new_maturity}`)
    if (input.next_action) changes.push(`next: ${input.next_action}`)
    return `Lead "${lead.name}" mis à jour — ${changes.join(', ')}`
  }

  if (name === 'create_contract') {
    const { data, error } = await supabase.from('contracts').insert({
      organization_name: String(input.organization_name),
      contact_name: input.contact_name ? String(input.contact_name) : null,
      mrr_eur: Number(input.mrr_eur),
      license_count: Number(input.license_count),
      organization_type: (input.organization_type as string) ?? 'ecole',
      status: (input.status as string) ?? 'prospect',
    }).select('id').single()
    if (error) throw new Error('Impossible de créer le contrat.')
    return `Contrat créé pour "${input.organization_name}" — ${input.mrr_eur} €/mois, ${input.license_count} licences (id: ${data.id})`
  }

  if (name === 'send_email') {
    const smtpUser = Deno.env.get('HOSTINGER_EMAIL')
    const smtpPass = Deno.env.get('HOSTINGER_SMTP_PASSWORD')
    if (!smtpUser || !smtpPass) throw new Error('SMTP Hostinger non configuré.')
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    })
    const info = await transporter.sendMail({
      from: String(input.from),
      to: String(input.to),
      cc: input.cc ? String(input.cc) : undefined,
      subject: String(input.subject),
      text: String(input.body),
    })
    return `Email envoyé à ${input.to} — objet : "${input.subject}" (id: ${info.messageId})`
  }

  if (name === 'create_feedback_item') {
    const { data, error } = await supabase.from('feedback_items').insert({
      title: String(input.title),
      description: input.description ? String(input.description) : null,
      category: (input.category as string) ?? 'fonctionnalite',
      status: 'backlog',
    }).select('id').single()
    if (error) throw new Error('Impossible de créer l\'item de feedback.')
    return `Item de feedback créé : "${input.title}" — statut: backlog (id: ${data.id})`
  }

  if (name === 'update_feedback_status') {
    const { data: items, error: findError } = await supabase
      .from('feedback_items')
      .select('id, title, status')
      .ilike('title', `%${String(input.item_title)}%`)
      .limit(1)
    if (findError || !items?.[0]) throw new Error(`Item "${String(input.item_title)}" introuvable dans la roadmap.`)
    const item = items[0] as { id: string; title: string; status: string }
    await supabase.from('feedback_items').update({ status: String(input.new_status) }).eq('id', item.id)
    return `Item "${item.title}" : ${item.status} → ${input.new_status}`
  }

  if (name === 'list_feedback_items') {
    let query = supabase
      .from('feedback_items')
      .select('id, title, status, category, feedback_votes(count)')
      .order('created_at', { ascending: false })
    if (input.status) query = query.eq('status', String(input.status))
    const { data: items, error } = await query
    if (error) throw new Error('Impossible de récupérer les items de feedback.')
    const list = (items ?? []).map((item: Record<string, unknown>) => {
      const voteCount = Array.isArray(item.feedback_votes)
        ? (item.feedback_votes[0] as { count: number } | undefined)?.count ?? 0
        : 0
      return `[${item.status}] ${item.title} (${item.category}) — ${voteCount} vote(s)`
    })
    return list.length > 0 ? `Roadmap (${list.length} items) :\n${list.join('\n')}` : 'Aucun item trouvé.'
  }

  throw new Error('Action inconnue.')
}

// ── User identification ────────────────────────────────────────────────────────

function identifyUser(chatId: string): string {
  if (chatId === Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL')) return 'Naoufel'
  if (chatId === Deno.env.get('TELEGRAM_CHAT_ID_EMIR')) return 'Emir'
  return 'l\'équipe'
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  if (!verifyTelegramSecret(req)) {
    return new Response('ok', { status: 200 })
  }

  const allowedChatIds = new Set(
    [Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL'), Deno.env.get('TELEGRAM_CHAT_ID_EMIR')].filter(Boolean),
  )
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (allowedChatIds.size === 0 || !apiKey) {
    console.error('telegram-webhook: missing chat IDs or ANTHROPIC_API_KEY')
    return new Response('ok', { status: 200 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return new Response('ok', { status: 200 })
  }

  const msg = update.message
  if (!msg?.text || !allowedChatIds.has(String(msg.chat.id))) {
    return new Response('ok', { status: 200 })
  }

  const chatId = String(msg.chat.id)
  const callerName = identifyUser(chatId)
  const userText = msg.text.trim()

  if (userText === '/start') {
    await sendTelegramMessage(
      chatId,
      `👋 *Copilote MEMOVIA — Bonjour ${callerName} !*\n\n` +
        `Je charge toutes les données du dashboard en temps réel.\n\n` +
        `*Actions disponibles :*\n` +
        `• Créer / terminer des tâches\n` +
        `• Créer / mettre à jour des leads CRM\n` +
        `• Créer des contrats B2B\n` +
        `• Envoyer des emails depuis MEMOVIA\n` +
        `• Répondre à tes questions sur le business\n\n` +
        `_Essaie : "Quelles sont mes tâches en retard ?" ou "Crée un lead pour CFA Bordeaux"_`,
    )
    return new Response('ok', { status: 200 })
  }

  try {
    // Charge le contexte complet du dashboard
    const ctx = await loadContext()
    const systemPrompt = buildSystemPrompt(ctx, callerName)

    // Phase 1 : appel Anthropic avec tous les tools
    const phase1Resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }],
        tools: TOOLS,
      }),
    })

    if (!phase1Resp.ok) {
      await sendTelegramMessage(chatId, '❌ Erreur lors du traitement. Réessaie dans un instant.')
      return new Response('ok', { status: 200 })
    }

    const phase1 = await phase1Resp.json() as { stop_reason: string; content: AnthropicContent[] }
    const toolUseBlock = phase1.content.find((b) => b.type === 'tool_use')

    // Pas de tool use → réponse texte
    if (phase1.stop_reason !== 'tool_use' || !toolUseBlock) {
      const text = phase1.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
      await sendTelegramMessage(chatId, text || 'Je n\'ai pas pu générer une réponse.')
      return new Response('ok', { status: 200 })
    }

    // Tool use → exécution
    const { name: toolName, id: toolId, input: toolInput } = toolUseBlock as {
      name: string; id: string; input: Record<string, unknown>
    }

    let toolResult: string
    try {
      toolResult = await executeTool(toolName, toolInput)
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ ${err instanceof Error ? err.message : 'Erreur lors de l\'exécution.'}`)
      return new Response('ok', { status: 200 })
    }

    // Phase 2 : confirmation
    const phase2Resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userText },
          { role: 'assistant', content: phase1.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId, content: toolResult }] },
        ],
      }),
    })

    let responseText = `✅ ${toolResult}`
    if (phase2Resp.ok) {
      const phase2 = await phase2Resp.json() as { content: AnthropicContent[] }
      const text = phase2.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
      if (text) responseText = text
    }

    await sendTelegramMessage(chatId, responseText)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('telegram-webhook error:', err instanceof Error ? err.message : err)
    try { await sendTelegramMessage(chatId, '❌ Erreur interne. Réessaie dans un instant.') } catch { /* ignore */ }
    return new Response('ok', { status: 200 })
  }
})
