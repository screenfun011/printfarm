import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { printersApi, type AddPrinter, type UpdatePrinter } from '@/lib/api-client'

export const PRINTERS_KEY = ['printers'] as const

export function usePrinters() {
  return useQuery({ queryKey: PRINTERS_KEY, queryFn: printersApi.list })
}

export function useAddPrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddPrinter) => printersApi.add(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRINTERS_KEY }),
  })
}

export function useUpdatePrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePrinter }) => printersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRINTERS_KEY }),
  })
}

export function useRemovePrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => printersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRINTERS_KEY }),
  })
}
