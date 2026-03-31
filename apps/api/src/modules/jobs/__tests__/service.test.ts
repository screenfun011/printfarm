import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createJobService, JobServiceError } from '../service'
import type { Database } from '@printfarm/db'

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'
const USER_ID   = '550e8400-e29b-41d4-a716-446655440001'
const JOB_ID    = '550e8400-e29b-41d4-a716-446655440002'
const FILE_ID   = '550e8400-e29b-41d4-a716-446655440003'
const PRINTER_1 = '550e8400-e29b-41d4-a716-446655440004'
const PRINTER_2 = '550e8400-e29b-41d4-a716-446655440005'

const mockFile = {
  id: FILE_ID,
  tenantId: TENANT_ID,
  name: 'test.3mf',
  isDeleted: false,
}

const mockPrinter = (id: string) => ({
  id,
  tenantId: TENANT_ID,
  isActive: true,
})

const mockJob = {
  id: JOB_ID,
  tenantId: TENANT_ID,
  fileId: FILE_ID,
  createdBy: USER_ID,
  name: 'Test Job',
  status: 'queued' as const,
  priority: 0,
  copies: 1,
  copiesCompleted: 0,
  notes: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date('2024-01-01'),
}

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0

  function queryChain() {
    const results = queryResults[callIndex++] ?? []
    const chain: Record<string, unknown> = {}
    const methods = [
      'select', 'insert', 'update', 'delete',
      'from', 'where', 'innerJoin', 'leftJoin',
      'limit', 'orderBy', 'set', 'values', 'returning',
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
    insert: vi.fn().mockImplementation(queryChain),
    update: vi.fn().mockImplementation(queryChain),
    delete: vi.fn().mockImplementation(queryChain),
  }

  return db as unknown as Database
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('jobService.list', () => {
  it('vraća listu jobova za tenant', async () => {
    const db = makeDb([[mockJob]])
    const service = createJobService({ db })
    const result = await service.list(TENANT_ID)
    expect(db.select).toHaveBeenCalled()
    expect(Array.isArray(result)).toBe(true)
  })

  it('vraća praznu listu ako nema jobova', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    const result = await service.list(TENANT_ID)
    expect(result).toHaveLength(0)
  })
})

describe('jobService.getById', () => {
  it('vraća job sa assignments', async () => {
    const db = makeDb([[mockJob], []])
    const service = createJobService({ db })
    const result = await service.getById(TENANT_ID, JOB_ID)
    expect(result.id).toBe(JOB_ID)
    expect(result.assignments).toBeDefined()
  })

  it('baca 404 ako job ne postoji', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    await expect(service.getById(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('jobService.create', () => {
  const createData = {
    fileId: FILE_ID,
    name: 'Test Job',
    printerIds: [PRINTER_1],
    copies: 1,
    priority: 0,
  }

  it('kreira job i assignments za jednog printera', async () => {
    const db = makeDb([
      [mockFile],          // file check
      [mockPrinter(PRINTER_1)],  // printers check
      [mockJob],           // insert job
      [],                  // insert assignments
    ])
    const service = createJobService({ db })
    const result = await service.create(TENANT_ID, USER_ID, createData)
    expect(result.id).toBe(JOB_ID)
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it('kreira assignments round-robin za više kopija i printera', async () => {
    const db = makeDb([
      [mockFile],
      [mockPrinter(PRINTER_1), mockPrinter(PRINTER_2)],
      [mockJob],
      [],
    ])
    const service = createJobService({ db })
    await service.create(TENANT_ID, USER_ID, { ...createData, printerIds: [PRINTER_1, PRINTER_2], copies: 3 })
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it('baca 404 ako fajl ne postoji ili je obrisan', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    await expect(service.create(TENANT_ID, USER_ID, createData)).rejects.toMatchObject({ status: 404 })
  })

  it('baca 404 ako printer ne postoji u tenantu', async () => {
    const db = makeDb([
      [mockFile],
      [],  // printers → prazno
    ])
    const service = createJobService({ db })
    await expect(service.create(TENANT_ID, USER_ID, createData)).rejects.toMatchObject({
      status: 404,
      code: 'PRINTER_NOT_FOUND',
    })
  })

  it('baca 422 ako neki od printerIds ne postoji', async () => {
    const db = makeDb([
      [mockFile],
      [mockPrinter(PRINTER_1)],  // samo 1 od 2 pronađena
    ])
    const service = createJobService({ db })
    await expect(
      service.create(TENANT_ID, USER_ID, { ...createData, printerIds: [PRINTER_1, PRINTER_2] }),
    ).rejects.toMatchObject({ status: 422, code: 'PRINTER_NOT_FOUND' })
  })
})

describe('jobService.cancel', () => {
  it('otkazuje job u queued statusu', async () => {
    const db = makeDb([[mockJob], []])
    const service = createJobService({ db })
    await service.cancel(TENANT_ID, JOB_ID)
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 404 ako job ne postoji', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    await expect(service.cancel(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('baca 409 ako job nije u otkazivom statusu', async () => {
    const db = makeDb([[{ ...mockJob, status: 'completed' }]])
    const service = createJobService({ db })
    await expect(service.cancel(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 409 })
  })
})

describe('jobService.pause', () => {
  it('pauzira job u printing statusu', async () => {
    const db = makeDb([[{ ...mockJob, status: 'printing' }], []])
    const service = createJobService({ db })
    await service.pause(TENANT_ID, JOB_ID)
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 409 ako job nije u printing statusu', async () => {
    const db = makeDb([[mockJob]])  // queued
    const service = createJobService({ db })
    await expect(service.pause(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 409 })
  })

  it('baca 404 ako job ne postoji', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    await expect(service.pause(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('jobService.resume', () => {
  it('nastavlja pauzirani job', async () => {
    const db = makeDb([[{ ...mockJob, status: 'paused' }], []])
    const service = createJobService({ db })
    await service.resume(TENANT_ID, JOB_ID)
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 409 ako job nije pauziran', async () => {
    const db = makeDb([[mockJob]])  // queued
    const service = createJobService({ db })
    await expect(service.resume(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 409 })
  })

  it('baca 404 ako job ne postoji', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    await expect(service.resume(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('jobService.remove', () => {
  it('briše završen job', async () => {
    const db = makeDb([[{ ...mockJob, status: 'completed' }], []])
    const service = createJobService({ db })
    await service.remove(TENANT_ID, JOB_ID)
    expect(db.delete).toHaveBeenCalled()
  })

  it('briše otkazani job', async () => {
    const db = makeDb([[{ ...mockJob, status: 'canceled' }], []])
    const service = createJobService({ db })
    await service.remove(TENANT_ID, JOB_ID)
    expect(db.delete).toHaveBeenCalled()
  })

  it('baca 409 ako je job aktivan', async () => {
    const db = makeDb([[{ ...mockJob, status: 'printing' }]])
    const service = createJobService({ db })
    await expect(service.remove(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 409 })
  })

  it('baca 404 ako job ne postoji', async () => {
    const db = makeDb([[]])
    const service = createJobService({ db })
    await expect(service.remove(TENANT_ID, JOB_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('JobServiceError', () => {
  it('ima code, message, status i name', () => {
    const err = new JobServiceError('TEST_CODE', 'Test poruka', 422)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('Test poruka')
    expect(err.status).toBe(422)
    expect(err.name).toBe('JobServiceError')
    expect(err instanceof Error).toBe(true)
  })

  it('default status je 400', () => {
    const err = new JobServiceError('CODE', 'msg')
    expect(err.status).toBe(400)
  })
})
