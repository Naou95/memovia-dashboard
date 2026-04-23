import { createClient } from 'jsr:@supabase/supabase-js@2'

interface LeadRecord {
  id: string
  name: string
  contact_name?: string | null
  maturity?: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: LeadRecord
  old_record: LeadRecord | null
}

function addDaysISO(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  try {
    const payload: WebhookPayload = await req.json()

    if (payload.type !== 'UPDATE' || payload.table !== 'leads') {
      return new Response(JSON.stringify({ ok: true, skipped: 'not_lead_update' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const newMaturity = payload.record?.maturity
    const oldMaturity = payload.old_record?.maturity

    if (newMaturity !== 'chaud' || oldMaturity === 'chaud') {
      return new Response(JSON.stringify({ ok: true, skipped: 'maturity_not_changed_to_chaud' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { id: leadId, name, contact_name } = payload.record
    if (!leadId || !name) {
      return new Response(JSON.stringify({ error: 'missing lead id or name' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const personLabel = contact_name?.trim() || name
    const title = contact_name?.trim()
      ? `Relancer ${contact_name} — ${name}`
      : `Relancer ${name}`

    const dueDate = addDaysISO(2)

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('title', title)
      .eq('status', 'todo')
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ ok: true, skipped: 'task_already_exists', task_id: existing.id }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: task, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title,
        description: `Lead ${personLabel} passé en maturité "chaud". Relance à effectuer rapidement.`,
        status: 'todo',
        priority: 'haute',
        due_date: dueDate,
        assigned_to: 'emir',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[lead-hot-trigger] insert task failed:', insertError.message)
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, task_id: task.id, lead_id: leadId, due_date: dueDate }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('lead-hot-trigger error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
