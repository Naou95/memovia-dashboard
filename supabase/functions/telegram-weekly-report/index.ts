import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import { sendTelegramMessage } from '../_shared/telegram.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const chatId = Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL')
  if (!chatId) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_CHAT_ID_NAOUFEL not configured' }), { status: 500 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Semaine = lundi 00:00 → dimanche 23:59 (en local UTC, l'écart de 2h est négligeable pour un bornage hebdo)
    const dayOfWeek = now.getUTCDay() // 0 = dim, 1 = lun
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday))
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
    const mondayISO = monday.toISOString()
    const mondayDate = monday.toISOString().split('T')[0]
    const sundayDate = sunday.toISOString().split('T')[0]
    const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgoDate = sevenDaysAgoISO.split('T')[0]

    const [mrrResult, followUpResult, staleLeadsResult, overdueTasksResult, newUsersResult] = await Promise.allSettled([
      // MRR total (Stripe actifs non-annulés + contrats B2B actifs) — mêmes règles que get-stripe-metrics
      (async () => {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        let mrrStripe = 0
        if (stripeKey) {
          const stripe = new Stripe(stripeKey)
          const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 }, { timeout: 8000 })
          mrrStripe = subs.data.reduce((sum, sub) => {
            if (sub.cancel_at_period_end) return sum
            const plan = sub.items.data[0]?.plan
            if (!plan?.amount) return sum
            return sum + (plan.interval === 'year' ? plan.amount / 12 : plan.amount) / 100
          }, 0)
        }

        const { data: contractRows } = await supabase
          .from('contracts')
          .select('mrr_eur')
          .eq('status', 'actif')
        const mrrContracts = (contractRows ?? []).reduce(
          (sum: number, row: { mrr_eur: number | null }) => sum + (row.mrr_eur ?? 0),
          0,
        )

        return {
          mrrStripe: Math.round(mrrStripe * 100) / 100,
          mrrContracts: Math.round(mrrContracts * 100) / 100,
          mrrTotal: Math.round((mrrStripe + mrrContracts) * 100) / 100,
        }
      })(),

      // Leads à relancer cette semaine
      supabase
        .from('leads')
        .select('id, name, status, follow_up_date, assigned_to')
        .not('status', 'in', '(gagne,perdu)')
        .gte('follow_up_date', mondayDate)
        .lte('follow_up_date', sundayDate)
        .order('follow_up_date', { ascending: true }),

      // Leads sans contact depuis +7j (last_contact_date null ou < 7j, hors gagne/perdu)
      supabase
        .from('leads')
        .select('id, name, status, last_contact_date, updated_at')
        .not('status', 'in', '(gagne,perdu)')
        .or(`last_contact_date.lt.${sevenDaysAgoDate},last_contact_date.is.null`)
        .order('last_contact_date', { ascending: true, nullsFirst: true })
        .limit(15),

      // Tâches en retard
      supabase
        .from('tasks')
        .select('id, title, priority, due_date, assigned_to')
        .in('status', ['todo', 'en_cours'])
        .lt('due_date', today)
        .order('due_date', { ascending: true }),

      // Nouveaux inscrits cette semaine
      supabase
        .from('v_dashboard_users')
        .select('id, email, first_name, last_name, account_type, plan, created_at')
        .gte('created_at', mondayISO)
        .order('created_at', { ascending: false }),
    ])

    const fmtDate = (iso: string) => {
      const d = new Date(iso)
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    }
    const accountTypeLabel = (type: string | null | undefined) => {
      switch (type) {
        case 'student': return '🎓 Étudiant'
        case 'teacher':
        case 'teacher_b2c': return '👨‍🏫 Formateur'
        case 'school_admin': return '🏫 Admin B2B'
        default: return '👤 Inconnu'
      }
    }
    const weekLabel = `${monday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} → ${sunday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`

    const lines: string[] = [`📊 *Rapport hebdomadaire MEMOVIA*`, `_Semaine du ${weekLabel}_`, '']

    // MRR
    lines.push('💰 *MRR actuel*')
    if (mrrResult.status === 'fulfilled' && mrrResult.value) {
      const { mrrTotal, mrrStripe, mrrContracts } = mrrResult.value
      lines.push(`• *${Math.round(mrrTotal).toLocaleString('fr-FR')} €* / mois`)
      lines.push(`  _Stripe : ${Math.round(mrrStripe).toLocaleString('fr-FR')} € · Contrats B2B : ${Math.round(mrrContracts).toLocaleString('fr-FR')} €_`)
    } else {
      lines.push('• Données MRR indisponibles')
    }
    lines.push('')

    // Leads à relancer cette semaine
    const followUps = followUpResult.status === 'fulfilled' ? (followUpResult.value.data ?? []) : []
    if (followUps.length > 0) {
      lines.push(`🔁 *Leads à relancer cette semaine (${followUps.length})*`)
      for (const l of followUps.slice(0, 12)) {
        const who = l.assigned_to ? ` — _${l.assigned_to}_` : ''
        const day = l.follow_up_date ? ` (${fmtDate(l.follow_up_date)})` : ''
        lines.push(`• ${l.name}${day}${who}`)
      }
      if (followUps.length > 12) lines.push(`_…et ${followUps.length - 12} autres_`)
    } else {
      lines.push('🔁 *Leads à relancer* — aucun cette semaine')
    }
    lines.push('')

    // Leads sans contact +7j
    const staleLeads = staleLeadsResult.status === 'fulfilled' ? (staleLeadsResult.value.data ?? []) : []
    if (staleLeads.length > 0) {
      lines.push(`👥 *Leads sans contact +7j (${staleLeads.length})*`)
      for (const l of staleLeads.slice(0, 10)) {
        const ref = l.last_contact_date ?? l.updated_at
        const days = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24)) : null
        const ageLabel = days !== null ? ` — ${days}j` : ' — jamais contacté'
        lines.push(`• ${l.name} _(${l.status})_${ageLabel}`)
      }
      if (staleLeads.length > 10) lines.push(`_…et ${staleLeads.length - 10} autres_`)
    } else {
      lines.push('👥 *Leads* — tout le monde est suivi ✓')
    }
    lines.push('')

    // Tâches en retard
    const overdue = overdueTasksResult.status === 'fulfilled' ? (overdueTasksResult.value.data ?? []) : []
    if (overdue.length > 0) {
      lines.push(`⚠️ *Tâches en retard (${overdue.length})*`)
      for (const t of overdue.slice(0, 10)) {
        const prio = t.priority === 'haute' ? '🔴' : t.priority === 'normale' ? '🟡' : '🟢'
        const who = t.assigned_to ? ` — _${t.assigned_to}_` : ''
        const due = t.due_date ? ` (${fmtDate(t.due_date)})` : ''
        lines.push(`• ${prio} ${t.title}${due}${who}`)
      }
      if (overdue.length > 10) lines.push(`_…et ${overdue.length - 10} autres_`)
    } else {
      lines.push('✅ *Tâches* — aucun retard')
    }
    lines.push('')

    // Nouveaux inscrits cette semaine
    const newUsers = newUsersResult.status === 'fulfilled' ? (newUsersResult.value.data ?? []) : []
    if (newUsers.length > 0) {
      lines.push(`🎉 *Nouveaux inscrits (${newUsers.length})*`)
      for (const u of newUsers.slice(0, 10)) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Anonyme'
        lines.push(`• ${name} — ${accountTypeLabel(u.account_type)}`)
      }
      if (newUsers.length > 10) lines.push(`_…et ${newUsers.length - 10} autres_`)
    } else {
      lines.push('🎉 *Nouveaux inscrits* — aucun cette semaine')
    }

    lines.push('')
    lines.push('_Bonne semaine 🚀_')

    await sendTelegramMessage(chatId, lines.join('\n'))

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('telegram-weekly-report error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 502 })
  }
})
