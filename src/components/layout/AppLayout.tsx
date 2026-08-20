import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { TopBar } from './TopBar'
import { TopNav } from './TopNav'
import { MobileNav } from './MobileNav'
import { supabase } from '@/lib/supabase'
import { ease } from '@/lib/motion'

/**
 * Root layout for authenticated pages (refonte v2 : top-bar, plus de sidebar).
 * - Desktop (≥768px): logo + nav horizontale dans le header
 * - Mobile (<768px): hamburger menu + Sheet drawer
 * - motion.div with key change triggers entrance animation on navigation
 *   (AnimatePresence skipped — incompatible with React 19 + framer-motion v12)
 */
export default function AppLayout() {
  const location = useLocation()
  const section = location.pathname.split('/')[1] || 'root'

  // Compteur de visites par section — critère de kill de la refonte v2.
  // Fire-and-forget : un échec de log ne doit jamais gêner la navigation.
  useEffect(() => {
    if (section === 'root') return // '/' redirige vers /leads, ne pas compter deux fois
    supabase
      .from('section_visits')
      .insert({ section })
      .then(({ error }) => {
        if (error) console.warn('section_visits insert failed:', error.message)
      })
  }, [section])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Top bar : logo + nav horizontale (desktop) / hamburger (mobile) */}
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-5">
        {/* Mobile hamburger */}
        <div className="md:hidden">
          <MobileNav />
        </div>

        {/* Logo — monogramme M MEMOVIA */}
        <div className="hidden items-center gap-2.5 md:flex">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M2 17V4.5a1.5 1.5 0 0 1 2.56-1.06L10 8.88l5.44-5.44A1.5 1.5 0 0 1 18 4.5V17"
              stroke="#7C3AED"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="15.5" r="1.3" fill="#7C3AED" />
          </svg>
          <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
            MEMOVIA
          </span>
        </div>

        {/* Nav horizontale desktop */}
        <TopNav className="hidden md:flex" />

        {/* Titre de page + actions (privacy, notifications, user) */}
        <TopBar />
      </header>

      {/* Page content — keyed div triggers entrance animation on route change */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: ease.out }}
          className="min-w-0"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  )
}
