import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Pencil, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// Style markdown minimal (pas de plugin typography dans le projet)
const mdClass =
  'text-sm text-[var(--text-primary)] [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-[var(--text-secondary)] [&_p]:mt-1.5 [&_p]:leading-relaxed [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_a]:text-[var(--memovia-violet)] [&_a]:underline [&_em]:text-[var(--text-muted)] [&_code]:rounded [&_code]:bg-[var(--bg-primary)] [&_code]:px-1 [&_code]:text-[12px]'

interface EditableBlockProps {
  settingsKey: 'leads_script' | 'leads_docs'
  title: string
}

function EditableBlock({ settingsKey, title }: EditableBlockProps) {
  const [value, setValue] = useState('')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('dashboard_settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle()
    if (data?.value) setValue(data.value)
  }, [settingsKey])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    setIsSaving(true)
    const { error } = await supabase
      .from('dashboard_settings')
      .upsert({ key: settingsKey, value: draft }, { onConflict: 'key' })
    setIsSaving(false)
    if (error) {
      toast.error('Sauvegarde impossible.')
      return
    }
    setValue(draft)
    setEditing(false)
    toast.success('Enregistré.')
  }

  return (
    <section className="border-t border-[var(--border-color)] px-5 py-4 first:border-t-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
          {title}
        </h3>
        {editing ? (
          <Button size="sm" onClick={save} disabled={isSaving} className="h-7 gap-1 px-2 text-[12px]">
            <Check className="h-3.5 w-3.5" />
            {isSaving ? '…' : 'Enregistrer'}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(value)
              setEditing(true)
            }}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
          >
            <Pencil className="h-3 w-3" />
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 font-mono text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
        />
      ) : (
        <div className={mdClass}>
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      )}
    </section>
  )
}

/**
 * Script d'appel + docs de vente (refonte v2 Phase 1). Sheet latérale lisible
 * pendant un appel ; contenu partagé, stocké dans dashboard_settings, éditable
 * par les deux admins sans deploy.
 */
export function ScriptPanel() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <BookOpen className="h-4 w-4" />
          Script & docs
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetTitle className="px-5 pb-2 pt-5 text-[15px] font-semibold text-[var(--text-primary)]">
          Prospection CFA France — offre accessibilité
        </SheetTitle>
        <EditableBlock settingsKey="leads_script" title="Script d'appel" />
        <EditableBlock settingsKey="leads_docs" title="Docs de vente" />
      </SheetContent>
    </Sheet>
  )
}
