import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test-utils'
import { useFiles, useUploadFile, useRemoveFile } from '../hooks'

vi.mock('@/lib/api-client', () => ({
  filesApi: {
    list: vi.fn().mockResolvedValue([
      { id: '1', name: 'Benchy', originalFilename: 'benchy.3mf', fileSizeBytes: 1024000, fileHash: 'abc', thumbnailPath: null, metadata: null, uploadedBy: 'u1', createdAt: '2024-01-01' },
    ]),
    upload: vi.fn().mockResolvedValue({ id: '2', name: 'New', originalFilename: 'new.3mf', fileSizeBytes: 512000, fileHash: 'def', createdAt: '2024-01-01' }),
    remove: vi.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('useFiles', () => {
  it('vraća listu fajlova', async () => {
    const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.name).toBe('Benchy')
  })
})

describe('useUploadFile', () => {
  it('poziva filesApi.upload sa FormData', async () => {
    const { filesApi } = await import('@/lib/api-client')
    const { result } = renderHook(() => useUploadFile(), { wrapper: createWrapper() })

    const fd = new FormData()
    fd.append('name', 'Benchy')
    result.current.mutate(fd)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(filesApi.upload).toHaveBeenCalledWith(fd)
  })
})

describe('useRemoveFile', () => {
  it('poziva filesApi.remove sa id-em', async () => {
    const { filesApi } = await import('@/lib/api-client')
    const { result } = renderHook(() => useRemoveFile(), { wrapper: createWrapper() })
    result.current.mutate('1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(filesApi.remove).toHaveBeenCalledWith('1')
  })
})
