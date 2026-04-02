import { Hono } from 'hono'
import { db } from '../../lib/db.js'
import { adminAuthMiddleware } from '../../middleware/auth.js'
import { createStatsService } from './service.js'

const statsService = createStatsService({ db })

export const statsRouter = new Hono()
  .use(adminAuthMiddleware)

  // GET /stats
  .get('/', async (c) => {
    const stats = await statsService.overview()
    return c.json({ success: true, data: stats })
  })
