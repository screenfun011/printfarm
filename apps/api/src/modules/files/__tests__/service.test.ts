import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFileService, FileServiceError } from '../service'
import type { Database } from '@printfarm/db'
import type { S3Client } from '@aws-sdk/client-s3'

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'
const USER_ID   = '550e8400-e29b-41d4-a716-446655440001'
const FILE_ID   = '550e8400-e29b-41d4-a716-446655440002'
const BUCKET    = 'test-bucket'

const mockFile = {
  id: FILE_ID,
  tenantId: TENANT_ID,
  uploadedBy: USER_ID,
  name: 'Benchy',
  originalFilename: 'benchy.3mf',
  fileSizeBytes: 1024000,
  storagePath: `${TENANT_ID}/abc123.3mf`,
  thumbnailPath: null,
  fileHash: 'a'.repeat(64),
  metadata: null,
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
}

function makeDb(queryResults: unknown[][]): Database {
  let callIndex = 0

  function queryChain() {
    const results = queryResults[callIndex++] ?? []
    const chain: Record<string, unknown> = {}
    const methods = [
      'select', 'insert', 'update', 'delete',
      'from', 'where', 'limit', 'orderBy',
      'set', 'values', 'returning',
    ]
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain['returning'] = vi.fn().mockResolvedValue(results)
    chain['then'] = vi.fn().mockImplementation(
      (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(results)),
    )
    return chain
  }

  const db = {
    select: vi.fn().mockImplementation(queryChain),
    insert: vi.fn().mockImplementation(queryChain),
    update: vi.fn().mockImplementation(queryChain),
    delete: vi.fn().mockImplementation(queryChain),
  }

  return db as unknown as Database
}

function makeS3(): S3Client {
  return { send: vi.fn().mockResolvedValue({}) } as unknown as S3Client
}

const uploadData = {
  name: 'Benchy',
  buffer: Buffer.from('fake-3mf-content'),
  originalFilename: 'benchy.3mf',
  fileSize: 1024000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fileService.list', () => {
  it('vraća listu fajlova za tenant', async () => {
    const db = makeDb([[mockFile]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    const result = await service.list(TENANT_ID)
    expect(db.select).toHaveBeenCalled()
    expect(Array.isArray(result)).toBe(true)
  })

  it('vraća praznu listu ako nema fajlova', async () => {
    const db = makeDb([[]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    const result = await service.list(TENANT_ID)
    expect(result).toHaveLength(0)
  })
})

describe('fileService.getById', () => {
  it('vraća fajl ako postoji', async () => {
    const db = makeDb([[mockFile]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    const result = await service.getById(TENANT_ID, FILE_ID)
    expect(result.id).toBe(FILE_ID)
  })

  it('baca 404 ako fajl ne postoji', async () => {
    const db = makeDb([[]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    await expect(service.getById(TENANT_ID, FILE_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('baca 404 ako je fajl obrisan', async () => {
    const db = makeDb([[{ ...mockFile, isDeleted: true }]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    await expect(service.getById(TENANT_ID, FILE_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('fileService.upload', () => {
  it('uploaduje fajl na S3 i kreira DB zapis', async () => {
    const s3 = makeS3()
    const db = makeDb([[mockFile]])
    const service = createFileService({ db, s3, bucket: BUCKET })
    const result = await service.upload(TENANT_ID, USER_ID, uploadData)
    expect(s3.send).toHaveBeenCalledTimes(1)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(result.id).toBe(FILE_ID)
  })

  it('baca 415 za fajl koji nije .3mf', async () => {
    const service = createFileService({ db: makeDb([]), s3: makeS3(), bucket: BUCKET })
    await expect(
      service.upload(TENANT_ID, USER_ID, { ...uploadData, originalFilename: 'test.stl' }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE', status: 415 })
  })

  it('baca 413 ako je fajl prevelik', async () => {
    const service = createFileService({ db: makeDb([]), s3: makeS3(), bucket: BUCKET, maxFileSizeMb: 1 })
    await expect(
      service.upload(TENANT_ID, USER_ID, { ...uploadData, fileSize: 2 * 1024 * 1024 }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', status: 413 })
  })

  it('baca 500 ako S3 upload ne uspe', async () => {
    const s3 = { send: vi.fn().mockRejectedValue(new Error('S3 error')) } as unknown as S3Client
    const service = createFileService({ db: makeDb([]), s3, bucket: BUCKET })
    await expect(service.upload(TENANT_ID, USER_ID, uploadData)).rejects.toThrow()
  })
})

describe('fileService.remove', () => {
  it('soft-delete-uje fajl (isDeleted=true)', async () => {
    const db = makeDb([[mockFile], []])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    await service.remove(TENANT_ID, FILE_ID)
    expect(db.update).toHaveBeenCalled()
  })

  it('baca 404 ako fajl ne postoji', async () => {
    const db = makeDb([[]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    await expect(service.remove(TENANT_ID, FILE_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('baca 404 ako je fajl već obrisan', async () => {
    const db = makeDb([[{ ...mockFile, isDeleted: true }]])
    const service = createFileService({ db, s3: makeS3(), bucket: BUCKET })
    await expect(service.remove(TENANT_ID, FILE_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('FileServiceError', () => {
  it('ima code, message, status i name', () => {
    const err = new FileServiceError('TEST', 'poruka', 422)
    expect(err.code).toBe('TEST')
    expect(err.message).toBe('poruka')
    expect(err.status).toBe(422)
    expect(err.name).toBe('FileServiceError')
    expect(err instanceof Error).toBe(true)
  })

  it('default status je 400', () => {
    const err = new FileServiceError('CODE', 'msg')
    expect(err.status).toBe(400)
  })
})
