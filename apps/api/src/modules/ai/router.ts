import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { tenantMiddleware } from '../../middleware/tenant'
import { db } from '../../lib/db'
import { createAiService, AiServiceError } from './service'
import { actionParamSchema } from './schema'

const aiService = createAiService({ db })

const idParam = zValidator('param', z.object({ id: z.string().uuid() }))

export const aiRouter = new Hono()
  .use(authMiddleware)
  .use(tenantMiddleware)

  // GET /ai/detections
  .get('/detections', async (c) => {
    const tenantId = c.get('tenantId')
    const list = await aiService.list(tenantId)
    return c.json({ success: true, data: list })
  })

  // PATCH /ai/detections/:id/action
  .patch('/detections/:id/action', idParam, zValidator('json', actionParamSchema), async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    const { action } = c.req.valid('json')

    try {
      await aiService.takeAction(tenantId, id, action)
      return c.json({ success: true, data: null })
    } catch (err) {
      if (err instanceof AiServiceError) {
        return c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as 404 | 409,
        )
      }
      throw err
    }
  })
