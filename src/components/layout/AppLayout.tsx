import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'

/**
 * Root layout for authenticated pages.
 * - Desktop (≥768px): persistent sidebar + content area
 * - Mobile (<768px): hamburger menu in TopBar + Sheet drawer
 */
export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar className="hidden md:flex" />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-2 border-b border-[var(--border-color)] bg-white px-4">
          {/* Mobile hamburger — hidden on md+ (sidebar takes over) */}
          <div className="md:hidden">
            <MobileNav />
          </div>
          {/* TopBar stretches to fill remaining space */}
          <div className="flex flex-1 items-center justify-between">
            <TopBar />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  )
}
