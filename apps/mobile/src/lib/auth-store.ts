import { tokenStorage, type SessionUser } from './api-client'

type AuthState = {
  user: SessionUser | null
  token: string | null
}

type Listener = () => void

let state: AuthState = {
  user: null,
  token: tokenStorage.get(),
}

const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(fn => fn())
}

export const authStore = {
  getState: () => state,

  setAuth: (token: string, user: SessionUser) => {
    tokenStorage.set(token)
    state = { token, user }
    notify()
  },

  setUser: (user: SessionUser) => {
    state = { ...state, user }
    notify()
  },

  clearAuth: () => {
    tokenStorage.clear()
    state = { token: null, user: null }
    notify()
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  isAuthenticated: () => !!state.token,
}
