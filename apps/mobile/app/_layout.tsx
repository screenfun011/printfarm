import { useEffect, useState } from 'react'
import { Stack, router } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { authStore } from '@/lib/auth-store'

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(authStore.isAuthenticated())

  useEffect(() => {
    return authStore.subscribe(() => {
      setIsAuthenticated(authStore.isAuthenticated())
    })
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/')
    } else {
      router.replace('/(auth)/login')
    }
  }, [isAuthenticated])

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
