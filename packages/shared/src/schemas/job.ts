import { z } from 'zod'

export const jobStatusSchema = z.enum([
  'queued',
  'preparing',
  'printing',
  'completed',
  'failed',
  'canceled',
  'paused',
])

export const assignmentStatusSchema = z.enum([
  'queued',
  'printing',
  'completed',
  'failed',
  'canceled',
  'skipped',
])

export const printFileMetadataSchema = z.object({
  estimatedTimeSecs: z.number().int().nullable(),
  filamentGrams: z.number().nullable(),
  objectCount: z.number().int().nullable(),
  layerHeight: z.number().nullable(),
  supportEnabled: z.boolean().nullable(),
})

export const printFileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  uploadedBy: z.string().uuid(),
  name: z.string().min(1).max(255),
  originalFilename: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  thumbnailPath: z.string().nullable(),
  fileHash: z.string().length(64),
  metadata: printFileMetadataSchema.nullable(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
})

export const printJobSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  fileId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string().min(1).max(255),
  status: jobStatusSchema,
  priority: z.number().int().default(0),
  copies: z.number().int().min(1).max(100),
  copiesCompleted: z.number().int().min(0),
  notes: z.string().max(1000).nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const createJobSchema = z.object({
  fileId: z.string().uuid(),
  name: z.string().min(1).max(255),
  printerIds: z.array(z.string().uuid()).min(1),
  copies: z.number().int().min(1).max(100).default(1),
  priority: z.number().int().min(0).max(100).default(0),
  notes: z.string().max(1000).optional(),
})

export const jobPrinterAssignmentSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  printerId: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: assignmentStatusSchema,
  copyNumber: z.number().int().min(1),
  errorMessage: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export type JobStatus = z.infer<typeof jobStatusSchema>
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>
export type PrintFile = z.infer<typeof printFileSchema>
export type PrintJob = z.infer<typeof printJobSchema>
export type CreateJob = z.infer<typeof createJobSchema>
export type JobPrinterAssignment = z.infer<typeof jobPrinterAssignmentSchema>
