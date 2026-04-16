import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { CopilotBubble } from '@/components/copilot/CopilotBubble'

/**
 * Root layout for authenticated pages.
 * - Desktop (≥768px): light sidebar + content area
 * - Mobile (<768px): hamburger menu in header + Sheet drawer
 * - Floating AI copilot in the bottom-right corner on every page
 */
export default function AppLayout() {
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />

      {/* Floating AI copilot */}
      <CopilotBubble />
    </div>
  )
}
