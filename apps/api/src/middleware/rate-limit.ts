import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'

type RateLimitStore = Map<string, { count: number; resetAt: number }>

const store: RateLimitStore = new Map()

function cleanExpired(now: number) {
  for (const [key, value] of store) {
    if (value.resetAt < now) store.delete(key)
  }
}

type RateLimitOptions = {
  windowMs: number
  max: number
  keyFn?: (c: Context) => string
}

export function rateLimit({ windowMs, max, keyFn }: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const now = Date.now()

    if (store.size > 10_000) cleanExpired(now)

    const key = keyFn
      ? keyFn(c)
      : c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'

    const record = store.get(key)

    if (!record || record.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)

      c.res.headers.set('Retry-After', String(retryAfter))
      c.res.headers.set('X-RateLimit-Limit', String(max))
      c.res.headers.set('X-RateLimit-Remaining', '0')

      throw new HTTPException(429, {
        message: JSON.stringify({
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Previše zahteva. Pokušajte ponovo.' },
        }),
      })
    }

    record.count++
    c.res.headers.set('X-RateLimit-Limit', String(max))
    c.res.headers.set('X-RateLimit-Remaining', String(max - record.count))

    return next()
  })
}

export const defaultRateLimit = rateLimit({ windowMs: 60_000, max: 100 })
export const authRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 })
