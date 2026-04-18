import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { CopilotBubble } from '@/components/copilot/CopilotBubble'
import { ease } from '@/lib/motion'

/**
 * Root layout for authenticated pages.
 * - Desktop (≥768px): light sidebar + content area
 * - Mobile (<768px): hamburger menu in header + Sheet drawer
 * - motion.div with key change triggers entrance animation on navigation
 *   (AnimatePresence skipped — incompatible with React 19 + framer-motion v12)
 * - Floating AI copilot in the bottom-right corner on every page
 */
export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar className="hidden md:flex" />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-5">
          {/* Mobile hamburger */}
          <div className="md:hidden">
            <MobileNav />
          </div>
          <TopBar />
        </header>

        {/* Page content — keyed div triggers entrance animation on route change */}
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: ease.out }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />

      {/* Floating AI copilot */}
      <CopilotBubble />
    </div>
  )
}
