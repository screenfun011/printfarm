import { renderHook, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { useJobs, useCreateJob, useCancelJob, usePauseJob, useResumeJob, useRemoveJob } from '../hooks'

jest.mock('@/lib/api-client', () => ({
  jobsApi: {
    list: jest.fn().mockResolvedValue([
      { id: '1', name: 'Job A', status: 'queued', copies: 1, copiesCompleted: 0, priority: 0, fileId: 'f1', createdBy: 'u1', startedAt: null, completedAt: null, createdAt: '2024-01-01' },
    ]),
    create: jest.fn().mockResolvedValue({ id: '2', name: 'Job B', status: 'queued', createdAt: '2024-01-01' }),
    cancel: jest.fn().mockResolvedValue(null),
    pause: jest.fn().mockResolvedValue(null),
    resume: jest.fn().mockResolvedValue(null),
    remove: jest.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => jest.clearAllMocks())

describe('useJobs', () => {
  it('vraća listu jobova', async () => {
    const { result } = renderHook(() => useJobs(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.name).toBe('Job A')
  })
})

describe('useCreateJob', () => {
  it('poziva jobsApi.create', async () => {
    const { jobsApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useCreateJob(), { wrapper: createWrapper() })

    result.current.mutate({ fileId: 'f1', name: 'Job B', printerIds: ['p1'], copies: 1, priority: 0 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(jobsApi.create).toHaveBeenCalledTimes(1)
  })
})

describe('useCancelJob', () => {
  it('poziva jobsApi.cancel sa id-em', async () => {
    const { jobsApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useCancelJob(), { wrapper: createWrapper() })
    result.current.mutate('1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(jobsApi.cancel).toHaveBeenCalledWith('1')
  })
})

describe('usePauseJob', () => {
  it('poziva jobsApi.pause', async () => {
    const { jobsApi } = require('@/lib/api-client')
    const { result } = renderHook(() => usePauseJob(), { wrapper: createWrapper() })
    result.current.mutate('1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(jobsApi.pause).toHaveBeenCalledWith('1')
  })
})

describe('useResumeJob', () => {
  it('poziva jobsApi.resume', async () => {
    const { jobsApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useResumeJob(), { wrapper: createWrapper() })
    result.current.mutate('1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(jobsApi.resume).toHaveBeenCalledWith('1')
  })
})

describe('useRemoveJob', () => {
  it('poziva jobsApi.remove', async () => {
    const { jobsApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useRemoveJob(), { wrapper: createWrapper() })
    result.current.mutate('1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(jobsApi.remove).toHaveBeenCalledWith('1')
  })
})
