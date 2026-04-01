import { ApiError } from './query-client'

const BASE_URL = '/api'

const TOKEN_KEY = 'printfarm_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenStorage.get()

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Server nije dostupan', 0)
  }

  let data: { success: boolean; data?: T; error?: { code: string; message: string } }
  try {
    data = await res.json()
  } catch {
    throw new ApiError('NETWORK_ERROR', `Neočekivani odgovor servera (${res.status})`, res.status)
  }

  if (!data.success) {
    throw new ApiError(data.error!.code, data.error!.message, res.status)
  }

  return data.data as T
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = tokenStorage.get()

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Server nije dostupan', 0)
  }

  let data: { success: boolean; data?: T; error?: { code: string; message: string } }
  try {
    data = await res.json()
  } catch {
    throw new ApiError('NETWORK_ERROR', `Neočekivani odgovor servera (${res.status})`, res.status)
  }

  if (!data.success) {
    throw new ApiError(data.error!.code, data.error!.message, res.status)
  }

  return data.data as T
}

// ---- Auth ----
export const authApi = {
  register: (body: { email: string; password: string; fullName: string }) =>
    request<{ token: string; user: SessionUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string; totpCode?: string }) =>
    request<{ token: string; user: SessionUser } | { requireTotp: true }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<null>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<SessionUser>('/auth/me'),
}

// ---- Printers ----
export const printersApi = {
  list: () => request<Printer[]>('/printers'),
  getById: (id: string) => request<Printer>(`/printers/${id}`),
  add: (body: AddPrinter) =>
    request<Printer>('/printers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdatePrinter) =>
    request<Printer>(`/printers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) =>
    request<null>(`/printers/${id}`, { method: 'DELETE' }),
}

// ---- Files ----
export const filesApi = {
  list: () => request<PrintFile[]>('/files'),
  getById: (id: string) => request<PrintFile>(`/files/${id}`),
  upload: (formData: FormData) => upload<PrintFile>('/files', formData),
  remove: (id: string) => request<null>(`/files/${id}`, { method: 'DELETE' }),
}

// ---- Jobs ----
export const jobsApi = {
  list: () => request<PrintJob[]>('/jobs'),
  getById: (id: string) => request<PrintJob & { assignments: JobAssignment[] }>(`/jobs/${id}`),
  create: (body: CreateJob) =>
    request<PrintJob>('/jobs', { method: 'POST', body: JSON.stringify(body) }),
  cancel: (id: string) => request<null>(`/jobs/${id}/cancel`, { method: 'PATCH' }),
  pause: (id: string) => request<null>(`/jobs/${id}/pause`, { method: 'PATCH' }),
  resume: (id: string) => request<null>(`/jobs/${id}/resume`, { method: 'PATCH' }),
  remove: (id: string) => request<null>(`/jobs/${id}`, { method: 'DELETE' }),
}

// ---- AI ----
export const aiApi = {
  listDetections: () => request<AiDetection[]>('/ai/detections'),
  takeAction: (id: string, action: 'pause' | 'cancel' | 'skip_object' | 'dismiss') =>
    request<null>(`/ai/detections/${id}/action`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
}

// ---- Local types (mirrors shared schemas) ----
export type SessionUser = {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  totpEnabled: boolean
  role: 'owner' | 'admin' | 'operator' | 'viewer'
  tenantId: string
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

export type Printer = {
  id: string
  name: string
  model: string
  serialNumber: string
  ipAddress: string
  status: string
  isActive: boolean
  lastSeenAt: string | null
  createdAt: string
}

export type AddPrinter = {
  name: string
  model: string
  serialNumber: string
  ipAddress: string
  accessCode: string
}

export type UpdatePrinter = {
  name?: string
  isActive?: boolean
}

export type PrintFile = {
  id: string
  name: string
  originalFilename: string
  fileSizeBytes: number
  fileHash: string
  thumbnailPath: string | null
  metadata: Record<string, unknown> | null
  uploadedBy: string
  createdAt: string
}

export type PrintJob = {
  id: string
  name: string
  status: string
  priority: number
  copies: number
  copiesCompleted: number
  fileId: string
  createdBy: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type JobAssignment = {
  id: string
  printerId: string
  status: string
  copyNumber: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}

export type CreateJob = {
  fileId: string
  name: string
  printerIds: string[]
  copies?: number
  priority?: number
  notes?: string
}

export type AiDetection = {
  id: string
  printerId: string
  jobAssignmentId: string | null
  detectionType: string
  confidence: number
  snapshotPath: string | null
  actionTaken: string
  resolvedAt: string | null
  createdAt: string
}
