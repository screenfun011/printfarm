import { z } from 'zod'
export { registerSchema, loginSchema } from '@printfarm/shared/schemas/user'
export type { Register, Login } from '@printfarm/shared/schemas/user'

export const totpVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'TOTP kod mora biti 6 cifara'),
})

export type TotpVerify = z.infer<typeof totpVerifySchema>
