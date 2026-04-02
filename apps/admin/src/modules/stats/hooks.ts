import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../../lib/api-client.js'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.overview(),
    staleTime: 60_000,
  })
}
