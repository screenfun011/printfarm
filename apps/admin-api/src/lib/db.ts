import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@printfarm/db/schema'
import { adminEnv } from '../env.js'

const sql = postgres(adminEnv.DATABASE_URL)
export const db = drizzle(sql, { schema })

export type Database = typeof db

export async function closeDb() {
  await sql.end()
}
