import { createHash } from 'crypto'
import { eq, and } from 'drizzle-orm'
import type { S3Client } from '@aws-sdk/client-s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { printFiles, type Database } from '@printfarm/db'
import { API_ERROR_CODES } from '@printfarm/shared/types'

export class FileServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'FileServiceError'
  }
}

const ALLOWED_EXTENSIONS = ['.3mf']
const DEFAULT_MAX_FILE_SIZE_MB = 200

type FileServiceDeps = {
  db: Database
  s3: S3Client
  bucket: string
  maxFileSizeMb?: number
}

type UploadInput = {
  name: string
  buffer: Buffer
  originalFilename: string
  fileSize: number
}

export function createFileService({ db, s3, bucket, maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB }: FileServiceDeps) {
  function getExtension(filename: string): string {
    const idx = filename.lastIndexOf('.')
    return idx === -1 ? '' : filename.slice(idx).toLowerCase()
  }

  async function findFile(tenantId: string, fileId: string) {
    const file = await db
      .select({
        id: printFiles.id,
        tenantId: printFiles.tenantId,
        uploadedBy: printFiles.uploadedBy,
        name: printFiles.name,
        originalFilename: printFiles.originalFilename,
        fileSizeBytes: printFiles.fileSizeBytes,
        storagePath: printFiles.storagePath,
        thumbnailPath: printFiles.thumbnailPath,
        fileHash: printFiles.fileHash,
        metadata: printFiles.metadata,
        isDeleted: printFiles.isDeleted,
        createdAt: printFiles.createdAt,
      })
      .from(printFiles)
      .where(and(
        eq(printFiles.tenantId, tenantId),
        eq(printFiles.id, fileId),
      ))
      .limit(1)
      .then(rows => rows[0] ?? null)

    if (!file || file.isDeleted) {
      throw new FileServiceError(API_ERROR_CODES.NOT_FOUND, 'Fajl nije pronađen', 404)
    }

    return file
  }

  return {
    async list(tenantId: string) {
      return db
        .select({
          id: printFiles.id,
          name: printFiles.name,
          originalFilename: printFiles.originalFilename,
          fileSizeBytes: printFiles.fileSizeBytes,
          fileHash: printFiles.fileHash,
          thumbnailPath: printFiles.thumbnailPath,
          metadata: printFiles.metadata,
          uploadedBy: printFiles.uploadedBy,
          createdAt: printFiles.createdAt,
        })
        .from(printFiles)
        .where(and(
          eq(printFiles.tenantId, tenantId),
          eq(printFiles.isDeleted, false),
        ))
        .orderBy(printFiles.createdAt)
    },

    async getById(tenantId: string, fileId: string) {
      return findFile(tenantId, fileId)
    },

    async upload(tenantId: string, userId: string, input: UploadInput) {
      const ext = getExtension(input.originalFilename)
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new FileServiceError(
          'INVALID_FILE_TYPE',
          `Dozvoljeni tipovi fajlova: ${ALLOWED_EXTENSIONS.join(', ')}`,
          415,
        )
      }

      const maxBytes = maxFileSizeMb * 1024 * 1024
      if (input.fileSize > maxBytes) {
        throw new FileServiceError(
          'FILE_TOO_LARGE',
          `Maksimalna veličina fajla je ${maxFileSizeMb}MB`,
          413,
        )
      }

      const fileHash = createHash('sha256').update(input.buffer).digest('hex')
      const storagePath = `${tenantId}/${fileHash}.3mf`

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: storagePath,
        Body: input.buffer,
        ContentType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
      }))

      const [file] = await db
        .insert(printFiles)
        .values({
          tenantId,
          uploadedBy: userId,
          name: input.name,
          originalFilename: input.originalFilename,
          fileSizeBytes: input.fileSize,
          storagePath,
          fileHash,
        })
        .returning({
          id: printFiles.id,
          name: printFiles.name,
          originalFilename: printFiles.originalFilename,
          fileSizeBytes: printFiles.fileSizeBytes,
          fileHash: printFiles.fileHash,
          storagePath: printFiles.storagePath,
          createdAt: printFiles.createdAt,
        })

      if (!file) throw new FileServiceError('INTERNAL_ERROR', 'Greška pri čuvanju fajla', 500)
      return file
    },

    async remove(tenantId: string, fileId: string) {
      await findFile(tenantId, fileId)

      await db
        .update(printFiles)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(
          eq(printFiles.tenantId, tenantId),
          eq(printFiles.id, fileId),
        ))
    },
  }
}

export type FileService = ReturnType<typeof createFileService>
