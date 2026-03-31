import { eq, and, count } from 'drizzle-orm'
import { printers, tenantFeatures, type Database } from '@printfarm/db'
import { type AddPrinter, type UpdatePrinter } from '@printfarm/shared/schemas/printer'
import { PLAN_LIMITS } from '@printfarm/shared/constants'
import { API_ERROR_CODES } from '@printfarm/shared/types'

export class PrinterServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'PrinterServiceError'
  }
}

type PrinterServiceDeps = {
  db: Database
}

export function createPrinterService({ db }: PrinterServiceDeps) {
  async function getMaxPrinters(tenantId: string): Promise<number> {
    const features = await db
      .select({ maxPrintersOverride: tenantFeatures.maxPrintersOverride })
      .from(tenantFeatures)
      .where(eq(tenantFeatures.tenantId, tenantId))
      .limit(1)
      .then(rows => rows[0] ?? null)

    return features?.maxPrintersOverride ?? PLAN_LIMITS.starter.maxPrinters
  }

  async function countActive(tenantId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(printers)
      .where(and(
        eq(printers.tenantId, tenantId),
        eq(printers.isActive, true),
      ))
      .then(rows => rows[0])

    return result?.count ?? 0
  }

  return {
    async list(tenantId: string) {
      return db
        .select({
          id: printers.id,
          name: printers.name,
          model: printers.model,
          serialNumber: printers.serialNumber,
          ipAddress: printers.ipAddress,
          status: printers.status,
          isActive: printers.isActive,
          lastSeenAt: printers.lastSeenAt,
          createdAt: printers.createdAt,
        })
        .from(printers)
        .where(and(
          eq(printers.tenantId, tenantId),
          eq(printers.isActive, true),
        ))
        .orderBy(printers.createdAt)
    },

    async getById(tenantId: string, printerId: string) {
      const printer = await db
        .select({
          id: printers.id,
          name: printers.name,
          model: printers.model,
          serialNumber: printers.serialNumber,
          ipAddress: printers.ipAddress,
          status: printers.status,
          isActive: printers.isActive,
          lastSeenAt: printers.lastSeenAt,
          createdAt: printers.createdAt,
        })
        .from(printers)
        .where(and(
          eq(printers.tenantId, tenantId),
          eq(printers.id, printerId),
        ))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!printer) {
        throw new PrinterServiceError(
          API_ERROR_CODES.NOT_FOUND,
          'Printer nije pronađen',
          404,
        )
      }

      return printer
    },

    async add(tenantId: string, data: AddPrinter) {
      const [activeCount, maxPrinters] = await Promise.all([
        countActive(tenantId),
        getMaxPrinters(tenantId),
      ])

      if (activeCount >= maxPrinters) {
        throw new PrinterServiceError(
          API_ERROR_CODES.PRINTER_LIMIT_REACHED,
          `Dostignut limit od ${maxPrinters} printera za vaš plan`,
          403,
        )
      }

      const existing = await db
        .select({ id: printers.id })
        .from(printers)
        .where(and(
          eq(printers.tenantId, tenantId),
          eq(printers.serialNumber, data.serialNumber),
        ))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (existing) {
        throw new PrinterServiceError(
          'PRINTER_SERIAL_EXISTS',
          'Printer sa ovim serijskim brojem već postoji u vašem nalogu',
          409,
        )
      }

      const [printer] = await db
        .insert(printers)
        .values({
          tenantId,
          name: data.name,
          model: data.model,
          serialNumber: data.serialNumber,
          ipAddress: data.ipAddress,
          accessCode: data.accessCode,
        })
        .returning({
          id: printers.id,
          name: printers.name,
          model: printers.model,
          serialNumber: printers.serialNumber,
          status: printers.status,
          createdAt: printers.createdAt,
        })

      return printer
    },

    async update(tenantId: string, printerId: string, data: UpdatePrinter) {
      await this.getById(tenantId, printerId)

      const updateValues: Record<string, unknown> = { updatedAt: new Date() }
      if (data.name !== undefined) updateValues['name'] = data.name
      if (data.isActive !== undefined) updateValues['isActive'] = data.isActive

      const [updated] = await db
        .update(printers)
        .set(updateValues as Parameters<ReturnType<typeof db.update>['set']>[0])
        .where(and(
          eq(printers.tenantId, tenantId),
          eq(printers.id, printerId),
        ))
        .returning({
          id: printers.id,
          name: printers.name,
          status: printers.status,
          isActive: printers.isActive,
        })

      return updated
    },

    async remove(tenantId: string, printerId: string) {
      await this.getById(tenantId, printerId)

      await db
        .update(printers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
          eq(printers.tenantId, tenantId),
          eq(printers.id, printerId),
        ))
    },
  }
}

export type PrinterService = ReturnType<typeof createPrinterService>
