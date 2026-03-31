import { pgTable, uuid, varchar, boolean, timestamp, text, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const superAdmins = pgTable('super_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  totpSecret: text('totp_secret').notNull(),
  totpEnabled: boolean('totp_enabled').notNull().default(true),
  webauthnCredentials: jsonb('webauthn_credentials'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const superAdminSessions = pgTable('super_admin_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  superAdminId: uuid('super_admin_id').notNull().references(() => superAdmins.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const superAdminsRelations = relations(superAdmins, ({ many }) => ({
  sessions: many(superAdminSessions),
}))

export const superAdminSessionsRelations = relations(superAdminSessions, ({ one }) => ({
  superAdmin: one(superAdmins, { fields: [superAdminSessions.superAdminId], references: [superAdmins.id] }),
}))
