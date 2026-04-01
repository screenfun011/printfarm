import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, type CreateJob } from '@/lib/api-client'

export const JOBS_KEY = ['jobs'] as const

export function useJobs() {
  return useQuery({ queryKey: JOBS_KEY, queryFn: jobsApi.list })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateJob) => jobsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

export function useCancelJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

export function usePauseJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.pause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

export function useResumeJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.resume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

export function useRemoveJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}
