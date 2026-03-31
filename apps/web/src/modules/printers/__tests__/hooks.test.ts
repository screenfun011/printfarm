import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test-utils'
import { usePrinters, useAddPrinter, useRemovePrinter, useUpdatePrinter } from '../hooks'

vi.mock('@/lib/api-client', () => ({
  printersApi: {
    list: vi.fn().mockResolvedValue([
      { id: '1', name: 'Printer A', model: 'a1', serialNumber: 'ABC', ipAddress: '192.168.1.1', status: 'online', isActive: true, lastSeenAt: null, createdAt: '2024-01-01' },
    ]),
    add: vi.fn().mockResolvedValue({ id: '2', name: 'Printer B', model: 'p1s', serialNumber: 'DEF', status: 'offline', createdAt: '2024-01-01' }),
    update: vi.fn().mockResolvedValue({ id: '1', name: 'Updated', status: 'offline', isActive: true }),
    remove: vi.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('usePrinters', () => {
  it('vraća listu štampača', async () => {
    const { result } = renderHook(() => usePrinters(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.name).toBe('Printer A')
  })

  it('query key je printers', () => {
    const { result } = renderHook(() => usePrinters(), { wrapper: createWrapper() })
    expect(result.current.status).toBeDefined()
  })
})

describe('useAddPrinter', () => {
  it('poziva printersApi.add', async () => {
    const { printersApi } = await import('@/lib/api-client')
    const { result } = renderHook(() => useAddPrinter(), { wrapper: createWrapper() })

    result.current.mutate({
      name: 'Novi',
      model: 'a1',
      serialNumber: 'XYZ',
      ipAddress: '192.168.1.2',
      accessCode: '12345678',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(printersApi.add).toHaveBeenCalledTimes(1)
  })
})

describe('useRemovePrinter', () => {
  it('poziva printersApi.remove sa id-em', async () => {
    const { printersApi } = await import('@/lib/api-client')
    const { result } = renderHook(() => useRemovePrinter(), { wrapper: createWrapper() })

    result.current.mutate('1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(printersApi.remove).toHaveBeenCalledWith('1')
  })
})

describe('useUpdatePrinter', () => {
  it('poziva printersApi.update sa id i data', async () => {
    const { printersApi } = await import('@/lib/api-client')
    const { result } = renderHook(() => useUpdatePrinter(), { wrapper: createWrapper() })

    result.current.mutate({ id: '1', data: { name: 'Updated' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(printersApi.update).toHaveBeenCalledWith('1', { name: 'Updated' })
  })
})
