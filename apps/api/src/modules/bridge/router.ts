import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../lib/db'
import { apiEnv } from '../../env'
import { createBridgeService, BridgeServiceError } from './service'
import { API_ERROR_CODES } from '@printfarm/shared/types'

const bridgeStatusSchema = z.object({
  state: z.enum(['idle', 'printing', 'paused', 'completed', 'failed']),
  progress: z.number().int().min(0).max(100),
  remainingMinutes: z.number().int().min(0),
  layerCurrent: z.number().int().min(0),
  layerTotal: z.number().int().min(0),
  nozzleTemp: z.number(),
  nozzleTarget: z.number(),
  bedTemp: z.number(),
  bedTarget: z.number(),
  subtaskName: z.string(),
})

function bridgeAuth(c: any): boolean {
  const authHeader = c.req.header('Authorization') as string | undefined
  if (!authHeader?.startsWith('Bearer ')) return false
  return authHeader.slice(7) === apiEnv.BRIDGE_TOKEN
}

export const bridgeRouter = new Hono()

// Middleware: validate bridge token
bridgeRouter.use('*', async (c, next) => {
  if (!bridgeAuth(c)) {
    return c.json({
      success: false,
      error: { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Invalid bridge token' },
    }, 401)
  }
  await next()
})

// POST /bridge/printers/:id/status
bridgeRouter.post(
  '/printers/:id/status',
  zValidator('json', bridgeStatusSchema),
  async (c) => {
    const { id } = c.req.param()
    const payload = c.req.valid('json')
    const svc = createBridgeService({ db })

    try {
      await svc.reportStatus(id, payload)
      return c.json({ success: true, data: null })
    } catch (err) {
      if (err instanceof BridgeServiceError) {
        return c.json({
          success: false,
          error: { code: err.code, message: err.message },
        }, err.status as any)
      }
      throw err
    }
  },
)

// POST /bridge/printers/:id/frame  (JPEG frame for AI)
bridgeRouter.post('/printers/:id/frame', async (c) => {
  // Frame is forwarded to AI service — stored in object storage
  // For now: accept and acknowledge (AI service integration in ai-service)
  return c.json({ success: true, data: { queued: true } })
})

// GET /bridge/printers  (bridge polls this on startup to get printer list)
bridgeRouter.get('/printers', async (c) => {
  const svc = createBridgeService({ db })
  const printers = await svc.getActivePrinters()
  return c.json({ success: true, data: printers })
})
