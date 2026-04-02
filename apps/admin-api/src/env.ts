import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ADMIN_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5174'),
})

function parseEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n')

    console.error('Admin API env greška:')
    console.error(messages)
    process.exit(1)
  }

  return result.data
}

export const adminEnv = parseEnv()
