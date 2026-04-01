/**
 * Seed super admin account.
 * Usage: node --experimental-strip-types src/scripts/seed-super-admin.ts
 *
 * Set env vars before running:
 *   SA_EMAIL=... SA_PASSWORD=... SA_FULL_NAME=... node --experimental-strip-types src/scripts/seed-super-admin.ts
 */

import bcryptjs from 'bcryptjs'
import { authenticator } from 'otplib'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { superAdmins } from '@printfarm/db'

const email = process.env.SA_EMAIL
const password = process.env.SA_PASSWORD
const fullName = process.env.SA_FULL_NAME ?? 'Super Admin'
const databaseUrl = process.env.DATABASE_URL

if (!email || !password) {
  console.error('Potrebno: SA_EMAIL, SA_PASSWORD')
  process.exit(1)
}

if (!databaseUrl) {
  console.error('Potrebno: DATABASE_URL')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const db = drizzle(pool)

const passwordHash = await bcryptjs.hash(password, 12)
const totpSecret = authenticator.generateSecret()

const [admin] = await db.insert(superAdmins).values({
  email,
  passwordHash,
  fullName,
  totpSecret,
  totpEnabled: false, // može se uključiti naknadno iz admin panela
}).returning({ id: superAdmins.id, email: superAdmins.email })

console.log('✓ Super admin kreiran:')
console.log('  ID:    ', admin.id)
console.log('  Email: ', admin.email)
console.log('  TOTP secret (sačuvaj!):', totpSecret)

await pool.end()
