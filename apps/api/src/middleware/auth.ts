import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { eq, and, gt } from 'drizzle-orm'
import { sessions, tenantUsers } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import { db } from '../lib/db'
import { createHash } from 'crypto'

type AuthContext = {
  Variables: {
    userId: string
    tenantId: string
    role: 'owner' | 'admin' | 'operator' | 'viewer'
    sessionId: string
  }
}

export const authMiddleware = createMiddleware<AuthContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: JSON.stringify({
        success: false,
        error: { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Token nije prosleđen' },
      }),
    })
  }

  const token = authHeader.slice(7)
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const result = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      tenantId: sessions.tenantId,
      role: tenantUsers.role,
    })
    .from(sessions)
    .innerJoin(tenantUsers, and(
      eq(tenantUsers.userId, sessions.userId),
      eq(tenantUsers.tenantId, sessions.tenantId),
    ))
    .where(and(
      eq(sessions.tokenHash, tokenHash),
      gt(sessions.expiresAt, new Date()),
    ))
    .limit(1)
    .then(rows => rows[0] ?? null)

  if (!result) {
    throw new HTTPException(401, {
      message: JSON.stringify({
        success: false,
        error: { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Sesija nije validna ili je istekla' },
      }),
    })
  }

  c.set('userId', result.userId)
  c.set('tenantId', result.tenantId)
  c.set('role', result.role)
  c.set('sessionId', result.sessionId)

  await next()
})
