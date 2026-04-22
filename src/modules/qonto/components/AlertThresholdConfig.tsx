import { useState, useEffect } from 'react'
import { Bell, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const SETTINGS_KEY = 'qonto_alert_threshold'

interface AlertThresholdConfigProps {
  /** Callback appelé après sauvegarde pour mettre à jour le seuil affiché */
  onSaved: (threshold: number) => void
}

export function AlertThresholdConfig({ onSaved }: AlertThresholdConfigProps) {
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Charger le seuil existant depuis Supabase au montage
  useEffect(() => {
    // Cast requis : le type Database est mis à jour manuellement (pas via supabase gen types).
    // La colonne `value` existe bien sur dashboard_settings.
    const query = supabase
      .from('dashboard_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle() as unknown as Promise<{ data: { value: string } | null; error: unknown }>

    query.then(({ data, error: e }) => {
      if (!e && data?.value) {
        setInputValue(data.value)
      }
      setIsLoading(false)
    })
  }, [])

  async function handleSave() {
    const val = parseFloat(inputValue)
    if (isNaN(val) || val < 0 || val > 999999) {
      setError('Entrez un montant entre 0 et 999 999 €')
      return
    }

    setError(null)
    setIsSaving(true)

    const row: { key: string; value: string } = { key: SETTINGS_KEY, value: String(val) }
    const { error: upsertError } = await (supabase
      .from('dashboard_settings')
      .upsert(row as never, { onConflict: 'key' }) as unknown as Promise<{ error: unknown }>)

    setIsSaving(false)

    if (upsertError) {
      setError('Erreur lors de la sauvegarde')
      return
    }

    setSaved(true)
    onSaved(val)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <article className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--accent-purple-bg)' }}
        >
          <Bell className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} strokeWidth={2.25} />
        </div>
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">
          Alerte solde
        </span>
      </div>

      <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
        Avertissement si le solde passe sous ce seuil.
      </p>

      {isLoading ? (
        <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--border-color)]" />
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              max="999999"
              step="100"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setSaved(false)
              }}
              placeholder="Ex : 5000"
              className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 pr-8 text-[13px] text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-strong)] focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)]">
              €
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || inputValue === ''}
            className="flex h-9 min-w-[110px] items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--memovia-violet)' }}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Enregistré
              </>
            ) : (
              'Sauvegarder'
            )}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--trend-down-text)' }}>
          {error}
        </p>
      )}
    </article>
  )
}
