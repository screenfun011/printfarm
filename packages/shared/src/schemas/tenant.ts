import { z } from 'zod'

export const tenantStatusSchema = z.enum([
  'trial',
  'trial_expired',
  'active',
  'suspended',
  'blocked',
  'deleted',
])

export const tenantRoleSchema = z.enum([
  'owner',
  'admin',
  'operator',
  'viewer',
])

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug sme da sadrži samo mala slova, brojeve i crtice'),
  status: tenantStatusSchema,
  trialEndsAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
})

export const tenantUserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: tenantRoleSchema,
  invitedBy: z.string().uuid().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export type TenantStatus = z.infer<typeof tenantStatusSchema>
export type TenantRole = z.infer<typeof tenantRoleSchema>
export type Tenant = z.infer<typeof tenantSchema>
export type CreateTenant = z.infer<typeof createTenantSchema>
export type TenantUser = z.infer<typeof tenantUserSchema>
