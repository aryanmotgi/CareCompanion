/**
 * Soft delete utilities.
 * Instead of permanently deleting records, marks them with a deleted_at timestamp.
 * Records can be recovered within 30 days. After that, a cron job can hard-delete them.
 */
import { db } from '@/lib/db'
import { medications, appointments, doctors, documents, labResults, notifications, claims } from '@/lib/db/schema'
import { eq, and, lt, isNotNull } from 'drizzle-orm'

type SoftDeletableTable = 'medications' | 'appointments' | 'doctors' | 'documents' | 'lab_results' | 'notifications' | 'claims'

// Map table name strings to Drizzle table objects
const tableMap = {
  medications,
  appointments,
  doctors,
  documents,
  lab_results: labResults,
  notifications,
  claims,
} as const

// Tables that are owned by user_id vs care_profile_id
const userOwnedTables = new Set<SoftDeletableTable>(['lab_results', 'notifications', 'claims'])

/**
 * Soft delete a record by setting deleted_at timestamp.
 * Returns the deleted record for undo UI.
 */
export async function softDelete(
  table: SoftDeletableTable,
  id: string,
  userId: string,
  profileId?: string,
): Promise<{ success: boolean; deleted_at: string }> {
  const deletedAt = new Date()
  const isUserOwned = userOwnedTables.has(table)
  const tbl = tableMap[table]

  if (!isUserOwned && !profileId) {
    throw new Error('Profile ID required for profile-scoped tables')
  }

  // Build the where condition dynamically
  // All soft-deletable tables have id, userId or careProfileId, and deletedAt
  // We cast to any to allow dynamic access; the ownership logic is enforced above
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tblAny = tbl as any
  const ownerCondition = isUserOwned
    ? eq(tblAny.userId, userId)
    : eq(tblAny.careProfileId, profileId!)

  await db
    .update(tbl)
    .set({ deletedAt } as never)
    .where(and(eq(tblAny.id, id), ownerCondition))

  return { success: true, deleted_at: deletedAt.toISOString() }
}

/**
 * Restore a soft-deleted record by clearing deleted_at.
 */
export async function restore(
  table: SoftDeletableTable,
  id: string,
  userId: string,
  profileId?: string,
): Promise<{ success: boolean }> {
  const isUserOwned = userOwnedTables.has(table)
  const tbl = tableMap[table]

  if (!isUserOwned && !profileId) {
    throw new Error('Profile ID required for profile-scoped tables')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tblAny = tbl as any
  const ownerCondition = isUserOwned
    ? eq(tblAny.userId, userId)
    : eq(tblAny.careProfileId, profileId!)

  await db
    .update(tbl)
    .set({ deletedAt: null } as never)
    .where(and(eq(tblAny.id, id), ownerCondition))

  return { success: true }
}

/**
 * Permanently delete records that were soft-deleted more than 30 days ago.
 * Run this from a cron job.
 */
export async function purgeExpiredRecords(): Promise<{ purged: Record<string, number> }> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const tables: SoftDeletableTable[] = ['medications', 'appointments', 'doctors', 'documents', 'lab_results', 'notifications', 'claims']
  const purged: Record<string, number> = {}

  for (const tableName of tables) {
    const tbl = tableMap[tableName]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tblAny = tbl as any
    const deleted = await db
      .delete(tbl)
      .where(and(lt(tblAny.deletedAt, cutoff), isNotNull(tblAny.deletedAt)))
      .returning({ id: tblAny.id })

    purged[tableName] = deleted.length
  }

  return { purged }
}
