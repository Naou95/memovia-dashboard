import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

/**
 * Refonte v2 Phase 2 : audio d'un RDV → transcription (Gladia) → compte rendu (Gemini).
 *
 * Appelée par le dashboard après upload de l'audio dans le bucket privé rdv-audio.
 * Déployée AVEC verify_jwt (pas de --no-verify-jwt) : c'est un appel utilisateur, pas un cron.
 *
 * ⚠️ La transcription n'est PAS diarizée : le CR n'attribue jamais un propos à une personne
 * (« il a été convenu », jamais « X a dit »). Qui a dit quoi serait une invention.
 */

const GLADIA_BASE = 'https://api.gladia.io/v2'
const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 90 // ~4 min 30 : au-delà, on rend l'erreur plutôt que de pendre

async function transcribeWithGladia(audio: Blob, filename: string, apiKey: string): Promise<string> {
  const fd = new FormData()
  fd.append('audio', audio, filename)
  const uploadRes = await fetch(`${GLADIA_BASE}/upload`, {
    method: 'POST',
    headers: { 'x-gladia-key': apiKey },
    body: fd,
  })
  if (!uploadRes.ok) throw new Error(`gladia_upload_${uploadRes.status}`)
  const { audio_url } = await uploadRes.json()

  const initRes = await fetch(`${GLADIA_BASE}/pre-recorded`, {
    method: 'POST',
    headers: { 'x-gladia-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url, detect_language: true }),
  })
  if (!initRes.ok) throw new Error(`gladia_init_${initRes.status}`)
  const { id: jobId } = await initRes.json()

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const pollRes = await fetch(`${GLADIA_BASE}/pre-recorded/${jobId}`, {
      headers: { 'x-gladia-key': apiKey },
    })
    if (!pollRes.ok) continue
    const job = await pollRes.json()
    if (job.status === 'done') {
      const transcript = job.result?.transcription?.full_transcript
      if (!transcript) throw new Error('gladia_empty_transcript')
      return transcript
    }
    if (job.status === 'error') throw new Error('gladia_job_error')
  }
  throw new Error('gladia_timeout')
}

async function generateCr(transcript: string, title: string, apiKey: string): Promise<string> {
  const prompt = `Tu rédiges le compte rendu interne d'un rendez-vous professionnel MEMOVIA (EdTech, accessibilité pour CFA) à partir de sa transcription brute.

Règles strictes :
- La transcription ne distingue PAS les locuteurs : n'attribue JAMAIS un propos à une personne. Formule au neutre (« il a été évoqué », « la décision prise est »).
- N'invente RIEN : si une information n'est pas dans la transcription, elle n'est pas dans le CR.
- Français, concis, directement exploitable.

Format markdown exact :
## Contexte
(1-2 phrases)
## Points clés
(puces)
## Décisions
(puces, ou « Aucune décision actée »)
## Prochaine action
(une ligne : quoi, qui, quand si connu)

Titre du RDV : ${title}

Transcription :
${transcript}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // thinkingBudget:0 obligatoire : sans lui, 500 intermittents constatés sur le projet
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  )
  if (!res.ok) throw new Error(`gemini_${res.status}`)
  const data = await res.json()
  const cr = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!cr) throw new Error('gemini_empty')
  return cr
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const auth = await validateAuth(req)
  if (auth instanceof Response) return auth

  const { rdv_id } = await req.json().catch(() => ({}))
  if (!rdv_id || typeof rdv_id !== 'string') return errorResponse('rdv_id_required', 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: rdv, error: rdvError } = await supabase
    .from('rdv')
    .select('id, title, audio_path')
    .eq('id', rdv_id)
    .maybeSingle()
  if (rdvError || !rdv) return errorResponse('rdv_not_found', 404)
  if (!rdv.audio_path) return errorResponse('no_audio', 400)

  const gladiaKey = Deno.env.get('GLADIA_API_KEY')
  const googleKey = Deno.env.get('GOOGLE_API_KEY')
  if (!gladiaKey || !googleKey) return errorResponse('provider_keys_missing', 500)

  await supabase.from('rdv').update({ cr_status: 'en_cours', updated_at: new Date().toISOString() }).eq('id', rdv_id)

  try {
    const { data: file, error: dlError } = await supabase.storage
      .from('rdv-audio')
      .download(rdv.audio_path)
    if (dlError || !file) throw new Error('audio_download_failed')

    const transcript = await transcribeWithGladia(file, rdv.audio_path.split('/').pop() ?? 'audio', gladiaKey)
    const cr = await generateCr(transcript, rdv.title, googleKey)

    const { error: updateError } = await supabase
      .from('rdv')
      .update({ transcript, cr, cr_status: 'fait', updated_at: new Date().toISOString() })
      .eq('id', rdv_id)
    if (updateError) throw new Error('rdv_update_failed')

    return new Response(JSON.stringify({ ok: true, cr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('[rdv-transcribe]', rdv_id, msg)
    // Échec = retour à « manquant » : le briefing continuera de le relancer,
    // jamais un « en cours » éternel qui ressemble à un succès.
    await supabase.from('rdv').update({ cr_status: 'manquant', updated_at: new Date().toISOString() }).eq('id', rdv_id)
    return errorResponse(msg, 502)
  }
})
