/**
 * Seed super admin account.
 * Usage: pnpm --filter @printfarm/api seed:super-admin
 *
 * Set env vars before running:
 *   SA_EMAIL=... SA_PASSWORD=... SA_FULL_NAME=... pnpm --filter @printfarm/api seed:super-admin
 */

import bcryptjs from 'bcryptjs'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { authenticator } from '../lib/totp.js'
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

const sql = postgres(databaseUrl, { max: 1 })
const db = drizzle(sql)

const passwordHash = await bcryptjs.hash(password, 12)
const totpSecret = authenticator.generateSecret()

const [admin] = await db.insert(superAdmins).values({
  email,
  passwordHash,
  fullName,
  totpSecret,
  totpEnabled: false,
}).returning({ id: superAdmins.id, email: superAdmins.email })

if (!admin) {
  console.error('Greška: super admin nije kreiran')
  await sql.end()
  process.exit(1)
}

console.log('✓ Super admin kreiran:')
console.log('  ID:    ', admin.id)
console.log('  Email: ', admin.email)
console.log('  TOTP secret (sačuvaj!):', totpSecret)

await sql.end()
