import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi } from '@/lib/api-client'

export const FILES_KEY = ['files'] as const

export function useFiles() {
  return useQuery({ queryKey: FILES_KEY, queryFn: filesApi.list })
}

export function useUploadFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => filesApi.upload(formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: FILES_KEY }),
  })
}

export function useRemoveFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => filesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FILES_KEY }),
  })
}
