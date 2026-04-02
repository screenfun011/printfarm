import { eq, count } from 'drizzle-orm'
import { tenants, tenantUsers, tenantStatusEnum } from '@printfarm/db/schema'
import type { Database } from '../../lib/db.js'

export class TenantsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'TenantsServiceError'
  }
}

type TenantStatus = typeof tenantStatusEnum.enumValues[number]

type ListOptions = {
  status?: TenantStatus
  limit?: number
  offset?: number
}

type ServiceDeps = { db: Database }

export function createTenantsService({ db }: ServiceDeps) {
  return {
    async list({ status, limit = 50, offset = 0 }: ListOptions) {
      const rows = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          status: tenants.status,
          trialEndsAt: tenants.trialEndsAt,
          createdAt: tenants.createdAt,
          userCount: count(tenantUsers.id),
        })
        .from(tenants)
        .leftJoin(tenantUsers, eq(tenantUsers.tenantId, tenants.id))
        .groupBy(tenants.id)
        .orderBy(tenants.createdAt)
        .offset(offset)

      const filtered = status ? rows.filter(r => r.status === status) : rows

      return filtered.slice(0, limit).map(r => ({
        ...r,
        trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }))
    },

    async getById(tenantId: string) {
      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          status: tenants.status,
          trialEndsAt: tenants.trialEndsAt,
          createdAt: tenants.createdAt,
          userCount: count(tenantUsers.id),
        })
        .from(tenants)
        .leftJoin(tenantUsers, eq(tenantUsers.tenantId, tenants.id))
        .groupBy(tenants.id)
        .where(eq(tenants.id, tenantId))
        .limit(1)

      if (!tenant) {
        throw new TenantsServiceError('NOT_FOUND', 'Tenant nije pronađen', 404)
      }

      return {
        ...tenant,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        createdAt: tenant.createdAt.toISOString(),
      }
    },

    async updateStatus(tenantId: string, status: TenantStatus) {
      const [updated] = await db
        .update(tenants)
        .set({ status, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          status: tenants.status,
          trialEndsAt: tenants.trialEndsAt,
          createdAt: tenants.createdAt,
        })

      if (!updated) {
        throw new TenantsServiceError('NOT_FOUND', 'Tenant nije pronađen', 404)
      }

      return {
        ...updated,
        trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      }
    },
  }
}

export type TenantsService = ReturnType<typeof createTenantsService>
