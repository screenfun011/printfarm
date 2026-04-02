import { eq, count } from 'drizzle-orm'
import { tenants, users, printers } from '@printfarm/db/schema'
import type { Database } from '../../lib/db.js'

type ServiceDeps = { db: Database }

export function createStatsService({ db }: ServiceDeps) {
  return {
    async overview() {
      // Tenants
      const [totalTenantsRow] = await db.select({ value: count() }).from(tenants).limit(1)
      const [activeTenantsRow] = await db.select({ value: count() }).from(tenants)
        .where(eq(tenants.status, 'active')).limit(1)
      const [trialTenantsRow] = await db.select({ value: count() }).from(tenants)
        .where(eq(tenants.status, 'trial')).limit(1)

      // Users
      const [totalUsersRow] = await db.select({ value: count() }).from(users).limit(1)

      // Printers
      const [totalPrintersRow] = await db.select({ value: count() }).from(printers).limit(1)

      return {
        tenants: {
          total: (totalTenantsRow as { value: number } | undefined)?.value ?? 0,
          active: (activeTenantsRow as { value: number } | undefined)?.value ?? 0,
          trial: (trialTenantsRow as { value: number } | undefined)?.value ?? 0,
        },
        users: {
          total: (totalUsersRow as { value: number } | undefined)?.value ?? 0,
        },
        printers: {
          total: (totalPrintersRow as { value: number } | undefined)?.value ?? 0,
        },
      }
    },
  }
}

export type StatsService = ReturnType<typeof createStatsService>
