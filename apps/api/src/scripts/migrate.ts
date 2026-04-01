/**
 * Pokretanje DB migracija.
 * Usage: node --env-file .env --experimental-strip-types src/scripts/migrate.ts
 */

import { runMigrations } from '@printfarm/db/migrator'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  console.error('DATABASE_URL nije definisan')
  process.exit(1)
}

console.log('Pokretanje DB migracija...')
await runMigrations(databaseUrl)
console.log('✓ Migracije primenjene')
