import { pgTable, uuid, varchar, boolean, timestamp, text, pgEnum, integer, bigint, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants, users } from './auth'
import { printers } from './printers'

export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'preparing',
  'printing',
  'completed',
  'failed',
  'canceled',
  'paused',
])

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'queued',
  'printing',
  'completed',
  'failed',
  'canceled',
  'skipped',
])

export const printFiles = pgTable('print_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  storagePath: text('storage_path').notNull(),
  thumbnailPath: text('thumbnail_path'),
  fileHash: varchar('file_hash', { length: 64 }).notNull(),
  metadata: jsonb('metadata'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const printJobs = pgTable('print_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').notNull().references(() => printFiles.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  status: jobStatusEnum('status').notNull().default('queued'),
  priority: integer('priority').notNull().default(0),
  copies: integer('copies').notNull().default(1),
  copiesCompleted: integer('copies_completed').notNull().default(0),
  notes: text('notes'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobPrinterAssignments = pgTable('job_printer_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => printJobs.id, { onDelete: 'cascade' }),
  printerId: uuid('printer_id').notNull().references(() => printers.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  status: assignmentStatusEnum('status').notNull().default('queued'),
  copyNumber: integer('copy_number').notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const printFilesRelations = relations(printFiles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [printFiles.tenantId], references: [tenants.id] }),
  uploadedBy: one(users, { fields: [printFiles.uploadedBy], references: [users.id] }),
  jobs: many(printJobs),
}))

export const printJobsRelations = relations(printJobs, ({ one, many }) => ({
  tenant: one(tenants, { fields: [printJobs.tenantId], references: [tenants.id] }),
  file: one(printFiles, { fields: [printJobs.fileId], references: [printFiles.id] }),
  createdBy: one(users, { fields: [printJobs.createdBy], references: [users.id] }),
  assignments: many(jobPrinterAssignments),
}))

export const assignmentsRelations = relations(jobPrinterAssignments, ({ one }) => ({
  job: one(printJobs, { fields: [jobPrinterAssignments.jobId], references: [printJobs.id] }),
  printer: one(printers, { fields: [jobPrinterAssignments.printerId], references: [printers.id] }),
  tenant: one(tenants, { fields: [jobPrinterAssignments.tenantId], references: [tenants.id] }),
}))
