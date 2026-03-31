import { z } from 'zod'

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET mora biti minimum 32 karaktera'),
})

const cloudEnvSchema = baseEnvSchema.extend({
  DEPLOYMENT_MODE: z.literal('cloud'),
  REDIS_URL: z.string().url(),
  JWT_ADMIN_SECRET: z.string().min(32, 'JWT_ADMIN_SECRET mora biti minimum 32 karaktera'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(),
})

const localEnvSchema = baseEnvSchema.extend({
  DEPLOYMENT_MODE: z.literal('local'),
  CLOUD_CONNECT_ENABLED: z.coerce.boolean().default(false),
  CLOUD_CONNECT_API_KEY: z.string().optional(),
  CLOUD_CONNECT_URL: z.string().url().optional(),
})

const envSchema = z.discriminatedUnion('DEPLOYMENT_MODE', [
  cloudEnvSchema,
  localEnvSchema,
])

function parseEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n')

    console.error('Greška u konfiguraciji — aplikacija se ne može pokrenuti:')
    console.error(messages)
    process.exit(1)
  }

  return result.data
}

export const env = parseEnv()
export type Env = typeof env
export type DeploymentMode = Env['DEPLOYMENT_MODE']
