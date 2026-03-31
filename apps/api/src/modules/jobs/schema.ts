import { z } from 'zod'
export { createJobSchema, jobStatusSchema } from '@printfarm/shared/schemas/job'
export type { CreateJob, JobStatus } from '@printfarm/shared/schemas/job'

export const jobActionSchema = z.object({
  action: z.enum(['cancel', 'pause', 'resume']),
})

export type JobAction = z.infer<typeof jobActionSchema>
