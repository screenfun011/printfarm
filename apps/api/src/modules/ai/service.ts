import { eq, and } from 'drizzle-orm'
import { aiDetections, type Database } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'

export class AiServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'AiServiceError'
  }
}

// Maps user-facing action to DB enum value
const ACTION_MAP = {
  pause:       'paused',
  cancel:      'canceled',
  skip_object: 'skip_object',
  dismiss:     'notified',
} as const

type UserAction = keyof typeof ACTION_MAP
type AiServiceDeps = { db: Database }

export function createAiService({ db }: AiServiceDeps) {
  async function findDetection(tenantId: string, detectionId: string) {
    const detection = await db
      .select({
        id: aiDetections.id,
        tenantId: aiDetections.tenantId,
        printerId: aiDetections.printerId,
        jobAssignmentId: aiDetections.jobAssignmentId,
        detectionType: aiDetections.detectionType,
        confidence: aiDetections.confidence,
        snapshotPath: aiDetections.snapshotPath,
        actionTaken: aiDetections.actionTaken,
        resolvedAt: aiDetections.resolvedAt,
        createdAt: aiDetections.createdAt,
      })
      .from(aiDetections)
      .where(and(
        eq(aiDetections.tenantId, tenantId),
        eq(aiDetections.id, detectionId),
      ))
      .limit(1)
      .then(rows => rows[0] ?? null)

    if (!detection) {
      throw new AiServiceError(API_ERROR_CODES.NOT_FOUND, 'Detekcija nije pronađena', 404)
    }

    return detection
  }

  function parseDetection<T extends { confidence: string | number }>(d: T) {
    return { ...d, confidence: parseFloat(String(d.confidence)) }
  }

  return {
    async list(tenantId: string) {
      const rows = await db
        .select({
          id: aiDetections.id,
          printerId: aiDetections.printerId,
          jobAssignmentId: aiDetections.jobAssignmentId,
          detectionType: aiDetections.detectionType,
          confidence: aiDetections.confidence,
          snapshotPath: aiDetections.snapshotPath,
          actionTaken: aiDetections.actionTaken,
          resolvedAt: aiDetections.resolvedAt,
          createdAt: aiDetections.createdAt,
        })
        .from(aiDetections)
        .where(eq(aiDetections.tenantId, tenantId))
        .orderBy(aiDetections.createdAt)

      return rows.map(parseDetection)
    },

    async takeAction(tenantId: string, detectionId: string, action: UserAction) {
      const detection = await findDetection(tenantId, detectionId)

      if (detection.actionTaken !== 'none') {
        throw new AiServiceError(
          'DETECTION_ALREADY_RESOLVED',
          'Akcija je već preduzeta za ovu detekciju',
          409,
        )
      }

      await db
        .update(aiDetections)
        .set({
          actionTaken: ACTION_MAP[action],
          resolvedAt: new Date(),
        })
        .where(and(
          eq(aiDetections.tenantId, tenantId),
          eq(aiDetections.id, detectionId),
        ))
    },
  }
}

export type AiService = ReturnType<typeof createAiService>
