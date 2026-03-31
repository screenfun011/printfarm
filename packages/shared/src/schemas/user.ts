import { z } from 'zod'
import { tenantRoleSchema } from './tenant'

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  avatarUrl: z.string().url().nullable(),
  totpEnabled: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Lozinka mora imati minimum 8 karaktera')
    .regex(/[A-Z]/, 'Lozinka mora imati jedno veliko slovo')
    .regex(/[0-9]/, 'Lozinka mora imati jedan broj'),
  fullName: z.string().min(1).max(255),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
})

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

export const sessionUserSchema = userSchema.extend({
  role: tenantRoleSchema,
  tenantId: z.string().uuid(),
})

export type User = z.infer<typeof userSchema>
export type Register = z.infer<typeof registerSchema>
export type Login = z.infer<typeof loginSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
export type SessionUser = z.infer<typeof sessionUserSchema>
