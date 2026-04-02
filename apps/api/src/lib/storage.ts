import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { apiEnv } from '../env'

let _s3: S3Client | null = null

export function getS3Client(): S3Client {
  if (_s3) return _s3

  _s3 = new S3Client({
    region: apiEnv.S3_REGION,
    ...(apiEnv.S3_ACCESS_KEY_ID && apiEnv.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: apiEnv.S3_ACCESS_KEY_ID,
            secretAccessKey: apiEnv.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
    ...(apiEnv.S3_ENDPOINT ? { endpoint: apiEnv.S3_ENDPOINT, forcePathStyle: true as const } : {}),
  })

  return _s3
}

export async function uploadToS3(
  s3: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function deleteFromS3(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }))
}
