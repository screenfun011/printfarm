import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTenants, useUpdateTenantStatus } from '../../modules/tenants/hooks.js'
import type { Tenant, TenantStatus } from '../../lib/api-client.js'

const STATUS_LABELS: Record<TenantStatus, string> = {
  trial: 'Trial',
  trial_expired: 'Trial istekao',
  active: 'Aktivan',
  suspended: 'Suspendovan',
  blocked: 'Blokiran',
  deleted: 'Obrisan',
}

const STATUS_COLORS: Record<TenantStatus, string> = {
  trial: 'bg-yellow-900 text-yellow-300',
  trial_expired: 'bg-orange-900 text-orange-300',
  active: 'bg-green-900 text-green-300',
  suspended: 'bg-red-900 text-red-300',
  blocked: 'bg-red-950 text-red-400',
  deleted: 'bg-gray-800 text-gray-500',
}

function TenantsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: tenants, isLoading, error } = useTenants(statusFilter ? { status: statusFilter } : {})
  const updateStatus = useUpdateTenantStatus()

  function handleStatusChange(tenant: Tenant, status: TenantStatus) {
    updateStatus.mutate({ id: tenant.id, status })
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Tenanti</h1>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Svi statusi</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-gray-400">Učitavanje...</p>}
      {error && <p className="text-red-400">Greška pri učitavanju.</p>}

      {tenants && (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400">Naziv</th>
                <th className="px-4 py-3 text-left text-gray-400">Slug</th>
                <th className="px-4 py-3 text-left text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-gray-400">Korisnici</th>
                <th className="px-4 py-3 text-left text-gray-400">Kreiran</th>
                <th className="px-4 py-3 text-left text-gray-400">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nema tenanta
                  </td>
                </tr>
              )}
              {tenants.map(tenant => (
                <tr key={tenant.id} className="hover:bg-gray-900">
                  <td className="px-4 py-3 font-medium text-white">{tenant.name}</td>
                  <td className="px-4 py-3 text-gray-400">{tenant.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[tenant.status]}`}>
                      {STATUS_LABELS[tenant.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{tenant.userCount}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(tenant.createdAt).toLocaleDateString('sr-RS')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={tenant.status}
                      onChange={e => handleStatusChange(tenant, e.target.value as TenantStatus)}
                      className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
                      disabled={updateStatus.isPending}
                    >
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_app/tenants')({ component: TenantsPage })
