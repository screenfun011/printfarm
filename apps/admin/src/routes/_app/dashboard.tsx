import { createFileRoute } from '@tanstack/react-router'
import { useStats } from '../../modules/stats/hooks.js'

function DashboardPage() {
  const { data: stats, isLoading, error } = useStats()

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Dashboard</h1>

      {isLoading && <p className="text-gray-400">Učitavanje...</p>}
      {error && <p className="text-red-400">Greška pri učitavanju statistika.</p>}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Ukupno tenanta" value={stats.tenants.total} />
          <StatCard label="Aktivni tenanti" value={stats.tenants.active} color="green" />
          <StatCard label="Trial tenanti" value={stats.tenants.trial} color="yellow" />
          <StatCard label="Ukupno korisnika" value={stats.users.total} />
          <StatCard label="Ukupno printera" value={stats.printers.total} />
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'blue' }: { label: string; value: number; color?: 'blue' | 'green' | 'yellow' }) {
  const colors = {
    blue: 'border-blue-800 bg-blue-950 text-blue-300',
    green: 'border-green-800 bg-green-950 text-green-300',
    yellow: 'border-yellow-800 bg-yellow-950 text-yellow-300',
  }

  return (
    <div className={`rounded-xl border p-6 ${colors[color]}`}>
      <p className="text-sm opacity-70">{label}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
    </div>
  )
}

export const Route = createFileRoute('/_app/dashboard')({ component: DashboardPage })
