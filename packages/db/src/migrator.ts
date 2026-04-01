import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function runMigrations(databaseUrl: string): Promise<void> {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const migrationsFolder = resolve(__dirname, './migrations')

  const sql = postgres(databaseUrl, { max: 1 })
  const db = drizzle(sql)

  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await sql.end()
  }
}
