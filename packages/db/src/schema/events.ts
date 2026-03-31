import { pgTable, uuid, varchar, timestamp, text, pgEnum, integer, numeric, jsonb, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants, users } from './auth'
import { printers } from './printers'
import { jobPrinterAssignments } from './jobs'

export const detectionTypeEnum = pgEnum('detection_type', [
  'spaghetti',
  'detached',
  'layer_shift',
  'warping',
  'stringing',
  'unknown',
])

export const detectionActionEnum = pgEnum('detection_action', [
  'none',
  'notified',
  'paused',
  'canceled',
  'skip_object',
])

export const printerEventTypeEnum = pgEnum('printer_event_type', [
  'status_changed',
  'error_occurred',
  'print_started',
  'print_completed',
  'print_failed',
  'filament_changed',
  'ai_detection',
  'device_online',
  'device_offline',
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'trial_expiring',
  'billing_failed',
  'printer_offline',
  'printer_error',
  'ai_detection',
  'print_complete',
  'print_failed',
  'limit_reached',
])

export const pushPlatformEnum = pgEnum('push_platform', ['ios', 'android'])

export const auditActorTypeEnum = pgEnum('audit_actor_type', [
  'user',
  'super_admin',
  'system',
  'bridge',
])

export const aiDetections = pgTable('ai_detections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  printerId: uuid('printer_id').notNull().references(() => printers.id),
  jobAssignmentId: uuid('job_assignment_id').references(() => jobPrinterAssignments.id),
  detectionType: detectionTypeEnum('detection_type').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  snapshotPath: text('snapshot_path'),
  actionTaken: detectionActionEnum('action_taken').notNull().default('none'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const printerEvents = pgTable('printer_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  printerId: uuid('printer_id').notNull().references(() => printers.id),
  eventType: printerEventTypeEnum('event_type').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  perTypeSettings: jsonb('per_type_settings').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  platform: pushPlatformEnum('platform').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: auditActorTypeEnum('actor_type').notNull(),
  actorId: uuid('actor_id'),
  tenantId: uuid('tenant_id'),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const aiDetectionsRelations = relations(aiDetections, ({ one }) => ({
  tenant: one(tenants, { fields: [aiDetections.tenantId], references: [tenants.id] }),
  printer: one(printers, { fields: [aiDetections.printerId], references: [printers.id] }),
  assignment: one(jobPrinterAssignments, { fields: [aiDetections.jobAssignmentId], references: [jobPrinterAssignments.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, { fields: [notifications.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, { fields: [pushTokens.userId], references: [users.id] }),
}))
