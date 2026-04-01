import * as SecureStore from 'expo-secure-store'
import { authStore } from '../auth-store'

jest.mock('expo-secure-store', () => ({
  getItem: jest.fn().mockReturnValue(null),
  setItem: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

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
  jest.clearAllMocks()
  authStore.clearAuth()
})

describe('authStore', () => {
  it('setAuth čuva token i user', () => {
    authStore.setAuth('tok123', mockUser)
    expect(SecureStore.setItem).toHaveBeenCalledWith('printfarm_token', 'tok123')
    expect(authStore.getState().user?.email).toBe('test@test.com')
    expect(authStore.isAuthenticated()).toBe(true)
  })

  it('clearAuth briše token i user', () => {
    authStore.setAuth('tok123', mockUser)
    authStore.clearAuth()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled()
    expect(authStore.getState().user).toBeNull()
    expect(authStore.isAuthenticated()).toBe(false)
  })

  it('setUser ažurira user bez promene tokena', () => {
    authStore.setAuth('tok123', mockUser)
    authStore.setUser({ ...mockUser, fullName: 'Updated' })
    expect(authStore.getState().user?.fullName).toBe('Updated')
    expect(authStore.getState().token).toBe('tok123')
  })

  it('subscribe poziva listener na promeni stanja', () => {
    const listener = jest.fn()
    const unsub = authStore.subscribe(listener)
    authStore.setAuth('tok', mockUser)
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    authStore.clearAuth()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('isAuthenticated vraća false kada nema tokena', () => {
    expect(authStore.isAuthenticated()).toBe(false)
  })
})
