import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validacija', () => {
  const originalEnv = process.env
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit pozvan')
  })

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    mockExit.mockClear()
  })

  describe('cloud mode', () => {
    it('prolazi sa svim validnim cloud env var', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'cloud',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ADMIN_SECRET: 'b'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        RESEND_API_KEY: 're_123',
        S3_BUCKET: 'printfarm',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
        NODE_ENV: 'test',
        PORT: '3000',
      }

      const { env } = await import('../env')
      expect(env.DEPLOYMENT_MODE).toBe('cloud')
      expect(env.NODE_ENV).toBe('test')
    })

    it('crasha ako JWT_SECRET je kratak od 32 karaktera', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'cloud',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'kratko',
      }

      await expect(import('../env')).rejects.toThrow('process.exit pozvan')
    })

    it('crasha ako STRIPE_SECRET_KEY nema sk_ prefiks', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'cloud',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ADMIN_SECRET: 'b'.repeat(32),
        STRIPE_SECRET_KEY: 'invalid_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        RESEND_API_KEY: 're_123',
        S3_BUCKET: 'printfarm',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
      }

      await expect(import('../env')).rejects.toThrow('process.exit pozvan')
    })
  })

  describe('local mode', () => {
    it('prolazi sa minimalnim local env var', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'local',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'a'.repeat(32),
        NODE_ENV: 'test',
      }

      const { env } = await import('../env')
      expect(env.DEPLOYMENT_MODE).toBe('local')
      expect(env.CLOUD_CONNECT_ENABLED).toBe(false)
    })

    it('ne zahteva Stripe var u local mode', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'local',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'a'.repeat(32),
      }

      await expect(import('../env')).resolves.toBeDefined()
    })

    it('PORT ima default vrednost 3000', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'local',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'a'.repeat(32),
      }

      const { env } = await import('../env')
      expect(env.PORT).toBe(3000)
    })
  })

  describe('nepoznat DEPLOYMENT_MODE', () => {
    it('crasha za nepoznat mode', async () => {
      process.env = {
        DEPLOYMENT_MODE: 'staging',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'a'.repeat(32),
      }

      await expect(import('../env')).rejects.toThrow('process.exit pozvan')
    })
  })
})
