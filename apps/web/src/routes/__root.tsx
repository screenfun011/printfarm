import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { authStore } from '@/lib/auth-store'
import { authApi } from '@/lib/api-client'

type RouterContext = {
  auth: typeof authStore
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const { auth } = context
    const publicPaths = ['/auth/login', '/auth/register']
    const isPublic = publicPaths.some(p => location.pathname.startsWith(p))

    if (!auth.isAuthenticated()) {
      if (!isPublic) {
        throw redirect({ to: '/auth/login', search: { redirect: location.href } })
      }
      return
    }

    // Hydrate user if token exists but user not loaded
    if (!auth.getState().user) {
      try {
        const user = await authApi.me()
        auth.setUser(user)
      } catch {
        auth.clearAuth()
        if (!isPublic) {
          throw redirect({ to: '/auth/login' })
        }
      }
    }
  },
  component: () => <Outlet />,
})
