import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAiService, AiServiceError } from '../service'
import type { Database } from '@printfarm/db'

const TENANT_ID    = '550e8400-e29b-41d4-a716-446655440000'
const DETECTION_ID = '550e8400-e29b-41d4-a716-446655440001'
const PRINTER_ID   = '550e8400-e29b-41d4-a716-446655440002'

const mockDetection = {
  id: DETECTION_ID,
  tenantId: TENANT_ID,
  printerId: PRINTER_ID,
  jobAssignmentId: null,
  detectionType: 'spaghetti' as const,
  confidence: '0.9500',
  snapshotPath: null,
  actionTaken: 'none' as const,
  resolvedAt: null,
  createdAt: new Date('2024-01-01'),
}

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0

  function queryChain() {
    const results = queryResults[callIndex++] ?? []
    const chain: Record<string, unknown> = {}
    const methods = [
      'select', 'update',
      'from', 'where', 'limit', 'orderBy', 'set', 'returning',
    ]
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain['returning'] = vi.fn().mockResolvedValue(results)
    chain['then'] = vi.fn().mockImplementation(
      (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(results)),
    )
    return chain
  }

  const db = {
    select: vi.fn().mockImplementation(queryChain),
    update: vi.fn().mockImplementation(queryChain),
  }

  return db as unknown as Database
}

beforeEach(() => vi.clearAllMocks())

describe('aiService.list', () => {
  it('vraća listu detekcija za tenant', async () => {
    const db = makeDb([[mockDetection]])
    const service = createAiService({ db })
    const result = await service.list(TENANT_ID)
    expect(Array.isArray(result)).toBe(true)
    expect(db.select).toHaveBeenCalled()
  })

  it('vraća praznu listu ako nema detekcija', async () => {
    const db = makeDb([[]])
    const service = createAiService({ db })
    const result = await service.list(TENANT_ID)
    expect(result).toHaveLength(0)
  })

  it('parsira confidence iz stringa u broj', async () => {
    const db = makeDb([[mockDetection]])
    const service = createAiService({ db })
    const result = await service.list(TENANT_ID)
    expect(typeof result[0]?.confidence).toBe('number')
    expect(result[0]?.confidence).toBeCloseTo(0.95)
  })
})

describe('aiService.takeAction', () => {
  it('pause — postavlja actionTaken na paused i resolvedAt', async () => {
    const db = makeDb([[mockDetection], []])
    const service = createAiService({ db })
    await service.takeAction(TENANT_ID, DETECTION_ID, 'pause')
    expect(db.update).toHaveBeenCalled()
  })

  it('cancel — postavlja actionTaken na canceled', async () => {
    const db = makeDb([[mockDetection], []])
    const service = createAiService({ db })
    await service.takeAction(TENANT_ID, DETECTION_ID, 'cancel')
    expect(db.update).toHaveBeenCalled()
  })

  it('skip_object — postavlja actionTaken na skip_object', async () => {
    const db = makeDb([[mockDetection], []])
    const service = createAiService({ db })
    await service.takeAction(TENANT_ID, DETECTION_ID, 'skip_object')
    expect(db.update).toHaveBeenCalled()
  })

  it('dismiss — postavlja actionTaken na notified', async () => {
    const db = makeDb([[mockDetection], []])
    const service = createAiService({ db })
    await service.takeAction(TENANT_ID, DETECTION_ID, 'dismiss')
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 404 ako detekcija ne postoji', async () => {
    const db = makeDb([[]])
    const service = createAiService({ db })
    await expect(service.takeAction(TENANT_ID, DETECTION_ID, 'dismiss'))
      .rejects.toMatchObject({ status: 404 })
  })

  it('baca 409 ako je akcija već preduzeta', async () => {
    const db = makeDb([[{ ...mockDetection, actionTaken: 'paused', resolvedAt: new Date() }]])
    const service = createAiService({ db })
    await expect(service.takeAction(TENANT_ID, DETECTION_ID, 'pause'))
      .rejects.toMatchObject({ code: 'DETECTION_ALREADY_RESOLVED', status: 409 })
  })
})

describe('AiServiceError', () => {
  it('ima code, message, status i name', () => {
    const err = new AiServiceError('TEST', 'poruka', 422)
    expect(err.code).toBe('TEST')
    expect(err.message).toBe('poruka')
    expect(err.status).toBe(422)
    expect(err.name).toBe('AiServiceError')
    expect(err instanceof Error).toBe(true)
  })

  it('default status je 400', () => {
    const err = new AiServiceError('CODE', 'msg')
    expect(err.status).toBe(400)
  })
})
