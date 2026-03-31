import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test-utils'
import { useAiDetections, useTakeAction } from '../hooks'

vi.mock('@/lib/api-client', () => ({
  aiApi: {
    listDetections: vi.fn().mockResolvedValue([
      { id: '1', printerId: 'p1', jobAssignmentId: null, detectionType: 'spaghetti', confidence: 0.95, snapshotPath: null, actionTaken: 'none', resolvedAt: null, createdAt: '2024-01-01' },
    ]),
    takeAction: vi.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('useAiDetections', () => {
  it('vraća listu detekcija', async () => {
    const { result } = renderHook(() => useAiDetections(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.detectionType).toBe('spaghetti')
  })
})

describe('useTakeAction', () => {
  it('poziva aiApi.takeAction sa id i action', async () => {
    const { aiApi } = await import('@/lib/api-client')
    const { result } = renderHook(() => useTakeAction(), { wrapper: createWrapper() })

    result.current.mutate({ id: '1', action: 'dismiss' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(aiApi.takeAction).toHaveBeenCalledWith('1', 'dismiss')
  })
})
