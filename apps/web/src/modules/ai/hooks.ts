import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '@/lib/api-client'

export const AI_DETECTIONS_KEY = ['ai-detections'] as const

export function useAiDetections() {
  return useQuery({
    queryKey: AI_DETECTIONS_KEY,
    queryFn: aiApi.listDetections,
    refetchInterval: 10_000,
  })
}

export function useTakeAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'cancel' | 'skip_object' | 'dismiss' }) =>
      aiApi.takeAction(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_DETECTIONS_KEY }),
  })
}
