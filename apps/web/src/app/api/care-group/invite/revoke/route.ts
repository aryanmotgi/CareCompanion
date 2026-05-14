import { NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { careGroupInvites, careGroupMembers } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// POST — revoke a care group invite token by ID
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inviteId } = await req.json();
    if (!inviteId || typeof inviteId !== 'string') {
      return NextResponse.json({ error: 'inviteId required' }, { status: 400 });
    }

    // Find the invite token
    const [invite] = await db
      .select({
        id: careGroupInvites.id,
        careGroupId: careGroupInvites.careGroupId,
        revokedAt: careGroupInvites.revokedAt,
      })
      .from(careGroupInvites)
      .where(eq(careGroupInvites.id, inviteId))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.revokedAt !== null) {
      return NextResponse.json({ error: 'Invite already revoked' }, { status: 400 });
    }

    // Verify caller is a member of this group
    const membership = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, invite.careGroupId),
        eq(careGroupMembers.userId, session.user.id),
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Revoke: set revokedAt only if still active (prevents race)
    await db
      .update(careGroupInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(careGroupInvites.id, inviteId),
          isNull(careGroupInvites.revokedAt)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[care-group/invite/revoke] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
