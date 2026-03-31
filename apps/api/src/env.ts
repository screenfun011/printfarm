import { z } from 'zod'

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DEPLOYMENT_MODE: z.enum(['cloud', 'local']).default('cloud'),
})

function parseApiEnv() {
  const result = apiEnvSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n')

    console.error('API env greška:')
    console.error(messages)
    process.exit(1)
  }

  return result.data
}

export const apiEnv = parseApiEnv()
