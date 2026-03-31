import { getDb, closeDb as closeDbConnection } from '@printfarm/db'

export const db = getDb()
export type { Database } from '@printfarm/db'

export async function closeDb(): Promise<void> {
  await closeDbConnection()
}
