import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import {
  wellnessCheckins,
  careProfiles,
  careTeamMembers,
  careTeamActivityLog,
  pushSubscriptions,
} from '@/lib/db/schema';
import { sendPushNotification } from '@/lib/push';
import { eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // CSRF check must come before auth so the token is read from the original body stream
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { checkinId } = await req.json();
  if (!checkinId) {
    return NextResponse.json({ error: 'checkinId required' }, { status: 400 });
  }

  // Look up the check-in
  const [checkin] = await db
    .select()
    .from(wellnessCheckins)
    .where(eq(wellnessCheckins.id, checkinId))
    .limit(1);

  if (!checkin) {
    return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
  }

  // Ownership check: verify the care profile belongs to the requesting user (IDOR guard).
  // wellnessCheckins has no direct userId — ownership is via careProfiles.userId.
  const [profile] = await db
    .select({ userId: careProfiles.userId })
    .from(careProfiles)
    .where(eq(careProfiles.id, checkin.careProfileId))
    .limit(1);

  if (!profile || profile.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Map mood number (1-5) to emoji
  const moodEmojis = ['😫', '😕', '😐', '😊', '😄'];
  const moodEmoji = moodEmojis[checkin.mood - 1] || '😐';

  // Get all care team members for this profile
  const caregivers = await db
    .select({ userId: careTeamMembers.userId })
    .from(careTeamMembers)
    .where(eq(careTeamMembers.careProfileId, checkin.careProfileId));

  if (caregivers.length === 0) {
    return NextResponse.json({ shared: 0, message: 'No care team members to share with' });
  }

  // Get push subscriptions for all caregivers
  const caregiverIds = caregivers.map((c) => c.userId);
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, caregiverIds));

  // Send push to each subscription
  const title = 'Check-in Update';
  const body = `${moodEmoji} Mood · Pain ${checkin.pain}/10 · Energy ${checkin.energy} · Sleep ${checkin.sleep}`;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, url: '/care-hub' },
      ),
    ),
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;

  // Log activity
  await db.insert(careTeamActivityLog).values({
    careProfileId: checkin.careProfileId,
    userId: user.id,
    action: 'shared_link',
    metadata: { checkinId, type: 'quick_share' },
  });

  return NextResponse.json({ shared: sent });
}
