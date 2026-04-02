import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../lib/db.js'
import { adminAuthMiddleware } from '../../middleware/auth.js'
import { authRateLimit } from '../../middleware/rate-limit.js'
import { createAdminAuthService, AdminAuthError } from './service.js'
import { loginSchema } from './schema.js'

const authService = createAdminAuthService({ db })

export const authRouter = new Hono()

  // POST /auth/login
  .post('/login', authRateLimit, zValidator('json', loginSchema), async (c) => {
    const data = c.req.valid('json')
    const meta = {
      ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '0.0.0.0',
      userAgent: c.req.header('user-agent') ?? '',
    }
    try {
      const result = await authService.login(data, meta)
      return c.json({ success: true, data: result })
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as 401 | 403 | 404,
        )
      }
      throw err
    }
  })

  // POST /auth/logout
  .post('/logout', adminAuthMiddleware, async (c) => {
    const authHeader = c.req.header('Authorization') ?? ''
    const token = authHeader.slice(7)
    await authService.logout(token)
    return c.json({ success: true, data: null })
  })

  // GET /auth/me
  .get('/me', adminAuthMiddleware, async (c) => {
    const superAdminId = c.get('superAdminId')
    try {
      const admin = await authService.me(superAdminId)
      return c.json({ success: true, data: admin })
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as 404,
        )
      }
      throw err
    }
  })
