import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _client: postgres.Sql | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    throw new Error('DATABASE_URL nije definisan')
  }

  _client = postgres(databaseUrl, {
    max: process.env['NODE_ENV'] === 'test' ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  _db = drizzle(_client, { schema })
  return _db
}

export async function closeDb() {
  if (_client) {
    await _client.end()
    _client = null
    _db = null
  }
}

export type Database = ReturnType<typeof getDb>
