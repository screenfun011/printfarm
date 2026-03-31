import { Redis } from 'ioredis'
import { apiEnv } from '../env'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (_redis) return _redis

  if (!apiEnv.REDIS_URL) {
    throw new Error('REDIS_URL nije definisan')
  }

  _redis = new Redis(apiEnv.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  })

  _redis.on('error', (err) => {
    console.error('Redis greška:', err.message)
  })

  return _redis
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit()
    _redis = null
  }
}
