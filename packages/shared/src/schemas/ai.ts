import { z } from 'zod'

export const detectionTypeSchema = z.enum([
  'spaghetti',
  'detached',
  'layer_shift',
  'warping',
  'stringing',
  'unknown',
])

export const detectionActionSchema = z.enum([
  'none',
  'notified',
  'paused',
  'canceled',
  'skip_object',
])

export const aiDetectionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  printerId: z.string().uuid(),
  jobAssignmentId: z.string().uuid().nullable(),
  detectionType: detectionTypeSchema,
  confidence: z.number().min(0).max(1),
  snapshotPath: z.string().nullable(),
  actionTaken: detectionActionSchema,
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const detectionActionRequestSchema = z.object({
  detectionId: z.string().uuid(),
  action: z.enum(['pause', 'cancel', 'skip_object', 'dismiss']),
})

export type DetectionType = z.infer<typeof detectionTypeSchema>
export type DetectionAction = z.infer<typeof detectionActionSchema>
export type AiDetection = z.infer<typeof aiDetectionSchema>
export type DetectionActionRequest = z.infer<typeof detectionActionRequestSchema>
