import { describe, it, expect, vi } from 'vitest'
import { createStatsService } from '../service.js'
import type { Database } from '../../../lib/db.js'

describe('createStatsService — overview', () => {
  it('vraća statistike platforme', async () => {
    let callIndex = 0
    const queryResults = [
      [{ value: 10 }], // total tenants
      [{ value: 3 }],  // active tenants
      [{ value: 2 }],  // trial tenants
      [{ value: 25 }], // total users
      [{ value: 8 }],  // total printers
    ]

    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        return Promise.resolve(queryResults[callIndex++] ?? [])
      }),
    } as unknown as Database

    const service = createStatsService({ db })
    const result = await service.overview()

    expect(result.tenants.total).toBe(10)
    expect(result.tenants.active).toBe(3)
    expect(result.tenants.trial).toBe(2)
    expect(result.users.total).toBe(25)
    expect(result.printers.total).toBe(8)
  })
})
