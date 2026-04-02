import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBridgeService } from '../service'

// ---------------------------------------------------------------------------
// DB mock factory
// ---------------------------------------------------------------------------

const mockPrinter = {
  id: 'printer-uuid-1',
  tenantId: 'tenant-uuid-1',
  serialNumber: 'BBA123456789',
  status: 'idle' as const,
  lastSeenAt: new Date(),
}

/**
 * Builds a DB mock that supports two patterns:
 *   select().from().where().limit(1) → Promise<row[]>    (select)
 *   update().set().where()           → Promise<void>     (update)
 */
function makeDb(selectResults: unknown[][] = [], updateResult: unknown[] = []) {
  let selectCallIndex = 0

  const limitFn = vi.fn().mockImplementation(() => {
    const r = selectResults[selectCallIndex] ?? []
    selectCallIndex++
    return Promise.resolve(r)
  })

  const whereFn = vi.fn().mockReturnValue({ limit: limitFn })

  const db = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: whereFn,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  } as any

  // update().set().where() → resolves immediately
  db.update.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(updateResult),
    }),
  }))

  return db
}

// ---------------------------------------------------------------------------
// reportStatus
// ---------------------------------------------------------------------------

describe('createBridgeService.reportStatus', () => {
  it('updates printer status and lastSeenAt', async () => {
    const db = makeDb([[mockPrinter]])
    const svc = createBridgeService({ db })

    await svc.reportStatus('printer-uuid-1', {
      state: 'printing',
      progress: 50,
      remainingMinutes: 30,
      layerCurrent: 10,
      layerTotal: 100,
      nozzleTemp: 220.5,
      nozzleTarget: 220.0,
      bedTemp: 60.0,
      bedTarget: 60.0,
      subtaskName: 'cube.3mf',
    })

    expect(db.update).toHaveBeenCalled()
  })

  it('throws NOT_FOUND if printer does not exist', async () => {
    const db = makeDb([[]])  // empty result for lookup
    const svc = createBridgeService({ db })

    await expect(
      svc.reportStatus('nonexistent', {
        state: 'idle',
        progress: 0,
        remainingMinutes: 0,
        layerCurrent: 0,
        layerTotal: 0,
        nozzleTemp: 0,
        nozzleTarget: 0,
        bedTemp: 0,
        bedTarget: 0,
        subtaskName: '',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('maps "printing" state to "printing" printer status', async () => {
    let capturedSet: any = null
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([mockPrinter]),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: any) => {
          capturedSet = data
          return { where: vi.fn().mockResolvedValue([]) }
        }),
      }),
    } as any

    const svc = createBridgeService({ db })

    await svc.reportStatus('printer-uuid-1', {
      state: 'printing',
      progress: 75,
      remainingMinutes: 15,
      layerCurrent: 50,
      layerTotal: 100,
      nozzleTemp: 220.0,
      nozzleTarget: 220.0,
      bedTemp: 60.0,
      bedTarget: 60.0,
      subtaskName: 'test.3mf',
    })

    expect(capturedSet?.status).toBe('printing')
  })

  it('maps "completed" state to "idle" printer status', async () => {
    let capturedSet: any = null
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([mockPrinter]),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data: any) => {
          capturedSet = data
          return { where: vi.fn().mockResolvedValue([]) }
        }),
      }),
    } as any

    const svc = createBridgeService({ db })

    await svc.reportStatus('printer-uuid-1', {
      state: 'completed',
      progress: 100,
      remainingMinutes: 0,
      layerCurrent: 100,
      layerTotal: 100,
      nozzleTemp: 25.0,
      nozzleTarget: 0.0,
      bedTemp: 25.0,
      bedTarget: 0.0,
      subtaskName: 'done.3mf',
    })

    expect(capturedSet?.status).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// getActivePrinters
// ---------------------------------------------------------------------------

describe('createBridgeService.getActivePrinters', () => {
  it('returns list of active printers for bridge polling', async () => {
    const printer2 = { ...mockPrinter, id: 'printer-uuid-2' }
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockPrinter, printer2]),
    } as any

    const svc = createBridgeService({ db })
    const result = await svc.getActivePrinters()
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no printers active', async () => {
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as any

    const svc = createBridgeService({ db })
    const result = await svc.getActivePrinters()
    expect(result).toHaveLength(0)
  })
})
