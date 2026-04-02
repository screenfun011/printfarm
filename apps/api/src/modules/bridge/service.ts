import { eq, and } from 'drizzle-orm'
import { printers, type Database } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'

export class BridgeServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'BridgeServiceError'
  }
}

// Mapping from Bridge state → printer DB status
const BRIDGE_STATE_TO_STATUS: Record<string, 'idle' | 'printing' | 'paused' | 'error'> = {
  idle: 'idle',
  printing: 'printing',
  paused: 'paused',
  completed: 'idle',   // after finish, printer goes back to idle
  failed: 'error',
}

export type BridgeStatusPayload = {
  state: string
  progress: number
  remainingMinutes: number
  layerCurrent: number
  layerTotal: number
  nozzleTemp: number
  nozzleTarget: number
  bedTemp: number
  bedTarget: number
  subtaskName: string
}

type BridgeServiceDeps = {
  db: Database
}

export function createBridgeService({ db }: BridgeServiceDeps) {
  return {
    async reportStatus(printerId: string, payload: BridgeStatusPayload): Promise<void> {
      const [printer] = await db
        .select({ id: printers.id, tenantId: printers.tenantId })
        .from(printers)
        .where(eq(printers.id, printerId))
        .limit(1)

      if (!printer) {
        throw new BridgeServiceError(
          API_ERROR_CODES.NOT_FOUND,
          'Printer nije pronađen',
          404,
        )
      }

      const status = BRIDGE_STATE_TO_STATUS[payload.state] ?? 'idle'

      await db
        .update(printers)
        .set({
          status,
          lastSeenAt: new Date(),
        })
        .where(eq(printers.id, printerId))
    },

    async getActivePrinters() {
      return db
        .select({
          id: printers.id,
          serialNumber: printers.serialNumber,
          ipAddress: printers.ipAddress,
          accessCode: printers.accessCode,
          tenantId: printers.tenantId,
        })
        .from(printers)
        .where(eq(printers.isActive, true))
    },
  }
}
