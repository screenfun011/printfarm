import { renderHook, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { useFiles, useUploadFile, useRemoveFile } from '../hooks'

jest.mock('@/lib/api-client', () => ({
  filesApi: {
    list: jest.fn().mockResolvedValue([
      { id: '1', name: 'model.3mf', originalFilename: 'model.3mf', fileSizeBytes: 1024, fileHash: 'abc', thumbnailPath: null, metadata: null, uploadedBy: 'u1', createdAt: '2024-01-01' },
    ]),
    upload: jest.fn().mockResolvedValue({ id: '2', name: 'new.3mf', originalFilename: 'new.3mf', fileSizeBytes: 2048, fileHash: 'def', thumbnailPath: null, metadata: null, uploadedBy: 'u1', createdAt: '2024-01-01' }),
    remove: jest.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => jest.clearAllMocks())

describe('useFiles', () => {
  it('vraća listu fajlova', async () => {
    const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.name).toBe('model.3mf')
  })
})

describe('useUploadFile', () => {
  it('poziva filesApi.upload', async () => {
    const { filesApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useUploadFile(), { wrapper: createWrapper() })

    result.current.mutate(new FormData())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(filesApi.upload).toHaveBeenCalledTimes(1)
  })
})

describe('useRemoveFile', () => {
  it('poziva filesApi.remove sa id-em', async () => {
    const { filesApi } = require('@/lib/api-client')
    const { result } = renderHook(() => useRemoveFile(), { wrapper: createWrapper() })

    result.current.mutate('1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(filesApi.remove).toHaveBeenCalledWith('1')
  })
})
