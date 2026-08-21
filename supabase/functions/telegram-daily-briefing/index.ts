import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import { echapperMarkdown, sendTelegramMessage } from '../_shared/telegram.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'

interface QontoBankAccount { balance_cents: number }
interface QontoResponse { bank_accounts: QontoBankAccount[] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  // Deux portes d'entrée, l'une OU l'autre suffit :
  //  - `x-cron-secret` (pg_cron, cf. _shared/cronAuth.ts et migration 00034). C'est la voie
  //    normale depuis le 14/08/2026 : l'ancienne dépendait d'un GUC jamais posé, ce qui a
  //    fait échouer ce cron 117 fois d'affilée depuis le 20/04, sans que rien ne le signale.
  //  - la clé service_role en Authorization, conservée pour tout appel manuel existant.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const parServiceRole = !!token && !!serviceRoleKey && token === serviceRoleKey

  if (!parServiceRole && !(await isAuthenticatedCronCall(req))) {
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

    const [stripeResult, qontoResult, tasksResult, leadsResult, rdvResult, finResult, detectorResult, milestonesResult] = await Promise.allSettled([
      // Stripe MRR
      (async () => {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (!stripeKey) return null
        const stripe = new Stripe(stripeKey)
        const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 }, { timeout: 8000 })
        const mrr = subs.data.reduce((sum, sub) => {
          const plan = sub.items.data[0]?.plan
          if (!plan?.amount) return sum
          const count = plan.interval_count ?? 1
          let monthly: number
          switch (plan.interval) {
            case 'week': monthly = plan.amount * 4.33 / count; break
            case 'year': monthly = plan.amount / (12 * count); break
            default: monthly = plan.amount / count; break
          }
          return sum + monthly / 100
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

      // Tâches échues, TOUTE L'ÉQUIPE et pas seulement naoufel.
      // Avant : `.eq('assigned_to','naoufel')`. Le message annonçait « aucune tâche échue »
      // alors qu'une tâche traînait depuis 92 jours chez emir (« Contacter TBS ALUMNI »), sur
      // un lead qui figure justement dans la liste des dormants juste en dessous. Un briefing
      // qui dit « aucune » en filtrant sur une personne dit quelque chose de faux.
      // `leads(name)` : jointure PostgREST via la FK tasks.lead_id (00047) — une tâche
      // liée à une fiche affiche « → <fiche> » pour dire à QUI on doit quoi.
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, assigned_to, lead_id, leads(name)')
        .in('status', ['todo', 'en_cours'])
        .lte('due_date', today)
        .order('due_date', { ascending: true }),

      // Leads sans contact depuis 7 jours et plus.
      //
      // ⚠️ On mesure `last_contact_date`, PAS `updated_at`. `updated_at` est bumpé par un trigger
      // à la moindre modification de ligne : une session d'édition en lot le 26/05 avait remis
      // quatre leads « à neuf » alors que personne ne les avait rappelés. Résultat mesuré le
      // 15/08 : ISAE-SUPAERO et CFA Blagnac annoncés « 81j sans suivi » pour 122 jours réels,
      // soit 41 jours d'écart, dans le sens qui rassure à tort.
      // Repli sur `updated_at` quand `last_contact_date` est vide (leads saisis à la main).
      //
      // `count: 'exact'` : le titre doit dire COMBIEN il y en a, pas combien on en montre.
      // On tire large (50) puis on trie côté TS, parce que PostgREST ne sait pas trier sur un
      // coalesce des deux dates.
      // ⚠️ `archived = false` : depuis la refonte v2 Phase 1 (20/08/2026), la liste pré-refonte
      // est archivée. Sans ce filtre, 11 leads morts rempliraient la section chaque matin.
      // Les partenaires (type='partenaire') sont gérés en low-touch : la relance
      // « +7j sans contact » serait un mensonge de priorité.
      supabase
        .from('leads')
        .select('id, name, status, updated_at, last_contact_date', { count: 'exact' })
        .eq('archived', false)
        .neq('type', 'partenaire')
        .not('status', 'in', '(gagne,perdu)')
        .or(`last_contact_date.lt.${sevenDaysAgo},and(last_contact_date.is.null,updated_at.lt.${sevenDaysAgo})`)
        .limit(50),

      // RDV passés sans compte rendu (refonte v2 Phase 2) : c'est le filet anti-oubli.
      // Un RDV reste relancé chaque matin tant que son CR n'est pas fait.
      supabase
        .from('rdv')
        .select('id, title, rdv_date')
        .eq('cr_status', 'manquant')
        .lt('rdv_date', new Date().toISOString())
        .order('rdv_date', { ascending: false })
        .limit(10),

      // Deadlines financements ≤ 14 jours (refonte v2 Phase 3), y compris dépassées tant
      // que le statut reste actionnable (veille / à déposer / jury). Un « déposé » ne se
      // relance pas : sa deadline est derrière lui par définition.
      supabase
        .from('financements')
        .select('id, name, deadline, status, next_action')
        .in('status', ['veille', 'a_deposer', 'jury'])
        .not('deadline', 'is', null)
        .lte('deadline', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])
        .order('deadline', { ascending: true })
        .limit(10),

      // Dernier run du détecteur de leads (00046), écrit par le détecteur lui-même.
      // Sans cette lecture, « Leads : tous à jour ✓ » restait vert pendant que le
      // détecteur était mort (504 du 20/08, 0 écriture).
      supabase
        .from('lead_detector_runs')
        .select('started_at, finished_at, outcome, stats')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Candidats changelog à trier (mémoire d'entreprise, 21/08/2026) : versés
      // chaque lundi par changelog-collect, la ligne relance tant qu'il en reste.
      supabase
        .from('product_milestones')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'candidat'),
    ])

    const dayLabel = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const lines: string[] = [`☀️ *Bonjour Naoufel, ${dayLabel}*`, '']

    // Le briefing est la porte d'entrée du dashboard (refonte v2 Phase 6) :
    // chaque section porte le lien profond vers sa page.
    const DASH = 'https://dashboard.memovia.io'

    // Finances
    lines.push(`💰 *Finances* · [ouvrir](${DASH}/argent)`)
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
      lines.push(`✅ *Tâches échues (${tasks.length})*`)
      for (const t of tasks) {
        const prio = t.priority === 'haute' ? '🔴' : t.priority === 'normale' ? '🟡' : '🟢'
        const retard = t.due_date && t.due_date < today
          ? ` ⚠️ ${Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)} j de retard`
          : ''
        // Dire QUI porte la tâche : sinon une tâche d'Emir ressemble à une tâche de Naoufel.
        const qui = t.assigned_to ? ` _(${echapperMarkdown(String(t.assigned_to))})_` : ''
        // Et envers QUI on s'est engagé, quand la tâche est liée à une fiche (00047).
        const fiche = (t as { leads?: { name?: string } | null }).leads?.name
        lines.push(`• ${prio} ${echapperMarkdown(t.title)}${qui}${fiche ? ` → ${echapperMarkdown(fiche)}` : ''}${retard}`)
      }
    } else {
      lines.push('✅ *Tâches* : aucune tâche échue, toute l\'équipe')
    }
    lines.push('')

    // Stale leads
    const brutLeads = leadsResult.status === 'fulfilled' ? (leadsResult.value.data ?? []) : []
    const totalStale = leadsResult.status === 'fulfilled'
      ? (leadsResult.value.count ?? brutLeads.length)
      : brutLeads.length

    // Ancienneté réelle : dernier contact si on l'a, sinon dernière modif (et on le signale par
    // un « ~ », pour ne pas donner à une approximation l'apparence d'une mesure).
    const AVEC_AGE = brutLeads
      .map((l) => {
        const estime = !l.last_contact_date
        const ref = new Date(l.last_contact_date ?? l.updated_at).getTime()
        return { ...l, estime, jours: Math.floor((Date.now() - ref) / 86400000) }
      })
      .sort((a, b) => b.jours - a.jours)
    const staleLeads = AVEC_AGE.slice(0, 10)

    if (staleLeads.length > 0) {
      // Dire explicitement quand la liste est tronquée, plutôt que de laisser croire au total.
      const entete = totalStale > staleLeads.length
        ? `👥 *Leads sans contact +7j : ${totalStale}* (les ${staleLeads.length} plus anciens)`
        : `👥 *Leads sans contact +7j (${totalStale})*`
      lines.push(`${entete} · [ouvrir](${DASH}/leads)`)
      for (const l of staleLeads) {
        // `status` vaut par ex. `en_discussion` : son underscore cassait le Markdown et faisait
        // partir tout le message en texte brut. On l'affiche en clair, c'est aussi plus lisible.
        const statut = echapperMarkdown(String(l.status ?? '').replace(/_/g, ' '))
        const approx = l.estime ? '~' : ''
        lines.push(`• ${echapperMarkdown(l.name)} _(${statut})_ · ${approx}${l.jours} j sans contact`)
      }
      if (staleLeads.some((l) => l.estime)) {
        lines.push('_~ = pas de date de dernier contact, ancienneté estimée sur la dernière modif_')
      }
    } else if (leadsResult.status === 'rejected' || leadsResult.value.error) {
      // ⚠️ Ne JAMAIS afficher « tous à jour » quand la requête a échoué : une liste vide parce
      // qu'on n'a pas su lire la base ressemble mot pour mot à un pipeline sain. Même piège que
      // le cron qui rapportait « succeeded » sans avoir rien fait.
      const cause = leadsResult.status === 'rejected'
        ? String(leadsResult.reason)
        : String(leadsResult.value.error?.message ?? 'inconnue')
      console.error('[briefing] lecture des leads en échec:', cause)
      lines.push('👥 *Leads* : ⚠️ données indisponibles, requête en échec')
    } else {
      lines.push('👥 *Leads* : tous à jour ✓')
    }

    // Santé du détecteur : la ligne au-dessus parle du CRM, celle-ci du robot qui
    // l'alimente. Trois morts silencieuses couvertes : le cron ne tire plus (dernière
    // ligne vieille), run parti jamais fini ('running' ancien), run en échec ou coupé
    // par son budget. Même règle que le reste du briefing : une lecture en échec
    // s'affiche comme telle, jamais comme du vert.
    if (detectorResult.status === 'rejected' || detectorResult.value.error) {
      console.error('[briefing] lecture lead_detector_runs en échec')
      lines.push('🤖 *Détecteur leads* : ⚠️ statut illisible')
    } else if (!detectorResult.value.data) {
      lines.push('🤖 *Détecteur leads* : aucun run enregistré')
    } else {
      const run = detectorResult.value.data
      const heures = Math.floor((Date.now() - new Date(run.started_at).getTime()) / 3600000)
      const age = heures < 1 ? 'il y a moins d\'1 h' : heures < 48 ? `il y a ${heures} h` : `il y a ${Math.floor(heures / 24)} j`
      const s = run.stats as { analyzed?: number; inserted?: number; updated?: number; errors?: number } | null
      const detail = s
        ? ` (${s.analyzed ?? 0} analysées · ${s.inserted ?? 0} nouvelles · ${s.updated ?? 0} màj${s.errors ? ` · ${s.errors} erreurs` : ''})`
        : ''
      const libelle =
        run.outcome === 'ok' ? `dernier run OK ${age}${detail}`
        : run.outcome === 'global_timeout' ? `⚠️ dernier run coupé par son budget ${age} — partiel, stats en base seulement`
        : run.outcome === 'error' ? `⚠️ dernier run en échec ${age}${detail}`
        : heures < 1 ? 'run en cours'
        : `⚠️ run parti ${age}, jamais fini (mort en vol)`
      // Le cron tire chaque nuit à 23h UTC : un dernier run de plus de 30 h = une nuit ratée.
      const retard = run.outcome !== 'running' && heures > 30 ? ' · ⚠️ plus de 30 h sans nouveau run' : ''
      lines.push(`🤖 *Détecteur leads* : ${libelle}${retard}`)
    }

    // Candidats changelog — ligne optionnelle : n'apparaît que s'il y a du tri à
    // faire ; une lecture en échec se loggue sans fausse alerte dans le message.
    if (milestonesResult.status === 'fulfilled' && !milestonesResult.value.error) {
      const nCandidats = milestonesResult.value.count ?? 0
      if (nCandidats > 0) {
        lines.push(`🗂 *Historique produit* : ${nCandidats} candidat${nCandidats > 1 ? 's' : ''} à trier · [ouvrir](${DASH}/historique)`)
      }
    } else {
      console.error('[briefing] lecture product_milestones en échec')
    }

    lines.push('')

    // Deadlines financements — le compte à rebours s'affiche chaque jour sous 14 j :
    // une deadline de concours ratée ne se rattrape pas.
    const finProches = finResult.status === 'fulfilled' ? (finResult.value.data ?? []) : []
    if (finProches.length > 0) {
      lines.push(`🏆 *Financements — deadlines proches (${finProches.length})* · [ouvrir](${DASH}/financements)`)
      for (const f of finProches) {
        const jours = Math.ceil((new Date(f.deadline).getTime() - Date.now()) / 86400000)
        const compte = jours < 0 ? `⚠️ dépassée de ${-jours} j` : jours === 0 ? '🔴 AUJOURD\'HUI' : jours <= 7 ? `🔴 J-${jours}` : `J-${jours}`
        lines.push(`• ${echapperMarkdown(f.name)} · ${compte}`)
        if (f.next_action) lines.push(`  ↳ ${echapperMarkdown(f.next_action)}`)
      }
      lines.push('')
    } else if (finResult.status === 'rejected' || finResult.value.error) {
      console.error('[briefing] lecture des financements en échec')
      lines.push('🏆 *Financements* : ⚠️ données indisponibles, requête en échec')
      lines.push('')
    }

    // RDV sans compte rendu — même règle que les leads : ne jamais confondre
    // « rien à signaler » et « requête en échec ».
    const rdvManquants = rdvResult.status === 'fulfilled' ? (rdvResult.value.data ?? []) : []
    if (rdvManquants.length > 0) {
      lines.push(`📝 *RDV sans compte rendu (${rdvManquants.length})* · [ouvrir](${DASH}/rdv)`)
      for (const r of rdvManquants) {
        const jours = Math.floor((Date.now() - new Date(r.rdv_date).getTime()) / 86400000)
        const age = jours === 0 ? 'aujourd\'hui' : jours === 1 ? 'hier' : `il y a ${jours} j`
        lines.push(`• ${echapperMarkdown(r.title)} _(${age})_`)
      }
      lines.push('_Uploade l\'enregistrement sur la fiche, ou saisis le CR à la main._')
      lines.push('')
    } else if (rdvResult.status === 'rejected' || rdvResult.value.error) {
      console.error('[briefing] lecture des rdv en échec')
      lines.push('📝 *RDV* : ⚠️ données indisponibles, requête en échec')
      lines.push('')
    }

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
