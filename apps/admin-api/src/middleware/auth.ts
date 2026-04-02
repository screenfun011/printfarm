import { createMiddleware } from 'hono/factory'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { superAdminSessions, superAdmins } from '@printfarm/db/schema'
import { db } from '../lib/db.js'

declare module 'hono' {
  interface ContextVariableMap {
    superAdminId: string
    superAdminEmail: string
  }
}

export const adminAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Nije autorizovano' } }, 401)
  }

  const token = authHeader.slice(7)
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const [row] = await db
    .select({
      superAdminId: superAdminSessions.superAdminId,
      expiresAt: superAdminSessions.expiresAt,
      email: superAdmins.email,
    })
    .from(superAdminSessions)
    .innerJoin(superAdmins, eq(superAdmins.id, superAdminSessions.superAdminId))
    .where(eq(superAdminSessions.tokenHash, tokenHash))
    .limit(1)

  if (!row) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Nevažeća sesija' } }, 401)
  }

  if (row.expiresAt < new Date()) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sesija je istekla' } }, 401)
  }

  c.set('superAdminId', row.superAdminId)
  c.set('superAdminEmail', row.email)

  return next()
})
