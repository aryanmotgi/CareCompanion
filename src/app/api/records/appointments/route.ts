import { db } from '@/lib/db';
import { appointments, careProfiles } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';

// POST — add an appointment
export async function POST(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await req.json();
  const { doctor_name, date_time, purpose, location, specialty, care_profile_id } = body;

  let profileId = care_profile_id;
  if (!profileId) {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1);
    if (!profile) return apiError('No care profile found', 404);
    profileId = profile.id;
  }

  const [appt] = await db.insert(appointments).values({
    careProfileId: profileId,
    doctorName: doctor_name || null,
    dateTime: date_time ? new Date(date_time) : null,
    purpose: purpose || null,
    location: location || null,
    specialty: specialty || null,
  }).returning();

  return apiSuccess(appt);
}

// DELETE — remove an appointment by id
export async function DELETE(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await req.json();
  if (!id) return apiError('id is required', 400);

  const [appt] = await db
    .select({ careProfileId: appointments.careProfileId })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!appt) return apiError('Not found', 404);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, appt.careProfileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  await db.delete(appointments).where(eq(appointments.id, id));
  return apiSuccess({ success: true });
}

// GET — list appointments for a care profile
export async function GET(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(req.url);
  const profileId = url.searchParams.get('care_profile_id');
  if (!profileId) return apiError('care_profile_id is required', 400);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  const appts = await db
    .select()
    .from(appointments)
    .where(eq(appointments.careProfileId, profileId))
    .orderBy(desc(appointments.dateTime));

  return apiSuccess(appts);
}
