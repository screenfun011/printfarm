import { ApiError } from './query-client.js'

const BASE_URL = '/admin-api'
const TOKEN_KEY = 'printfarm_admin_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenStorage.get()

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Server nije dostupan', 0)
  }

  let data: { success: boolean; data?: T; error?: { code: string; message: string } }
  try {
    data = await res.json()
  } catch {
    throw new ApiError('NETWORK_ERROR', `Neočekivani odgovor servera (${res.status})`, res.status)
  }

  if (!data.success) {
    throw new ApiError(data.error!.code, data.error!.message, res.status)
  }

  return data.data as T
}

// ---- Auth ----
export const authApi = {
  login: (body: { email: string; password: string; totpCode?: string }) =>
    request<{ token: string; admin: AdminUser } | { requireTotp: true }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => request<null>('/auth/logout', { method: 'POST' }),

  me: () => request<AdminUser>('/auth/me'),
}

// ---- Tenants ----
export const tenantsApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const query = qs.toString()
    return request<Tenant[]>(`/tenants${query ? `?${query}` : ''}`)
  },

  getById: (id: string) => request<Tenant>(`/tenants/${id}`),

  updateStatus: (id: string, status: TenantStatus) =>
    request<Tenant>(`/tenants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

// ---- Stats ----
export const statsApi = {
  overview: () => request<StatsOverview>('/stats'),
}

// ---- Types ----
export type AdminUser = {
  id: string
  email: string
  fullName: string
  totpEnabled: boolean
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export type TenantStatus =
  | 'trial'
  | 'trial_expired'
  | 'active'
  | 'suspended'
  | 'blocked'
  | 'deleted'

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  trialEndsAt: string | null
  createdAt: string
  userCount: number
}

export type StatsOverview = {
  tenants: { total: number; active: number; trial: number }
  users: { total: number }
  printers: { total: number }
}
