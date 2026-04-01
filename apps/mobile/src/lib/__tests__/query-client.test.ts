import { queryClient } from '../query-client'
import { ApiError } from '../api-client'

describe('ApiError', () => {
  it('kreira grešku sa code, message, status', () => {
    const err = new ApiError('NOT_FOUND', 'nije pronađeno', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('nije pronađeno')
    expect(err.status).toBe(404)
    expect(err.name).toBe('ApiError')
    expect(err instanceof Error).toBe(true)
  })
})

describe('queryClient', () => {
  it('ima staleTime od 30s', () => {
    const opts = queryClient.getDefaultOptions()
    expect(opts.queries?.staleTime).toBe(30_000)
  })
})
