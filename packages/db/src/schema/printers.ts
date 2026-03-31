import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, integer, numeric, jsonb, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './auth'

export const deviceStatusEnum = pgEnum('device_status', [
  'provisioning',
  'paired',
  'online',
  'offline',
  'error',
])

export const printerModelEnum = pgEnum('printer_model', [
  'a1',
  'a1_mini',
  'p1p',
  'p1s',
  'x1c',
  'x1e',
  'h2d',
])

export const printerStatusEnum = pgEnum('printer_status', [
  'idle',
  'printing',
  'paused',
  'error',
  'offline',
])

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  provisionToken: varchar('provision_token', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  status: deviceStatusEnum('status').notNull().default('provisioning'),
  hardwareId: varchar('hardware_id', { length: 255 }).unique(),
  hardwareInfo: jsonb('hardware_info'),
  ipAddress: varchar('ip_address', { length: 45 }),
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  pairedAt: timestamp('paired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const printers = pgTable('printers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => devices.id),
  name: varchar('name', { length: 255 }).notNull(),
  model: printerModelEnum('model').notNull(),
  serialNumber: varchar('serial_number', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  accessCode: varchar('access_code', { length: 255 }).notNull(),
  status: printerStatusEnum('status').notNull().default('offline'),
  isActive: boolean('is_active').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueTenantSerial: unique().on(table.tenantId, table.serialNumber),
}))

export const printerStatus = pgTable('printer_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  printerId: uuid('printer_id').notNull().references(() => printers.id, { onDelete: 'cascade' }).unique(),
  nozzleTemp: numeric('nozzle_temp', { precision: 5, scale: 1 }),
  nozzleTargetTemp: numeric('nozzle_target_temp', { precision: 5, scale: 1 }),
  bedTemp: numeric('bed_temp', { precision: 5, scale: 1 }),
  bedTargetTemp: numeric('bed_target_temp', { precision: 5, scale: 1 }),
  chamberTemp: numeric('chamber_temp', { precision: 5, scale: 1 }),
  printProgress: integer('print_progress'),
  layerCurrent: integer('layer_current'),
  layerTotal: integer('layer_total'),
  timeRemainingSecs: integer('time_remaining_secs'),
  amsStatus: jsonb('ams_status'),
  errorCode: varchar('error_code', { length: 50 }),
  gcodeState: varchar('gcode_state', { length: 50 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const devicesRelations = relations(devices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [devices.tenantId], references: [tenants.id] }),
  printers: many(printers),
}))

export const printersRelations = relations(printers, ({ one }) => ({
  tenant: one(tenants, { fields: [printers.tenantId], references: [tenants.id] }),
  device: one(devices, { fields: [printers.deviceId], references: [devices.id] }),
  status: one(printerStatus, { fields: [printers.id], references: [printerStatus.printerId] }),
}))
