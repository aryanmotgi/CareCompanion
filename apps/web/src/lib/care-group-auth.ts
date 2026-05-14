import { db } from '@/lib/db'
import { careGroups, careGroupMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

type CareGroupRow = typeof careGroups.$inferSelect
type UserRow = typeof users.$inferSelect

type CareGroupAuthResult =
  | { ok: true; user: UserRow; group: CareGroupRow }
  | { ok: false; reason: 'missing' | 'invalid' | 'no_owner' | 'no_user' }

/**
 * Shared care-group credential verifier used by both the NextAuth Credentials
 * provider (web) and the /api/auth/mobile-care-group-login REST route (mobile).
 *
 * Resolves the owner of the matching care group and returns the user row.
 * Callers are responsible for their own rate limiting and token issuance.
 */
export async function verifyCareGroupCredentials(
  groupName: string,
  groupPassword: string,
): Promise<CareGroupAuthResult> {
  const name = groupName?.trim()
  if (!name || !groupPassword) return { ok: false, reason: 'missing' }

  const groups = await db.query.careGroups.findMany({
    where: eq(careGroups.name, name),
    orderBy: (g, { asc }) => [asc(g.createdAt)],
  })

  for (const g of groups) {
    if (await bcrypt.compare(groupPassword, g.passwordHash)) {
      const ownerMember = await db.query.careGroupMembers.findFirst({
        where: and(eq(careGroupMembers.careGroupId, g.id), eq(careGroupMembers.role, 'owner')),
      })
      if (!ownerMember) return { ok: false, reason: 'no_owner' }
      const ownerUser = await db.query.users.findFirst({
        where: eq(users.id, ownerMember.userId),
      })
      if (!ownerUser) return { ok: false, reason: 'no_user' }
      return { ok: true, user: ownerUser, group: g }
    }
  }

  return { ok: false, reason: 'invalid' }
}
