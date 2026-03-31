import { z } from 'zod'

export const uploadFileSchema = z.object({
  name: z.string().min(1).max(255),
})

export type UploadFile = z.infer<typeof uploadFileSchema>
