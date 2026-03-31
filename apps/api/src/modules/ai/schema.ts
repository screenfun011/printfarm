import { z } from 'zod'
export { detectionTypeSchema } from '@printfarm/shared/schemas/ai'

export const actionParamSchema = z.object({
  action: z.enum(['pause', 'cancel', 'skip_object', 'dismiss']),
})

export type ActionParam = z.infer<typeof actionParamSchema>
