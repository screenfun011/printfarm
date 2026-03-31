import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { serve } from '@hono/node-server'
import { createServer } from 'node:http'
import { features } from '@printfarm/config/features'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import { apiEnv } from './env'
import { defaultRateLimit } from './middleware/rate-limit'
import { authRouter } from './modules/auth/router'
import { filesRouter } from './modules/files/router'
import { jobsRouter } from './modules/jobs/router'
import { printersRouter } from './modules/printers/router'
import { createWsServer } from './ws/server'
import { closeDb } from './lib/db'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: apiEnv.CORS_ORIGINS.split(','),
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use('*', defaultRateLimit)

app.get('/health', (c) => c.json({
  status: 'ok',
  mode: apiEnv.DEPLOYMENT_MODE,
  features: {
    billing: features.billing,
    multiTenant: features.multiTenant,
    aiDetection: true,
  },
}))

app.route('/auth', authRouter)
app.route('/files', filesRouter)
app.route('/jobs', jobsRouter)
app.route('/printers', printersRouter)

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

const httpServer = createServer()

serve({
  fetch: app.fetch,
  port: apiEnv.PORT,
  serverOptions: {},
}, (info) => {
  console.log(`PrintFarm API pokrenut na portu ${info.port} [${apiEnv.DEPLOYMENT_MODE}]`)
})

createWsServer(httpServer)

const shutdown = async () => {
  console.log('Gašenje servera...')
  await closeDb()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export default app
