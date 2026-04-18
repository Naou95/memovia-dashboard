import { useEffect, useState } from 'react'
import { UserCog, Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Role = 'admin_full' | 'admin_bizdev'

interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  avatar_url: string | null
  created_at: string
  updated_at: string
}

const ROLE_LABELS: Record<Role, string> = {
  admin_full: 'Admin complet',
  admin_bizdev: 'Bizdev',
}

const ROLE_STYLES: Record<Role, string> = {
  admin_full: 'bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]',
  admin_bizdev: 'bg-emerald-50 text-emerald-700',
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  profile?: Profile
  onClose: () => void
  onSaved: () => void
}

function ProfileModal({ profile, onClose, onSaved }: ModalProps) {
  const isEdit = !!profile
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [role, setRole] = useState<Role>(profile?.role ?? 'admin_bizdev')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isEdit) {
        const { error: err } = await supabase
          .from('dashboard_profiles')
          .update({ full_name: fullName, role, updated_at: new Date().toISOString() })
          .eq('id', profile.id)
        if (err) throw err
      } else {
        const { error: fnErr } = await supabase.functions.invoke('invite-admin', {
          body: { email, full_name: fullName, role },
        })
        if (fnErr) throw fnErr
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {isEdit ? 'Modifier le collaborateur' : 'Inviter un collaborateur'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Nom complet</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Prénom Nom"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--memovia-violet)]/40"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="prenom@memovia.io"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--memovia-violet)]/40"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--memovia-violet)]/40"
            >
              <option value="admin_bizdev">Bizdev</option>
              <option value="admin_full">Admin complet</option>
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[var(--memovia-violet)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Enregistrer' : "Envoyer l\u2019invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  profile: Profile
  onClose: () => void
  onDeleted: () => void
}

function DeleteConfirm({ profile, onClose, onDeleted }: DeleteConfirmProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    await supabase.from('dashboard_profiles').delete().eq('id', profile.id)
    onDeleted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 shadow-xl">
        <h2 className="mb-2 text-base font-semibold text-[var(--text-primary)]">Supprimer ce collaborateur ?</h2>
        <p className="mb-5 text-sm text-[var(--text-muted)]">
          <strong>{profile.full_name}</strong> ({profile.email}) sera retiré du dashboard. Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | Profile | null>(null)
  const [toDelete, setToDelete] = useState<Profile | null>(null)

  const fetchProfiles = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('dashboard_profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setProfiles((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  return (
    <>
      <div className="flex h-full flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--memovia-violet-light)]">
              <UserCog className="h-5 w-5 text-[var(--memovia-violet)]" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-[var(--text-primary)]">Gestion admins</h1>
              <p className="text-xs text-[var(--text-muted)]">
                {profiles.length} collaborateur{profiles.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-2 rounded-xl bg-[var(--memovia-violet)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Ajouter un collaborateur
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--memovia-violet)]" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <UserCog className="h-8 w-8 opacity-30" />
              <p className="text-sm">Aucun collaborateur</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Collaborateur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Membre depuis</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Màj</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {profiles.map((p) => (
                  <tr key={p.id} className="group hover:bg-[var(--bg-primary)]/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            'bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]'
                          )}
                        >
                          {initials(p.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{p.full_name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          ROLE_STYLES[p.role]
                        )}
                      >
                        {ROLE_LABELS[p.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(p.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal(p)}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setToDelete(p)}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <ProfileModal onClose={() => setModal(null)} onSaved={fetchProfiles} />
      )}
      {modal && modal !== 'add' && (
        <ProfileModal profile={modal as Profile} onClose={() => setModal(null)} onSaved={fetchProfiles} />
      )}
      {toDelete && (
        <DeleteConfirm profile={toDelete} onClose={() => setToDelete(null)} onDeleted={fetchProfiles} />
      )}
    </>
  )
}
