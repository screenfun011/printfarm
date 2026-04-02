import { tokenStorage, authApi, type AdminUser } from './api-client.js'

type AuthState = {
  admin: AdminUser | null
  token: string | null
}

type Listener = () => void

let state: AuthState = {
  admin: null,
  token: tokenStorage.get(),
}

const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(fn => fn())
}

export const authStore = {
  getState: () => state,

  setAuth: (token: string, admin: AdminUser) => {
    tokenStorage.set(token)
    state = { token, admin }
    notify()
  },

  clearAuth: () => {
    tokenStorage.clear()
    state = { token: null, admin: null }
    notify()
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  isAuthenticated: () => !!state.token,

  async logout() {
    try {
      await authApi.logout()
    } catch {
      // token već nevažeći
    }
    authStore.clearAuth()
  },

  async loadMe(): Promise<boolean> {
    if (!state.token) return false
    try {
      const admin = await authApi.me()
      state = { ...state, admin }
      notify()
      return true
    } catch {
      authStore.clearAuth()
      return false
    }
  },
}
