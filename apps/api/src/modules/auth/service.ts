import { randomBytes, createHash } from 'crypto'
import { hash as bcryptHash, compare as bcryptCompare } from 'bcryptjs'
import { authenticator } from '../../lib/totp.js'
import { eq, and } from 'drizzle-orm'
import { users, tenants, tenantUsers, sessions, type Database } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import type { Register, Login } from '@printfarm/shared/schemas/user'

export class AuthServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'AuthServiceError'
  }
}

type AuthServiceDeps = { db: Database }
type SessionMeta = { ip: string; userAgent: string }

export function createAuthService({ db }: AuthServiceDeps) {
  function generateToken() {
    const raw = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(raw).digest('hex')
    return { raw, tokenHash }
  }

  async function createSession(userId: string, tenantId: string, meta: SessionMeta) {
    const { raw, tokenHash } = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        tenantId,
        tokenHash,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt,
      })
      .returning({ id: sessions.id })

    if (!session) throw new Error('Failed to create session')
    return { token: raw, sessionId: session.id }
  }

  return {
    async register(data: Register, meta: SessionMeta) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (existing) {
        throw new AuthServiceError('EMAIL_TAKEN', 'Email je već zauzet', 409)
      }

      const passwordHash = await bcryptHash(data.password, 12)
      const slug = data.fullName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + randomBytes(4).toString('hex')

      const [tenant] = await db
        .insert(tenants)
        .values({
          name: `${data.fullName}'s Farm`,
          slug,
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        })
        .returning({ id: tenants.id, name: tenants.name })
      if (!tenant) throw new Error('Failed to create tenant')

      const [user] = await db
        .insert(users)
        .values({
          email: data.email,
          passwordHash,
          fullName: data.fullName,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        })
      if (!user) throw new Error('Failed to create user')

      await db
        .insert(tenantUsers)
        .values({
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
        })

      const { token } = await createSession(user.id, tenant.id, meta)

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: 'owner' as const,
          tenantId: tenant.id,
          totpEnabled: false,
          avatarUrl: null,
          emailVerifiedAt: null,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
        },
      }
    },

    async login(data: Login, meta: SessionMeta) {
      const user = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          passwordHash: users.passwordHash,
          totpEnabled: users.totpEnabled,
          totpSecret: users.totpSecret,
          avatarUrl: users.avatarUrl,
          emailVerifiedAt: users.emailVerifiedAt,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!user) {
        throw new AuthServiceError(API_ERROR_CODES.UNAUTHORIZED, 'Pogrešan email ili lozinka', 401)
      }

      const passwordOk = await bcryptCompare(data.password, user.passwordHash)
      if (!passwordOk) {
        throw new AuthServiceError(API_ERROR_CODES.UNAUTHORIZED, 'Pogrešan email ili lozinka', 401)
      }

      if (user.totpEnabled) {
        if (!data.totpCode) {
          return { requireTotp: true as const }
        }
        const valid = authenticator.verify({ token: data.totpCode, secret: user.totpSecret! })
        if (!valid) {
          throw new AuthServiceError('TOTP_INVALID', 'Neispravan TOTP kod', 401)
        }
      }

      const tenantUser = await db
        .select({ tenantId: tenantUsers.tenantId, role: tenantUsers.role })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, user.id))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!tenantUser) {
        throw new AuthServiceError(API_ERROR_CODES.UNAUTHORIZED, 'Korisnik nije deo nijednog naloga', 401)
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id))

      const { token } = await createSession(user.id, tenantUser.tenantId, meta)

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: tenantUser.role,
          tenantId: tenantUser.tenantId,
          totpEnabled: user.totpEnabled,
          avatarUrl: user.avatarUrl,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        },
      }
    },

    async logout(sessionId: string) {
      await db
        .delete(sessions)
        .where(eq(sessions.id, sessionId))
    },

    async me(userId: string, tenantId: string) {
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          totpEnabled: users.totpEnabled,
          emailVerifiedAt: users.emailVerifiedAt,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          role: tenantUsers.role,
        })
        .from(users)
        .innerJoin(tenantUsers, and(
          eq(tenantUsers.userId, users.id),
          eq(tenantUsers.tenantId, tenantId),
        ))
        .where(eq(users.id, userId))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!result) {
        throw new AuthServiceError(API_ERROR_CODES.NOT_FOUND, 'Korisnik nije pronađen', 404)
      }

      return {
        id: result.id,
        email: result.email,
        fullName: result.fullName,
        avatarUrl: result.avatarUrl,
        totpEnabled: result.totpEnabled,
        role: result.role,
        tenantId,
        emailVerifiedAt: result.emailVerifiedAt?.toISOString() ?? null,
        lastLoginAt: result.lastLoginAt?.toISOString() ?? null,
        createdAt: result.createdAt.toISOString(),
      }
    },

    async setupTotp(userId: string) {
      const user = await db
        .select({ email: users.email, totpEnabled: users.totpEnabled })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!user) {
        throw new AuthServiceError(API_ERROR_CODES.NOT_FOUND, 'Korisnik nije pronađen', 404)
      }

      if (user.totpEnabled) {
        throw new AuthServiceError('TOTP_ALREADY_ENABLED', 'TOTP je već omogućen', 409)
      }

      const secret = authenticator.generateSecret()
      const uri = authenticator.keyuri(user.email, 'PrintFarm', secret)

      await db
        .update(users)
        .set({ totpSecret: secret })
        .where(eq(users.id, userId))

      return { secret, uri }
    },

    async verifyTotp(userId: string, code: string) {
      const user = await db
        .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!user?.totpSecret) {
        throw new AuthServiceError('TOTP_NOT_SETUP', 'TOTP nije podešen', 400)
      }

      const valid = authenticator.verify({ token: code, secret: user.totpSecret })
      if (!valid) {
        throw new AuthServiceError('TOTP_INVALID', 'Neispravan TOTP kod', 400)
      }

      await db
        .update(users)
        .set({ totpEnabled: true })
        .where(eq(users.id, userId))
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
