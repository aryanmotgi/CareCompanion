import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { careTeamMembers, careTeamInvites, careTeamActivity, users } from '@/lib/db/schema';
import { and, asc, desc, eq } from 'drizzle-orm';

// GET — list team members and pending invites for the user's care profile
export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error || !dbUser) return new Response('Unauthorized', { status: 401 });

  // Get the user's care profile (as owner or team member)
  const [membership] = await db
    .select({ careProfileId: careTeamMembers.careProfileId, role: careTeamMembers.role })
    .from(careTeamMembers)
    .where(eq(careTeamMembers.userId, dbUser.id))
    .limit(1);

  if (!membership) {
    return Response.json({ members: [], invites: [], activity: [], role: null });
  }

  const profileId = membership.careProfileId;

  // Fetch members, invites, and activity in parallel
  const [members, invites, activity] = await Promise.all([
    db.select().from(careTeamMembers)
      .where(eq(careTeamMembers.careProfileId, profileId))
      .orderBy(asc(careTeamMembers.createdAt))
      .catch(() => []),
    db.select().from(careTeamInvites)
      .where(and(
        eq(careTeamInvites.careProfileId, profileId),
        eq(careTeamInvites.status, 'pending')
      ))
      .orderBy(desc(careTeamInvites.createdAt))
      .catch(() => []),
    db.select().from(careTeamActivity)
      .where(eq(careTeamActivity.careProfileId, profileId))
      .orderBy(desc(careTeamActivity.createdAt))
      .limit(20)
      .catch(() => []),
  ]);

  // Enrich members with user info from local users table
  const enrichedMembers = await Promise.all(
    members.map(async (m) => {
      const [userData] = await db
        .select({ email: users.email, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);
      return {
        ...m,
        email: userData?.email || null,
        display_name: userData?.displayName || userData?.email?.split('@')[0] || 'Unknown',
      };
    })
  );

  return Response.json({
    members: enrichedMembers,
    invites,
    activity,
    role: membership.role,
    care_profile_id: profileId,
  });
}
