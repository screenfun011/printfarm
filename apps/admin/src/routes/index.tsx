import { createFileRoute, Navigate } from '@tanstack/react-router'
import { authStore } from '../lib/auth-store.js'

function IndexPage() {
  if (authStore.isAuthenticated()) {
    return <Navigate to="/dashboard" />
  }
  return <Navigate to="/auth/login" />
}

export const Route = createFileRoute('/')({ component: IndexPage })
