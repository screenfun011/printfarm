import { createFileRoute, Outlet, Navigate, Link, useNavigate } from '@tanstack/react-router'
import { authStore } from '../lib/auth-store.js'
import { useState, useEffect } from 'react'
import { LayoutDashboard, Users, LogOut } from 'lucide-react'

function AppLayout() {
  const [isAuth, setIsAuth] = useState(authStore.isAuthenticated())
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = authStore.subscribe(() => {
      setIsAuth(authStore.isAuthenticated())
    })
    return () => { unsub() }
  }, [])

  if (!isAuth) return <Navigate to="/auth/login" />

  async function handleLogout() {
    await authStore.logout()
    navigate({ to: '/auth/login' })
  }

  const admin = authStore.getState().admin

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 px-6 py-5">
          <span className="text-lg font-bold text-white">PrintFarm</span>
          <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">Admin</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
          <NavLink to="/tenants" icon={<Users size={16} />} label="Tenanti" />
        </nav>

        <div className="border-t border-gray-800 p-4">
          <div className="mb-3 text-xs text-gray-500">{admin?.email}</div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <LogOut size={15} />
            Odjavi se
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white [&.active]:bg-gray-800 [&.active]:text-white"
    >
      {icon}
      {label}
    </Link>
  )
}

export const Route = createFileRoute('/_app')({ component: AppLayout })
