import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

const mockUser = {
  id: 'u1',
  email: 'test@test.com',
  fullName: 'Test',
  avatarUrl: null,
  totpEnabled: false,
  role: 'owner' as const,
  tenantId: 't1',
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2024-01-01',
}

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('authStore', () => {
  it('setAuth čuva token i user, poziva localStorage', async () => {
    const { authStore } = await import('../auth-store')
    authStore.setAuth('tok123', mockUser)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('printfarm_token', 'tok123')
    expect(authStore.getState().user?.email).toBe('test@test.com')
    expect(authStore.isAuthenticated()).toBe(true)
  })

  it('clearAuth briše token iz localStorage i stanja', async () => {
    const { authStore } = await import('../auth-store')
    authStore.setAuth('tok123', mockUser)
    authStore.clearAuth()
    expect(localStorageMock.removeItem).toHaveBeenCalled()
    expect(authStore.getState().user).toBeNull()
    expect(authStore.isAuthenticated()).toBe(false)
  })

  it('setUser ažurira samo user bez promene tokena', async () => {
    const { authStore } = await import('../auth-store')
    authStore.setAuth('tok123', mockUser)
    authStore.setUser({ ...mockUser, fullName: 'Updated' })
    expect(authStore.getState().user?.fullName).toBe('Updated')
    expect(authStore.getState().token).toBe('tok123')
  })

  it('subscribe poziva listener na promeni stanja', async () => {
    const { authStore } = await import('../auth-store')
    const listener = vi.fn()
    const unsub = authStore.subscribe(listener)
    authStore.setAuth('tok', mockUser)
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    authStore.clearAuth()
    expect(listener).toHaveBeenCalledTimes(1) // ne poziva se posle unsub
  })
})

describe('ApiError', () => {
  it('kreira grešku sa code, message, status', async () => {
    const { ApiError } = await import('../query-client')
    const err = new ApiError('NOT_FOUND', 'nije pronađeno', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('nije pronađeno')
    expect(err.status).toBe(404)
    expect(err.name).toBe('ApiError')
    expect(err instanceof Error).toBe(true)
  })
})
