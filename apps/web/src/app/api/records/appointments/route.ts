import { db } from '@/lib/db';
import { appointments, careProfiles } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { softDelete } from '@/lib/soft-delete';

// POST — add an appointment
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<Record<string, unknown>>(req);
  if (bodyError) return bodyError;
  const { doctor_name, date_time, purpose, location, specialty, care_profile_id } = body as {
    doctor_name?: string; date_time?: string; purpose?: string;
    location?: string; specialty?: string; care_profile_id?: string;
  };

  let profileId: string;
  if (care_profile_id) {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, care_profile_id), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);
    if (!profile) return apiError('Forbidden', 403);
    profileId = profile.id;
  } else {
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
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ id?: string }>(req);
  if (bodyError) return bodyError;
  const { id } = body;
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

  const result = await softDelete('appointments', id, dbUser!.id, profile.id);
  return apiSuccess(result);
}

// PUT — bulk-create appointments during onboarding
export async function PUT(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ profileId?: string; appointments?: Array<Record<string, unknown>> }>(req);
  if (bodyError) return bodyError;
  const { profileId, appointments: appts } = body;
  if (!profileId) return apiError('profileId is required', 400);
  if (!Array.isArray(appts) || appts.length === 0) return apiError('appointments array is required', 400);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);
  if (!profile) return apiError('Forbidden', 403);

  const rows = appts.map((a) => ({
    careProfileId: profile.id,
    doctorName: a.doctor_name ? String(a.doctor_name) : null,
    dateTime: a.date_time ? new Date(String(a.date_time)) : null,
    purpose: a.purpose ? String(a.purpose) : null,
    location: a.location ? String(a.location) : null,
    specialty: a.specialty ? String(a.specialty) : null,
  }));

  const inserted = await db.insert(appointments).values(rows).returning();
  return apiSuccess(inserted);
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
    .select({
      id: appointments.id,
      careProfileId: appointments.careProfileId,
      doctorName: appointments.doctorName,
      specialty: appointments.specialty,
      dateTime: appointments.dateTime,
      location: appointments.location,
      purpose: appointments.purpose,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .where(and(eq(appointments.careProfileId, profileId), isNull(appointments.deletedAt)))
    .orderBy(desc(appointments.dateTime));

  return apiSuccess(appts);
}
