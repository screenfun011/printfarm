import { createFileRoute, Outlet, redirect, Link, useRouter } from '@tanstack/react-router'
import { authStore } from '@/lib/auth-store'
import { authApi } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Printer,
  FileBox,
  PlaySquare,
  ScanEye,
  LogOut,
} from 'lucide-react'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated()) {
      throw redirect({ to: '/auth/login' })
    }
  },
  component: AppLayout,
})

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/printers', icon: Printer, label: 'Štampači' },
  { to: '/files', icon: FileBox, label: 'Fajlovi' },
  { to: '/jobs', icon: PlaySquare, label: 'Jobovi' },
  { to: '/ai', icon: ScanEye, label: 'AI Detekcije' },
] as const

function AppLayout() {
  const router = useRouter()
  const user = authStore.getState().user

  async function handleLogout() {
    try { await authApi.logout() } catch { /* ignore */ }
    authStore.clearAuth()
    router.navigate({ to: '/auth/login' })
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-border bg-card shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <span className="font-semibold text-sm tracking-wide">PrintFarm</span>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-accent',
                '[&.active]:text-foreground [&.active]:bg-accent [&.active]:font-medium',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium shrink-0">
              {user?.fullName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Odjavi se
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
