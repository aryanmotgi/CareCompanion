/**
 * Soft delete utilities.
 * Instead of permanently deleting records, marks them with a deleted_at timestamp.
 * Records can be recovered within 30 days. After that, a cron job can hard-delete them.
 */
import { createAdminClient } from '@/lib/supabase/admin'

type SoftDeletableTable = 'medications' | 'appointments' | 'doctors' | 'documents' | 'lab_results' | 'notifications' | 'claims'

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
  const admin = createAdminClient()
  const deletedAt = new Date().toISOString()

  // Build query based on table's ownership field
  const ownershipField = ['lab_results', 'notifications', 'claims'].includes(table) ? 'user_id' : 'care_profile_id'
  const ownershipValue = ownershipField === 'user_id' ? userId : profileId

  if (!ownershipValue) {
    throw new Error('Profile ID required for profile-scoped tables')
  }

  const { error } = await admin
    .from(table)
    .update({ deleted_at: deletedAt })
    .eq('id', id)
    .eq(ownershipField, ownershipValue)

  if (error) throw error

  return { success: true, deleted_at: deletedAt }
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
  const admin = createAdminClient()

  const ownershipField = ['lab_results', 'notifications', 'claims'].includes(table) ? 'user_id' : 'care_profile_id'
  const ownershipValue = ownershipField === 'user_id' ? userId : profileId

  if (!ownershipValue) {
    throw new Error('Profile ID required for profile-scoped tables')
  }

  const { error } = await admin
    .from(table)
    .update({ deleted_at: null })
    .eq('id', id)
    .eq(ownershipField, ownershipValue)

  if (error) throw error

  return { success: true }
}

/**
 * Permanently delete records that were soft-deleted more than 30 days ago.
 * Run this from a cron job.
 */
export async function purgeExpiredRecords(): Promise<{ purged: Record<string, number> }> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const tables: SoftDeletableTable[] = ['medications', 'appointments', 'doctors', 'documents', 'lab_results', 'notifications', 'claims']
  const purged: Record<string, number> = {}

  for (const table of tables) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .lt('deleted_at', cutoff)
      .not('deleted_at', 'is', null)
      .select('id')

    if (!error && data) {
      purged[table] = data.length
    }
  }

  return { purged }
}
