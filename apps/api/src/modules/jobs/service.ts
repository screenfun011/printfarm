import { eq, and, inArray } from 'drizzle-orm'
import { printJobs, printFiles, jobPrinterAssignments, printers, type Database } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'
import type { CreateJob } from '@printfarm/shared/schemas/job'

export class JobServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'JobServiceError'
  }
}

const CANCELLABLE_STATUSES = ['queued', 'preparing', 'printing', 'paused'] as const

type JobServiceDeps = { db: Database }

export function createJobService({ db }: JobServiceDeps) {
  async function findJob(tenantId: string, jobId: string) {
    const job = await db
      .select({
        id: printJobs.id,
        tenantId: printJobs.tenantId,
        fileId: printJobs.fileId,
        createdBy: printJobs.createdBy,
        name: printJobs.name,
        status: printJobs.status,
        priority: printJobs.priority,
        copies: printJobs.copies,
        copiesCompleted: printJobs.copiesCompleted,
        notes: printJobs.notes,
        startedAt: printJobs.startedAt,
        completedAt: printJobs.completedAt,
        createdAt: printJobs.createdAt,
      })
      .from(printJobs)
      .where(and(
        eq(printJobs.tenantId, tenantId),
        eq(printJobs.id, jobId),
      ))
      .limit(1)
      .then(rows => rows[0] ?? null)

    if (!job) {
      throw new JobServiceError(API_ERROR_CODES.NOT_FOUND, 'Job nije pronađen', 404)
    }

    return job
  }

  return {
    async list(tenantId: string) {
      return db
        .select({
          id: printJobs.id,
          name: printJobs.name,
          status: printJobs.status,
          priority: printJobs.priority,
          copies: printJobs.copies,
          copiesCompleted: printJobs.copiesCompleted,
          fileId: printJobs.fileId,
          createdBy: printJobs.createdBy,
          startedAt: printJobs.startedAt,
          completedAt: printJobs.completedAt,
          createdAt: printJobs.createdAt,
        })
        .from(printJobs)
        .where(eq(printJobs.tenantId, tenantId))
        .orderBy(printJobs.createdAt)
    },

    async getById(tenantId: string, jobId: string) {
      const job = await findJob(tenantId, jobId)

      const assignments = await db
        .select({
          id: jobPrinterAssignments.id,
          printerId: jobPrinterAssignments.printerId,
          status: jobPrinterAssignments.status,
          copyNumber: jobPrinterAssignments.copyNumber,
          errorMessage: jobPrinterAssignments.errorMessage,
          startedAt: jobPrinterAssignments.startedAt,
          completedAt: jobPrinterAssignments.completedAt,
        })
        .from(jobPrinterAssignments)
        .where(eq(jobPrinterAssignments.jobId, jobId))

      return { ...job, assignments }
    },

    async create(tenantId: string, userId: string, data: CreateJob) {
      // Verify file exists and belongs to tenant
      const file = await db
        .select({ id: printFiles.id })
        .from(printFiles)
        .where(and(
          eq(printFiles.tenantId, tenantId),
          eq(printFiles.id, data.fileId),
          eq(printFiles.isDeleted, false),
        ))
        .limit(1)
        .then(rows => rows[0] ?? null)

      if (!file) {
        throw new JobServiceError(API_ERROR_CODES.NOT_FOUND, 'Fajl nije pronađen', 404)
      }

      // Verify all printers exist and belong to tenant
      const foundPrinters = await db
        .select({ id: printers.id })
        .from(printers)
        .where(and(
          eq(printers.tenantId, tenantId),
          eq(printers.isActive, true),
          inArray(printers.id, data.printerIds),
        ))

      if (foundPrinters.length === 0) {
        throw new JobServiceError('PRINTER_NOT_FOUND', 'Printeri nisu pronađeni', 404)
      }

      if (foundPrinters.length !== data.printerIds.length) {
        throw new JobServiceError('PRINTER_NOT_FOUND', 'Jedan ili više printera nisu pronađeni', 422)
      }

      // Create job
      const [job] = await db
        .insert(printJobs)
        .values({
          tenantId,
          fileId: data.fileId,
          createdBy: userId,
          name: data.name,
          copies: data.copies ?? 1,
          priority: data.priority ?? 0,
          notes: data.notes ?? null,
        })
        .returning({
          id: printJobs.id,
          name: printJobs.name,
          status: printJobs.status,
          copies: printJobs.copies,
          priority: printJobs.priority,
          createdAt: printJobs.createdAt,
        })

      // Create assignments round-robin across printers
      const copies = data.copies ?? 1
      const assignmentValues = Array.from({ length: copies }, (_, i) => ({
        jobId: job.id,
        printerId: data.printerIds[i % data.printerIds.length]!,
        tenantId,
        copyNumber: i + 1,
      }))

      await db.insert(jobPrinterAssignments).values(assignmentValues)

      return job
    },

    async cancel(tenantId: string, jobId: string) {
      const job = await findJob(tenantId, jobId)

      if (!(CANCELLABLE_STATUSES as readonly string[]).includes(job.status)) {
        throw new JobServiceError(
          'JOB_NOT_CANCELLABLE',
          `Job u statusu '${job.status}' ne može biti otkazan`,
          409,
        )
      }

      await db
        .update(printJobs)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.id, jobId),
        ))
    },

    async pause(tenantId: string, jobId: string) {
      const job = await findJob(tenantId, jobId)

      if (job.status !== 'printing') {
        throw new JobServiceError(
          'JOB_NOT_PAUSABLE',
          `Job u statusu '${job.status}' ne može biti pauziran`,
          409,
        )
      }

      await db
        .update(printJobs)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.id, jobId),
        ))
    },

    async resume(tenantId: string, jobId: string) {
      const job = await findJob(tenantId, jobId)

      if (job.status !== 'paused') {
        throw new JobServiceError(
          'JOB_NOT_RESUMABLE',
          `Job u statusu '${job.status}' ne može biti nastavljen`,
          409,
        )
      }

      await db
        .update(printJobs)
        .set({ status: 'queued', updatedAt: new Date() })
        .where(and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.id, jobId),
        ))
    },

    async remove(tenantId: string, jobId: string) {
      const job = await findJob(tenantId, jobId)

      const deletableStatuses = ['completed', 'canceled', 'failed']
      if (!deletableStatuses.includes(job.status)) {
        throw new JobServiceError(
          'JOB_NOT_DELETABLE',
          `Job u statusu '${job.status}' ne može biti obrisan`,
          409,
        )
      }

      await db
        .delete(printJobs)
        .where(and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.id, jobId),
        ))
    },
  }
}

export type JobService = ReturnType<typeof createJobService>
