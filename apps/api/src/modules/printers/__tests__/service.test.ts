import { describe, it, expect, vi } from 'vitest'
import { createPrinterService, PrinterServiceError } from '../service'
import type { Database } from '@printfarm/db'

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'
const PRINTER_ID = '550e8400-e29b-41d4-a716-446655440001'

const mockPrinter = {
  id: PRINTER_ID,
  name: 'Printer Test',
  model: 'a1' as const,
  serialNumber: 'ABC123',
  ipAddress: '192.168.1.100',
  status: 'offline' as const,
  isActive: true,
  lastSeenAt: null,
  createdAt: new Date(),
}

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0

  function queryChain() {
    const results = queryResults[callIndex++] ?? []
    const chain: Record<string, unknown> = {}
    const methods = ['select', 'insert', 'update', 'from', 'where', 'innerJoin',
      'limit', 'orderBy', 'set', 'values', 'returning']
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
  }

  return db as unknown as Database
}

describe('printerService', () => {
  describe('list', () => {
    it('vraća listu printera za tenant', async () => {
      const db = makeDb([[mockPrinter]])
      const service = createPrinterService({ db })
      const result = await service.list(TENANT_ID)
      expect(db.select).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })

    it('vraća praznu listu ako nema printera', async () => {
      const db = makeDb([[]])
      const service = createPrinterService({ db })
      const result = await service.list(TENANT_ID)
      expect(result).toHaveLength(0)
    })
  })

  describe('getById', () => {
    it('vraća printer ako postoji', async () => {
      const db = makeDb([[mockPrinter]])
      const service = createPrinterService({ db })
      const result = await service.getById(TENANT_ID, PRINTER_ID)
      expect(result.id).toBe(PRINTER_ID)
    })

    it('baca PrinterServiceError sa statusom 404 ako ne postoji', async () => {
      const db = makeDb([[]])
      const service = createPrinterService({ db })
      await expect(service.getById(TENANT_ID, PRINTER_ID))
        .rejects.toMatchObject({ name: 'PrinterServiceError', status: 404 })
    })
  })

  describe('add', () => {
    const addData = {
      name: 'Novi Printer',
      model: 'a1' as const,
      serialNumber: 'NEW123',
      ipAddress: '192.168.1.101',
      accessCode: '12345678',
    }

    it('baca 403 kada je dostignut limit printera', async () => {
      const db = makeDb([[{ count: 3 }], [{ maxPrintersOverride: 3 }]])
      const service = createPrinterService({ db })
      await expect(service.add(TENANT_ID, addData)).rejects.toMatchObject({ status: 403 })
    })

    it('baca 409 kada serial broj već postoji', async () => {
      const db = makeDb([[{ count: 1 }], [{ maxPrintersOverride: 10 }], [{ id: PRINTER_ID }]])
      const service = createPrinterService({ db })
      await expect(service.add(TENANT_ID, addData)).rejects.toMatchObject({ status: 409 })
    })

    it('koristi default limit ako nema override u bazi', async () => {
      const db = makeDb([[{ count: 99 }], []])
      const service = createPrinterService({ db })
      await expect(service.add(TENANT_ID, addData)).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('remove', () => {
    it('poziva update (soft delete) na bazi', async () => {
      const db = makeDb([[mockPrinter], []])
      const service = createPrinterService({ db })
      await service.remove(TENANT_ID, PRINTER_ID)
      expect(db.update).toHaveBeenCalled()
    })

    it('baca 404 ako printer ne postoji', async () => {
      const db = makeDb([[]])
      const service = createPrinterService({ db })
      await expect(service.remove(TENANT_ID, PRINTER_ID)).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('PrinterServiceError', () => {
    it('ima code, message, status i name', () => {
      const err = new PrinterServiceError('TEST_CODE', 'Test poruka', 422)
      expect(err.code).toBe('TEST_CODE')
      expect(err.message).toBe('Test poruka')
      expect(err.status).toBe(422)
      expect(err.name).toBe('PrinterServiceError')
      expect(err instanceof Error).toBe(true)
    })

    it('default status je 400', () => {
      const err = new PrinterServiceError('CODE', 'msg')
      expect(err.status).toBe(400)
    })
  })
})

describe('update (additional)', () => {
  it('uspešno ažurira ime printera', async () => {
    const updated = { id: PRINTER_ID, name: 'Novo Ime', status: 'offline' as const, isActive: true }
    const db = makeDb([[mockPrinter], [updated]])
    const service = createPrinterService({ db })
    const result = await service.update(TENANT_ID, PRINTER_ID, { name: 'Novo Ime' })
    expect(db.update).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('baca 404 ako printer ne postoji pri update-u', async () => {
    const db = makeDb([[]])
    const service = createPrinterService({ db })
    await expect(service.update(TENANT_ID, PRINTER_ID, { name: 'X' }))
      .rejects.toMatchObject({ status: 404 })
  })
})

describe('add happy path', () => {
  it('uspešno dodaje printer kada su uslovi ispunjeni', async () => {
    const db = makeDb([[{ count: 1 }], [{ maxPrintersOverride: 10 }], [], [mockPrinter]])
    const service = createPrinterService({ db })
    const result = await service.add(TENANT_ID, {
      name: 'Novi Printer',
      model: 'a1' as const,
      serialNumber: 'NEW123',
      ipAddress: '192.168.1.101',
      accessCode: '12345678',
    })
    expect(result).toBeDefined()
    expect(db.insert).toHaveBeenCalled()
  })
})
