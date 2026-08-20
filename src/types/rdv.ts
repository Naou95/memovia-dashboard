export type CrStatus = 'manquant' | 'en_cours' | 'fait'

export interface Rdv {
  id: string
  title: string
  rdv_date: string
  lead_id: string | null
  gcal_event_id: string | null
  audio_path: string | null
  transcript: string | null
  cr: string | null
  cr_status: CrStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RdvUpdate = Partial<
  Pick<Rdv, 'title' | 'rdv_date' | 'lead_id' | 'audio_path' | 'transcript' | 'cr' | 'cr_status'>
>

export interface RdvInsert {
  title: string
  rdv_date: string
  lead_id?: string | null
  gcal_event_id?: string | null
}

export const CR_STATUS_LABELS: Record<CrStatus, string> = {
  manquant: 'CR manquant',
  en_cours: 'Transcription…',
  fait: 'CR fait',
}
