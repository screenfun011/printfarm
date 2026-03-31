import { z } from 'zod'
import { printerStatusLiveSchema } from './schemas/printer'
import { aiDetectionSchema } from './schemas/ai'
import { jobStatusSchema, assignmentStatusSchema } from './schemas/job'

export const wsEventTypeSchema = z.enum([
  'printer.status',
  'printer.online',
  'printer.offline',
  'printer.error',
  'job.started',
  'job.completed',
  'job.failed',
  'job.paused',
  'assignment.updated',
  'ai.detection',
  'notification.new',
  'bridge.connected',
  'bridge.disconnected',
])

export type WsEventType = z.infer<typeof wsEventTypeSchema>

const printerStatusEventSchema = z.object({
  type: z.literal('printer.status'),
  tenantId: z.string().uuid(),
  payload: printerStatusLiveSchema,
})

const printerOnlineEventSchema = z.object({
  type: z.literal('printer.online'),
  tenantId: z.string().uuid(),
  payload: z.object({ printerId: z.string().uuid() }),
})

const printerOfflineEventSchema = z.object({
  type: z.literal('printer.offline'),
  tenantId: z.string().uuid(),
  payload: z.object({ printerId: z.string().uuid() }),
})

const printerErrorEventSchema = z.object({
  type: z.literal('printer.error'),
  tenantId: z.string().uuid(),
  payload: z.object({
    printerId: z.string().uuid(),
    errorCode: z.string(),
    message: z.string(),
  }),
})

const jobStartedEventSchema = z.object({
  type: z.literal('job.started'),
  tenantId: z.string().uuid(),
  payload: z.object({ jobId: z.string().uuid(), printerId: z.string().uuid() }),
})

const jobCompletedEventSchema = z.object({
  type: z.literal('job.completed'),
  tenantId: z.string().uuid(),
  payload: z.object({ jobId: z.string().uuid(), status: jobStatusSchema }),
})

const jobFailedEventSchema = z.object({
  type: z.literal('job.failed'),
  tenantId: z.string().uuid(),
  payload: z.object({
    jobId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    reason: z.string(),
  }),
})

const assignmentUpdatedEventSchema = z.object({
  type: z.literal('assignment.updated'),
  tenantId: z.string().uuid(),
  payload: z.object({
    assignmentId: z.string().uuid(),
    status: assignmentStatusSchema,
  }),
})

const aiDetectionEventSchema = z.object({
  type: z.literal('ai.detection'),
  tenantId: z.string().uuid(),
  payload: aiDetectionSchema,
})

const notificationNewEventSchema = z.object({
  type: z.literal('notification.new'),
  tenantId: z.string().uuid(),
  payload: z.object({
    notificationId: z.string().uuid(),
    title: z.string(),
    body: z.string(),
  }),
})

const bridgeConnectedEventSchema = z.object({
  type: z.literal('bridge.connected'),
  tenantId: z.string().uuid(),
  payload: z.object({ deviceId: z.string().uuid() }),
})

const bridgeDisconnectedEventSchema = z.object({
  type: z.literal('bridge.disconnected'),
  tenantId: z.string().uuid(),
  payload: z.object({ deviceId: z.string().uuid() }),
})

export const wsEventSchema = z.discriminatedUnion('type', [
  printerStatusEventSchema,
  printerOnlineEventSchema,
  printerOfflineEventSchema,
  printerErrorEventSchema,
  jobStartedEventSchema,
  jobCompletedEventSchema,
  jobFailedEventSchema,
  assignmentUpdatedEventSchema,
  aiDetectionEventSchema,
  notificationNewEventSchema,
  bridgeConnectedEventSchema,
  bridgeDisconnectedEventSchema,
])

export type WsEvent = z.infer<typeof wsEventSchema>
