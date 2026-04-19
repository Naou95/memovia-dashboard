import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import { sendTelegramMessage } from '../_shared/telegram.ts'

interface QontoBankAccount { balance_cents: number }
interface QontoResponse { bank_accounts: QontoBankAccount[] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  // Only accept calls authenticated with the service role key (cron via pg_net)
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!token || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const chatId = Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL')
  if (!chatId) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_CHAT_ID_NAOUFEL not configured' }), { status: 500 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [stripeResult, qontoResult, tasksResult, leadsResult] = await Promise.allSettled([
      // Stripe MRR
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
        const activeCount = subs.data.filter(
          (s) => (s.items.data[0]?.plan?.amount ?? 0) > 0 && !s.cancel_at_period_end,
        ).length
        return { mrr, activeCount }
      })(),

      // Qonto balance
      (async () => {
        const apiKey = Deno.env.get('QONTO_API_KEY')
        const orgSlug = Deno.env.get('QONTO_ORGANIZATION_SLUG')
        if (!apiKey || !orgSlug) return null
        const res = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
          signal: AbortSignal.timeout(8000),
          headers: { 'Authorization': `${orgSlug}:${apiKey}` },
        })
        if (!res.ok) return null
        const { bank_accounts } = await res.json() as QontoResponse
        const totalCents = bank_accounts.reduce((s, a) => s + (a.balance_cents ?? 0), 0)
        return Math.round(totalCents) / 100
      })(),

      // Today's tasks for naoufel (due today or overdue)
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('assigned_to', 'naoufel')
        .in('status', ['todo', 'en_cours'])
        .lte('due_date', today)
        .order('priority', { ascending: false }),

      // Leads without action for 7+ days
      supabase
        .from('leads')
        .select('id, name, status, updated_at')
        .not('status', 'in', '(gagne,perdu)')
        .lt('updated_at', sevenDaysAgo)
        .order('updated_at', { ascending: true })
        .limit(10),
    ])

    const dayLabel = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const lines: string[] = [`☀️ *Bonjour Naoufel — ${dayLabel}*`, '']

    // Finances
    lines.push('💰 *Finances*')
    if (stripeResult.status === 'fulfilled' && stripeResult.value) {
      const { mrr, activeCount } = stripeResult.value
      lines.push(`• MRR : *${Math.round(mrr).toLocaleString('fr-FR')} €*`)
      lines.push(`• Abonnements actifs : ${activeCount}`)
    } else {
      lines.push('• MRR : données indisponibles')
    }
    if (qontoResult.status === 'fulfilled' && qontoResult.value !== null) {
      const balance = qontoResult.value as number
      lines.push(`• Solde Qonto : *${balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €*`)
    } else {
      lines.push('• Solde Qonto : données indisponibles')
    }
    lines.push('')

    // Tasks
    const tasks = tasksResult.status === 'fulfilled' ? (tasksResult.value.data ?? []) : []
    if (tasks.length > 0) {
      lines.push(`✅ *Tâches du jour (${tasks.length})*`)
      for (const t of tasks) {
        const prio = t.priority === 'haute' ? '🔴' : t.priority === 'normale' ? '🟡' : '🟢'
        const overdue = t.due_date && t.due_date < today ? ' ⚠️' : ''
        lines.push(`• ${prio} ${t.title}${overdue}`)
      }
    } else {
      lines.push('✅ *Tâches du jour* — aucune tâche échue')
    }
    lines.push('')

    // Stale leads
    const staleLeads = leadsResult.status === 'fulfilled' ? (leadsResult.value.data ?? []) : []
    if (staleLeads.length > 0) {
      lines.push(`👥 *Leads sans action +7j (${staleLeads.length})*`)
      for (const l of staleLeads) {
        const days = Math.floor((Date.now() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24))
        lines.push(`• ${l.name} _(${l.status})_ — ${days}j sans suivi`)
      }
    } else {
      lines.push('👥 *Leads* — tous à jour ✓')
    }

    lines.push('')
    lines.push('_Bonne journée 🚀_')

    await sendTelegramMessage(chatId, lines.join('\n'))

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('telegram-daily-briefing error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 502 })
  }
})
