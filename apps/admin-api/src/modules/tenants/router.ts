import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../lib/db.js'
import { adminAuthMiddleware } from '../../middleware/auth.js'
import { createTenantsService, TenantsServiceError } from './service.js'

const tenantsService = createTenantsService({ db })

const idParam = zValidator('param', z.object({ id: z.string().uuid() }))

const updateStatusSchema = z.object({
  status: z.enum(['trial', 'trial_expired', 'active', 'suspended', 'blocked', 'deleted']),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err: unknown, c: any) {
  if (err instanceof TenantsServiceError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 404 | 409,
    )
  }
  throw err
}

export const tenantsRouter = new Hono()
  .use(adminAuthMiddleware)

  // GET /tenants
  .get('/', async (c) => {
    const statusQuery = c.req.query('status')
    const status = statusQuery as Parameters<typeof tenantsService.list>[0]['status'] | undefined
    const limit = Number(c.req.query('limit') ?? 50)
    const offset = Number(c.req.query('offset') ?? 0)
    const list = await tenantsService.list({ ...(status ? { status } : {}), limit, offset })
    return c.json({ success: true, data: list })
  })

  // GET /tenants/:id
  .get('/:id', idParam, async (c) => {
    const { id } = c.req.valid('param')
    try {
      const tenant = await tenantsService.getById(id)
      return c.json({ success: true, data: tenant })
    } catch (err) {
      return handleError(err, c)
    }
  })

  // PATCH /tenants/:id/status
  .patch('/:id/status', idParam, zValidator('json', updateStatusSchema), async (c) => {
    const { id } = c.req.valid('param')
    const { status } = c.req.valid('json')
    try {
      const tenant = await tenantsService.updateStatus(id, status)
      return c.json({ success: true, data: tenant })
    } catch (err) {
      return handleError(err, c)
    }
  })
