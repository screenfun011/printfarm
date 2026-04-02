import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authStore } from '../lib/auth-store.js'

function Root() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authStore.loadMe().finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-gray-400">Učitavanje...</div>
      </div>
    )
  }

  return <Outlet />
}

export const Route = createRootRoute({ component: Root })
