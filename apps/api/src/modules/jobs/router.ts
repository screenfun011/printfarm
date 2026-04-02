import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createJobSchema } from '@printfarm/shared/schemas/job'
import { authMiddleware } from '../../middleware/auth'
import { tenantMiddleware } from '../../middleware/tenant'
import { db } from '../../lib/db'
import { createJobService, JobServiceError } from './service'

const jobService = createJobService({ db })

const idParam = zValidator('param', z.object({ id: z.string().uuid() }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleJobError(err: unknown, c: any) {
  if (err instanceof JobServiceError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 404 | 409 | 422,
    )
  }
  throw err
}

export const jobsRouter = new Hono()
  .use(authMiddleware)
  .use(tenantMiddleware)

  // GET /jobs
  .get('/', async (c) => {
    const tenantId = c.get('tenantId')
    const list = await jobService.list(tenantId)
    return c.json({ success: true, data: list })
  })

  // GET /jobs/:id
  .get('/:id', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      const job = await jobService.getById(tenantId, id)
      return c.json({ success: true, data: job })
    } catch (err) {
      return handleJobError(err, c)
    }
  })

  // POST /jobs
  .post('/', zValidator('json', createJobSchema), async (c) => {
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const data = c.req.valid('json')
    try {
      const job = await jobService.create(tenantId, userId, data)
      return c.json({ success: true, data: job }, 201)
    } catch (err) {
      return handleJobError(err, c)
    }
  })

  // PATCH /jobs/:id/cancel
  .patch('/:id/cancel', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      await jobService.cancel(tenantId, id)
      return c.json({ success: true, data: null })
    } catch (err) {
      return handleJobError(err, c)
    }
  })

  // PATCH /jobs/:id/pause
  .patch('/:id/pause', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      await jobService.pause(tenantId, id)
      return c.json({ success: true, data: null })
    } catch (err) {
      return handleJobError(err, c)
    }
  })

  // PATCH /jobs/:id/resume
  .patch('/:id/resume', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      await jobService.resume(tenantId, id)
      return c.json({ success: true, data: null })
    } catch (err) {
      return handleJobError(err, c)
    }
  })

  // DELETE /jobs/:id
  .delete('/:id', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      await jobService.remove(tenantId, id)
      return c.json({ success: true, data: null })
    } catch (err) {
      return handleJobError(err, c)
    }
  })
