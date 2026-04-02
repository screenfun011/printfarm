import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { superAdmins, superAdminSessions } from '@printfarm/db/schema'
import { authenticator } from '../../lib/totp.js'
import type { Database } from '../../lib/db.js'
import type { Login } from './schema.js'

export class AdminAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

type ServiceDeps = { db: Database }
type SessionMeta = { ip: string; userAgent: string }

export function createAdminAuthService({ db }: ServiceDeps) {
  async function createSession(superAdminId: string, meta: SessionMeta) {
    const raw = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(raw).digest('hex')
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 sati

    const [session] = await db
      .insert(superAdminSessions)
      .values({ superAdminId, tokenHash, ipAddress: meta.ip, userAgent: meta.userAgent, expiresAt })
      .returning({ id: superAdminSessions.id })

    if (!session) throw new Error('Failed to create session')
    return raw
  }

  return {
    async login(data: Login, meta: SessionMeta) {
      const [admin] = await db
        .select({
          id: superAdmins.id,
          email: superAdmins.email,
          fullName: superAdmins.fullName,
          passwordHash: superAdmins.passwordHash,
          totpEnabled: superAdmins.totpEnabled,
          totpSecret: superAdmins.totpSecret,
          isActive: superAdmins.isActive,
          lastLoginAt: superAdmins.lastLoginAt,
          createdAt: superAdmins.createdAt,
        })
        .from(superAdmins)
        .where(eq(superAdmins.email, data.email))
        .limit(1)

      if (!admin) {
        throw new AdminAuthError('UNAUTHORIZED', 'Pogrešan email ili lozinka', 401)
      }

      if (!admin.isActive) {
        throw new AdminAuthError('ACCOUNT_INACTIVE', 'Nalog je deaktiviran', 403)
      }

      const passwordOk = await bcrypt.compare(data.password, admin.passwordHash)
      if (!passwordOk) {
        throw new AdminAuthError('UNAUTHORIZED', 'Pogrešan email ili lozinka', 401)
      }

      if (admin.totpEnabled) {
        if (!data.totpCode) {
          return { requireTotp: true as const }
        }
        const valid = authenticator.verify({ token: data.totpCode, secret: admin.totpSecret })
        if (!valid) {
          throw new AdminAuthError('TOTP_INVALID', 'Neispravan TOTP kod', 401)
        }
      }

      await db
        .update(superAdmins)
        .set({ lastLoginAt: new Date() })
        .where(eq(superAdmins.id, admin.id))

      const token = await createSession(admin.id, meta)

      return {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          totpEnabled: admin.totpEnabled,
          lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
          createdAt: admin.createdAt.toISOString(),
        },
      }
    },

    async logout(token: string) {
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await db
        .delete(superAdminSessions)
        .where(eq(superAdminSessions.tokenHash, tokenHash))
    },

    async me(superAdminId: string) {
      const [admin] = await db
        .select({
          id: superAdmins.id,
          email: superAdmins.email,
          fullName: superAdmins.fullName,
          totpEnabled: superAdmins.totpEnabled,
          isActive: superAdmins.isActive,
          lastLoginAt: superAdmins.lastLoginAt,
          createdAt: superAdmins.createdAt,
        })
        .from(superAdmins)
        .where(eq(superAdmins.id, superAdminId))
        .limit(1)

      if (!admin) {
        throw new AdminAuthError('NOT_FOUND', 'Admin nije pronađen', 404)
      }

      return {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        totpEnabled: admin.totpEnabled,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
        createdAt: admin.createdAt.toISOString(),
      }
    },
  }
}

export type AdminAuthService = ReturnType<typeof createAdminAuthService>
