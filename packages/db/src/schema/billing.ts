import { pgTable, uuid, varchar, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './auth'

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
])

export const licenseStatusEnum = pgEnum('license_status', [
  'inactive',
  'active',
  'revoked',
])

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  maxPrinters: integer('max_printers').notNull(),
  priceMonthly: integer('price_monthly').notNull(),
  stripePriceIdMonthly: varchar('stripe_price_id_monthly', { length: 255 }).notNull(),
  features: jsonb('features').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
  status: subscriptionStatusEnum('status').notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  addonPrinters: integer('addon_printers').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).notNull().unique(),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  status: varchar('status', { length: 50 }).notNull(),
  invoiceUrl: varchar('invoice_url', { length: 500 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tenantFeatures = pgTable('tenant_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  aiDetectionEnabled: boolean('ai_detection_enabled').notNull().default(false),
  cameraEnabled: boolean('camera_enabled').notNull().default(true),
  webhooksEnabled: boolean('webhooks_enabled').notNull().default(false),
  maxPrintersOverride: integer('max_printers_override'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const licenses = pgTable('licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  licenseKey: varchar('license_key', { length: 64 }).notNull().unique(),
  deviceHardwareId: varchar('device_hardware_id', { length: 255 }).unique(),
  status: licenseStatusEnum('status').notNull().default('inactive'),
  cloudConnectEnabled: boolean('cloud_connect_enabled').notNull().default(false),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cloudConnectSubscriptions = pgTable('cloud_connect_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  licenseId: uuid('license_id').notNull().references(() => licenses.id).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
  status: subscriptionStatusEnum('status').notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [subscriptions.tenantId], references: [tenants.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  invoices: many(invoices),
}))

export const licensesRelations = relations(licenses, ({ one }) => ({
  cloudConnect: one(cloudConnectSubscriptions, { fields: [licenses.id], references: [cloudConnectSubscriptions.licenseId] }),
}))
