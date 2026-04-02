import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi, type TenantStatus } from '../../lib/api-client.js'

export function useTenants(params?: { status?: string }) {
  return useQuery({
    queryKey: ['tenants', params],
    queryFn: () => tenantsApi.list(params),
  })
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: () => tenantsApi.getById(id),
  })
}

export function useUpdateTenantStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TenantStatus }) =>
      tenantsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}
