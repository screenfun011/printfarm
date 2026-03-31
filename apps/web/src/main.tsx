import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/query-client'
import { authStore } from './lib/auth-store'
import './app.css'

const router = createRouter({
  routeTree,
  context: {
    auth: authStore,
    queryClient,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth: authStore, queryClient }} />
    </QueryClientProvider>
  </StrictMode>,
)
