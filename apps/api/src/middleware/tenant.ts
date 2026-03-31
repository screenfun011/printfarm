import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { eq } from 'drizzle-orm'
import { tenants } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import { db } from '../lib/db'

const BLOCKED_STATUSES = ['suspended', 'blocked', 'deleted', 'trial_expired'] as const

export const tenantMiddleware = createMiddleware(async (c, next) => {
  const tenantId = c.get('tenantId') as string | undefined

  if (!tenantId) {
    throw new HTTPException(401, {
      message: JSON.stringify({
        success: false,
        error: { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Tenant nije identifikovan' },
      }),
    })
  }

  const tenant = await db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
    .then(rows => rows[0] ?? null)

  if (!tenant) {
    throw new HTTPException(404, {
      message: JSON.stringify({
        success: false,
        error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Tenant ne postoji' },
      }),
    })
  }

  if (BLOCKED_STATUSES.includes(tenant.status as typeof BLOCKED_STATUSES[number])) {
    const code = tenant.status === 'blocked'
      ? API_ERROR_CODES.FORBIDDEN
      : API_ERROR_CODES.TENANT_SUSPENDED

    const message = tenant.status === 'blocked'
      ? 'Nalog je blokiran. Kontaktirajte podršku.'
      : tenant.status === 'trial_expired'
        ? 'Trial period je istekao. Aktivirajte pretplatu.'
        : 'Nalog je suspendovan. Proverite billing.'

    throw new HTTPException(402, {
      message: JSON.stringify({
        success: false,
        error: { code, message },
      }),
    })
  }

  await next()
})
