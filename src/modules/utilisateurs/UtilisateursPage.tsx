import { useState, useMemo, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useMemoviaUsers } from '@/hooks/useMemoviaUsers'
import { UserStats } from './components/UserStats'
import { UserTable } from './components/UserTable'
import type { MemoviaTypeFilter } from '@/types/users'
import { TYPE_FILTER_LABELS, matchesTypeFilter } from '@/types/users'

type PeriodFilter = 'week' | 'month' | null

const TYPE_FILTERS: { label: string; value: MemoviaTypeFilter | null }[] = [
  { label: 'Tous', value: null },
  { label: TYPE_FILTER_LABELS.student, value: 'student' },
  { label: TYPE_FILTER_LABELS.teacher, value: 'teacher' },
  { label: TYPE_FILTER_LABELS.school_admin, value: 'school_admin' },
]

const PERIOD_FILTERS: { label: string; value: PeriodFilter }[] = [
  { label: 'Tout', value: null },
  { label: 'Cette semaine', value: 'week' },
  { label: 'Ce mois', value: 'month' },
]

export default function UtilisateursPage() {
  const [filterType, setFilterType] = useState<MemoviaTypeFilter | null>(null)
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  const startDate = useMemo((): string | null => {
    if (filterPeriod === null) return null
    const today = new Date()
    if (filterPeriod === 'week') {
      const dow = today.getDay()
      const daysFromMonday = dow === 0 ? 6 : dow - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - daysFromMonday)
      monday.setHours(0, 0, 0, 0)
      return monday.toISOString()
    }
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  }, [filterPeriod])

  const { users, total, isLoading, error } = useMemoviaUsers(startDate)

  const typeFilteredUsers = filterType != null
    ? users.filter((u) => matchesTypeFilter(u.account_type, filterType))
    : users

  const filteredUsers = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return typeFilteredUsers
    return typeFilteredUsers.filter(
      (u) =>
        `${u.first_name} ${u.last_name ?? ''}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organization_name ?? '').toLowerCase().includes(q),
    )
  }, [typeFilteredUsers, debouncedQuery])

  const hasActiveFilter = filterType != null || filterPeriod != null

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
              Utilisateurs MEMOVIA
            </h2>
            {!isLoading && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--memovia-violet)]">
                {total} inscrits
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Lecture seule — données en direct depuis app.memovia.io.
          </p>
        </div>
      </motion.header>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </motion.div>
      )}

      {/* ── KPI Stats ────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <UserStats users={filteredUsers} total={total} isLoading={isLoading} error={error} />
      </motion.div>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--memovia-violet)]"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
      </motion.div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl px-4 py-3"
        style={{
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Type */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Type
          </span>
          {TYPE_FILTERS.map((pill) => {
            const isActive = filterType === pill.value
            return (
              <button
                key={pill.label}
                onClick={() => setFilterType(pill.value)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-all"
                style={
                  isActive
                    ? { backgroundColor: 'var(--memovia-violet)', color: '#fff' }
                    : {
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }
                }
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px sm:block" style={{ backgroundColor: 'var(--border-color)' }} />

        {/* Période d'inscription */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Inscrits
          </span>
          {PERIOD_FILTERS.map((pill) => {
            const isActive = filterPeriod === pill.value
            return (
              <button
                key={pill.label}
                onClick={() => setFilterPeriod(pill.value)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-all"
                style={
                  isActive
                    ? {
                        backgroundColor: 'color-mix(in oklab, var(--memovia-violet) 14%, var(--bg-primary))',
                        color: 'var(--memovia-violet)',
                        border: '1px solid var(--memovia-violet)',
                      }
                    : {
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }
                }
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {/* Reset */}
        {hasActiveFilter && (
          <button
            onClick={() => { setFilterType(null); setFilterPeriod(null) }}
            className="ml-auto text-[12px] text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </motion.div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <UserTable users={filteredUsers} isLoading={isLoading} />
      </motion.div>

      {/* ── Footer count ─────────────────────────────────────────────────────── */}
      {!isLoading && filteredUsers.length > 0 && (
        <motion.p variants={staggerItem} className="text-center text-[12px] text-[var(--text-muted)]">
          {filteredUsers.length === total
            ? `${total} utilisateur${total > 1 ? 's' : ''} au total`
            : `${filteredUsers.length} sur ${total} utilisateur${total > 1 ? 's' : ''}`}
          {total >= 500 && ' · affichage limité aux 500 plus récents'}
        </motion.p>
      )}
    </motion.div>
  )
}
