import { z } from 'zod'

export const printerModelSchema = z.enum([
  'a1',
  'a1_mini',
  'p1p',
  'p1s',
  'x1c',
  'x1e',
  'h2d',
])

export const printerStatusSchema = z.enum([
  'idle',
  'printing',
  'paused',
  'error',
  'offline',
])

export const amsSlotSchema = z.object({
  slot: z.number().int().min(0).max(3),
  filamentType: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  remainingPercent: z.number().min(0).max(100).nullable(),
})

export const printerStatusLiveSchema = z.object({
  printerId: z.string().uuid(),
  nozzleTemp: z.number().nullable(),
  nozzleTargetTemp: z.number().nullable(),
  bedTemp: z.number().nullable(),
  bedTargetTemp: z.number().nullable(),
  chamberTemp: z.number().nullable(),
  printProgress: z.number().int().min(0).max(100).nullable(),
  layerCurrent: z.number().int().nullable(),
  layerTotal: z.number().int().nullable(),
  timeRemainingSecs: z.number().int().nullable(),
  amsSlots: z.array(amsSlotSchema).nullable(),
  errorCode: z.string().nullable(),
  gcodeState: z.string().nullable(),
  updatedAt: z.string().datetime(),
})

export const printerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  deviceId: z.string().uuid().nullable(),
  name: z.string().min(1).max(255),
  model: printerModelSchema,
  serialNumber: z.string().min(1),
  ipAddress: z.string().ip(),
  status: printerStatusSchema,
  isActive: z.boolean(),
  lastSeenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const addPrinterSchema = z.object({
  name: z.string().min(1).max(255),
  model: printerModelSchema,
  serialNumber: z.string().min(1),
  ipAddress: z.string().ip(),
  accessCode: z.string().min(1).max(8),
})

export const updatePrinterSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
})

export type PrinterModel = z.infer<typeof printerModelSchema>
export type PrinterStatus = z.infer<typeof printerStatusSchema>
export type AmsSlot = z.infer<typeof amsSlotSchema>
export type PrinterStatusLive = z.infer<typeof printerStatusLiveSchema>
export type Printer = z.infer<typeof printerSchema>
export type AddPrinter = z.infer<typeof addPrinterSchema>
export type UpdatePrinter = z.infer<typeof updatePrinterSchema>
