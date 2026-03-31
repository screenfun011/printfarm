import { z } from 'zod'

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.array(z.string())).optional(),
  }),
})

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  })

export const paginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    hasMore: z.boolean(),
  })

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ApiError = z.infer<typeof apiErrorSchema>
export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export type ApiResponse<T> =
  | { success: true; data: T }
  | z.infer<typeof apiErrorSchema>

export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_BLOCKED: 'TENANT_BLOCKED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  PRINTER_LIMIT_REACHED: 'PRINTER_LIMIT_REACHED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]
