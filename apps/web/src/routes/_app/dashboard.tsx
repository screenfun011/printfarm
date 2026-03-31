import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { printersApi, jobsApi } from '@/lib/api-client'
import { Printer, PlaySquare, CheckCircle, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function StatCard({ label, value, icon: Icon, sub }: {
  label: string
  value: number | string
  icon: React.ElementType
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function DashboardPage() {
  const { data: printers = [] } = useQuery({ queryKey: ['printers'], queryFn: printersApi.list })
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: jobsApi.list })

  const onlinePrinters = printers.filter(p => p.status === 'online').length
  const activeJobs = jobs.filter(j => ['queued', 'preparing', 'printing'].includes(j.status)).length
  const completedJobs = jobs.filter(j => j.status === 'completed').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Pregled vaše farme</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Štampači" value={printers.length} icon={Printer} sub={`${onlinePrinters} online`} />
        <StatCard label="Aktivni jobovi" value={activeJobs} icon={PlaySquare} />
        <StatCard label="Završeni" value={completedJobs} icon={CheckCircle} />
        <StatCard label="Neuspešni" value={failedJobs} icon={AlertCircle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent jobs */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium">Poslednji jobovi</h2>
          </div>
          <div className="divide-y divide-border">
            {jobs.slice(0, 5).length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nema jobova</p>
            )}
            {jobs.slice(0, 5).map(job => (
              <div key={job.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm truncate">{job.name}</span>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Printers status */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium">Štampači</h2>
          </div>
          <div className="divide-y divide-border">
            {printers.slice(0, 5).length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nema štampača</p>
            )}
            {printers.slice(0, 5).map(printer => (
              <div key={printer.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm">{printer.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{printer.model.toUpperCase()}</span>
                </div>
                <StatusBadge status={printer.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    online: 'bg-green-100 text-green-700',
    offline: 'bg-gray-100 text-gray-600',
    printing: 'bg-blue-100 text-blue-700',
    queued: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    canceled: 'bg-gray-100 text-gray-600',
    paused: 'bg-orange-100 text-orange-700',
    error: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
