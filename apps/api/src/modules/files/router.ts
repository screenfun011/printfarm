import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { tenantMiddleware } from '../../middleware/tenant'
import { db } from '../../lib/db'
import { getS3Client } from '../../lib/storage'
import { apiEnv } from '../../env'
import { createFileService, FileServiceError } from './service'

const fileService = createFileService({
  db,
  s3: getS3Client(),
  bucket: apiEnv.S3_BUCKET ?? '',
  maxFileSizeMb: apiEnv.MAX_FILE_SIZE_MB,
})

const idParam = zValidator('param', z.object({ id: z.string().uuid() }))

export const filesRouter = new Hono()
  .use(authMiddleware)
  .use(tenantMiddleware)

  // GET /files
  .get('/', async (c) => {
    const tenantId = c.get('tenantId')
    const list = await fileService.list(tenantId)
    return c.json({ success: true, data: list })
  })

  // GET /files/:id
  .get('/:id', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      const file = await fileService.getById(tenantId, id)
      return c.json({ success: true, data: file })
    } catch (err) {
      if (err instanceof FileServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404)
      }
      throw err
    }
  })

  // POST /files  (multipart/form-data: file + name)
  .post('/', async (c) => {
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')

    const body = await c.req.parseBody()
    const file = body['file']
    const name = body['name']

    if (!(file instanceof File)) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Fajl nije prosleđen' } }, 400)
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Naziv fajla je obavezan' } }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    try {
      const result = await fileService.upload(tenantId, userId, {
        name: name.trim(),
        buffer,
        originalFilename: file.name,
        fileSize: file.size,
      })
      return c.json({ success: true, data: result }, 201)
    } catch (err) {
      if (err instanceof FileServiceError) {
        return c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as 413 | 415,
        )
      }
      throw err
    }
  })

  // DELETE /files/:id
  .delete('/:id', idParam, async (c) => {
    const tenantId = c.get('tenantId')
    const { id } = c.req.valid('param')
    try {
      await fileService.remove(tenantId, id)
      return c.json({ success: true, data: null })
    } catch (err) {
      if (err instanceof FileServiceError) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 404)
      }
      throw err
    }
  })
