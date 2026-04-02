import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { serve } from '@hono/node-server'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import { adminEnv } from './env.js'
import { closeDb } from './lib/db.js'
import { defaultRateLimit } from './middleware/rate-limit.js'
import { authRouter } from './modules/auth/router.js'
import { tenantsRouter } from './modules/tenants/router.js'
import { statsRouter } from './modules/stats/router.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: adminEnv.CORS_ORIGINS.split(','),
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use('*', defaultRateLimit)

app.get('/health', (c) => c.json({ status: 'ok', service: 'admin-api' }))

app.route('/auth', authRouter)
app.route('/tenants', tenantsRouter)
app.route('/stats', statsRouter)

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    try {
      const body = JSON.parse(err.message)
      return c.json(body, err.status)
    } catch {
      return c.json({
        success: false,
        error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: err.message },
      }, err.status)
    }
  }

  console.error('Neočekivana greška:', err)
  return c.json({
    success: false,
    error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'Interna greška servera' },
  }, 500)
})

app.notFound((c) => c.json({
  success: false,
  error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Ruta ne postoji' },
}, 404))

serve({
  fetch: app.fetch,
  port: adminEnv.PORT,
}, (info) => {
  console.log(`PrintFarm Admin API pokrenut na portu ${info.port}`)
})

const shutdown = async () => {
  await closeDb()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export default app
