import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { eq } from 'drizzle-orm'
import { tenantFeatures } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import { features } from '@printfarm/config/features'
import { db } from '../lib/db'

type FeatureKey = keyof typeof tenantFeatures.$inferSelect

export function requireFeature(globalFeature: keyof typeof features, tenantFeatureKey?: FeatureKey) {
  return createMiddleware(async (c, next) => {
    if (!features[globalFeature]) {
      throw new HTTPException(403, {
        message: JSON.stringify({
          success: false,
          error: {
            code: API_ERROR_CODES.FEATURE_DISABLED,
            message: 'Ova funkcija nije dostupna u vašoj varijanti aplikacije',
          },
        }),
      })
    }

    if (tenantFeatureKey) {
      const tenantId = c.get('tenantId') as string

      const tenantFeatureRow = await db
        .select()
        .from(tenantFeatures)
        .where(eq(tenantFeatures.tenantId, tenantId))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!tenantFeatureRow || !tenantFeatureRow[tenantFeatureKey]) {
        throw new HTTPException(403, {
          message: JSON.stringify({
            success: false,
            error: {
              code: API_ERROR_CODES.FEATURE_DISABLED,
              message: 'Ova funkcija nije uključena za vaš nalog',
            },
          }),
        })
      }
    }

    await next()
  })
}
