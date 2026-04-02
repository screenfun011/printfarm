import { describe, it, expect, vi } from 'vitest'
import { createTenantsService, TenantsServiceError } from '../service.js'
import type { Database } from '../../../lib/db.js'

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440010'

const mockTenant = {
  id: TENANT_ID,
  name: 'Test Farm',
  slug: 'test-farm',
  status: 'trial' as const,
  trialEndsAt: new Date('2024-03-01'),
  createdAt: new Date('2024-01-01'),
  userCount: 1,
}

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex++] ?? []
      return Promise.resolve(result)
    }),
    offset: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex++] ?? []
      return Promise.resolve(result)
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex++] ?? []
      return Promise.resolve(result)
    }),
  }
  return chain as unknown as Database
}

describe('createTenantsService — list', () => {
  it('vraća listu tenanta', async () => {
    const db = makeDb([[mockTenant, mockTenant]])
    const service = createTenantsService({ db })
    const result = await service.list({})
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe(TENANT_ID)
  })

  it('vraća praznu listu ako nema tenanta', async () => {
    const db = makeDb([[]])
    const service = createTenantsService({ db })
    const result = await service.list({})
    expect(result).toHaveLength(0)
  })
})

describe('createTenantsService — getById', () => {
  it('vraća tenant sa detaljima', async () => {
    const db = makeDb([[mockTenant]])
    const service = createTenantsService({ db })
    const result = await service.getById(TENANT_ID)
    expect(result.id).toBe(TENANT_ID)
    expect(result.name).toBe('Test Farm')
  })

  it('baca 404 ako tenant ne postoji', async () => {
    const db = makeDb([[]])
    const service = createTenantsService({ db })
    await expect(service.getById(TENANT_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('createTenantsService — updateStatus', () => {
  it('ažurira status tenanta', async () => {
    const db = makeDb([[{ ...mockTenant, status: 'suspended' }]])
    const service = createTenantsService({ db })
    const result = await service.updateStatus(TENANT_ID, 'suspended')
    expect(result.status).toBe('suspended')
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 404 ako tenant ne postoji', async () => {
    const db = makeDb([[]])
    const service = createTenantsService({ db })
    await expect(service.updateStatus(TENANT_ID, 'active')).rejects.toMatchObject({ status: 404 })
  })
})

describe('TenantsServiceError', () => {
  it('ima code, message, status', () => {
    const err = new TenantsServiceError('NOT_FOUND', 'Tenant ne postoji', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.name).toBe('TenantsServiceError')
  })
})
