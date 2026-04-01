import { renderHook, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { useAiDetections, useTakeAction } from '../hooks'

jest.mock('@/lib/api-client', () => ({
  aiApi: {
    listDetections: jest.fn().mockResolvedValue([
      { id: '1', printerId: 'p1', jobAssignmentId: null, detectionType: 'spaghetti', confidence: 0.92, snapshotPath: null, actionTaken: 'none', resolvedAt: null, createdAt: '2024-01-01' },
    ]),
    takeAction: jest.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => jest.clearAllMocks())

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
    const { aiApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useTakeAction(), { wrapper: createWrapper() })

    result.current.mutate({ id: '1', action: 'pause' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(aiApi.takeAction).toHaveBeenCalledWith('1', 'pause')
  })
})
