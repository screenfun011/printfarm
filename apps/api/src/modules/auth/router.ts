import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { tenantMiddleware } from '../../middleware/tenant'
import { db } from '../../lib/db'
import { createAuthService, AuthServiceError } from './service'
import { registerSchema, loginSchema, totpVerifySchema } from './schema'

const authService = createAuthService({ db })

function handleAuthError(err: unknown): never {
  if (err instanceof AuthServiceError) {
    throw Object.assign(err, { isAuthError: true })
  }
  throw err
}

export const authRouter = new Hono()

  // POST /auth/register
  .post('/register', zValidator('json', registerSchema), async (c) => {
    const data = c.req.valid('json')
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '0.0.0.0'
    const userAgent = c.req.header('user-agent') ?? 'unknown'

    try {
      const result = await authService.register(data, { ip, userAgent })
      return c.json({ success: true, data: result }, 201)
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 409)
      }
      throw err
    }
  })

  // POST /auth/login
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const data = c.req.valid('json')
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '0.0.0.0'
    const userAgent = c.req.header('user-agent') ?? 'unknown'

    try {
      const result = await authService.login(data, { ip, userAgent })
      return c.json({ success: true, data: result })
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 401)
      }
      throw err
    }
  })

  // POST /auth/logout  (zahteva auth)
  .post('/logout', authMiddleware, tenantMiddleware, async (c) => {
    const sessionId = c.get('sessionId')
    await authService.logout(sessionId)
    return c.json({ success: true, data: null })
  })

  // GET /auth/me  (zahteva auth)
  .get('/me', authMiddleware, tenantMiddleware, async (c) => {
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    try {
      const user = await authService.me(userId, tenantId)
      return c.json({ success: true, data: user })
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404)
      }
      throw err
    }
  })

  // POST /auth/totp/setup  (zahteva auth)
  .post('/totp/setup', authMiddleware, tenantMiddleware, async (c) => {
    const userId = c.get('userId')

    try {
      const result = await authService.setupTotp(userId)
      return c.json({ success: true, data: result })
    } catch (err) {
      if (err instanceof AuthServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404 | 409)
      }
      throw err
    }
  })

  // POST /auth/totp/verify  (zahteva auth)
  .post(
    '/totp/verify',
    authMiddleware,
    tenantMiddleware,
    zValidator('json', totpVerifySchema),
    async (c) => {
      const userId = c.get('userId')
      const { code } = c.req.valid('json')

      try {
        await authService.verifyTotp(userId, code)
        return c.json({ success: true, data: null })
      } catch (err) {
        if (err instanceof AuthServiceError) {
          return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 400)
        }
        throw err
      }
    },
  )

// Unused but keeps TS happy for the handleAuthError helper
void handleAuthError
