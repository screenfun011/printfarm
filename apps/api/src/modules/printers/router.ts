import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { addPrinterSchema, updatePrinterSchema } from '@printfarm/shared/schemas/printer'
import { authMiddleware } from '../../middleware/auth'
import { tenantMiddleware } from '../../middleware/tenant'
import { db } from '../../lib/db'
import { createPrinterService, PrinterServiceError } from './service'

const printerService = createPrinterService({ db })

export const printersRouter = new Hono()
  .use(authMiddleware)
  .use(tenantMiddleware)

  .get('/', async (c) => {
    const tenantId = c.get('tenantId')
    const list = await printerService.list(tenantId)
    return c.json({ success: true, data: list })
  })

  .get('/:id', zValidator('param', z.object({ id: z.string().uuid() })), async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')

    try {
      const printer = await printerService.getById(tenantId, id)
      return c.json({ success: true, data: printer })
    } catch (err) {
      if (err instanceof PrinterServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404)
      }
      throw err
    }
  })

  .post('/', zValidator('json', addPrinterSchema), async (c) => {
    const tenantId = c.get('tenantId')
    const data = c.req.valid('json')

    try {
      const printer = await printerService.add(tenantId, data)
      return c.json({ success: true, data: printer }, 201)
    } catch (err) {
      if (err instanceof PrinterServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 403 | 409)
      }
      throw err
    }
  })

  .patch('/:id', zValidator('param', z.object({ id: z.string().uuid() })), zValidator('json', updatePrinterSchema), async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    try {
      const printer = await printerService.update(tenantId, id, data)
      return c.json({ success: true, data: printer })
    } catch (err) {
      if (err instanceof PrinterServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404)
      }
      throw err
    }
  })

  .delete('/:id', zValidator('param', z.object({ id: z.string().uuid() })), async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')

    try {
      await printerService.remove(tenantId, id)
      return c.json({ success: true, data: null })
    } catch (err) {
      if (err instanceof PrinterServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404)
      }
      throw err
    }
  })
