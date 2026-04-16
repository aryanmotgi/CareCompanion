/**
 * Provision the 1upHealth reviewer account.
 *
 * Creates reviewer@carecompanionai.org (if it doesn't exist) and seeds
 * the full HER2+ Breast Cancer demo data. Protected by CRON_SECRET so
 * only an admin can call it.
 *
 * Usage:
 *   curl -X POST https://carecompanionai.org/api/admin/provision-reviewer \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * Safe to call multiple times — skips if the account already exists.
 *
 * Add ?reseed_reminders=true to re-run medication reminder seeding for an
 * existing reviewer account (e.g. provisioned before reminders were added).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { db } from '@/lib/db';
import {
  users,
  careProfiles,
  medications,
  labResults,
  appointments,
  doctors,
  insurance,
  notifications,
  medicationReminders,
  reminderLogs,
  userSettings,
} from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

const REVIEWER_EMAIL = 'reviewer@carecompanionai.org';
const REVIEWER_PASSWORD = 'OneUpReview2026!';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reseedReminders = req.nextUrl.searchParams.get('reseed_reminders') === 'true';

  // Check if the reviewer already exists in the DB
  const [existingUser] = await db
    .select({ id: users.id, cognitoSub: users.cognitoSub })
    .from(users)
    .where(eq(users.email, REVIEWER_EMAIL))
    .limit(1);

  if (existingUser) {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, existingUser.id))
      .limit(1);

    if (profile && reseedReminders) {
      await seedReminders(existingUser.id, profile.id);
      return NextResponse.json({
        success: true,
        status: 'reminders_reseeded',
        email: REVIEWER_EMAIL,
        userId: existingUser.id,
      });
    }

    if (profile) {
      return NextResponse.json({
        success: true,
        status: 'already_exists',
        email: REVIEWER_EMAIL,
        userId: existingUser.id,
      });
    }

    // User exists but no profile — seed the data
    await seedDemoData(existingUser.id);
    return NextResponse.json({
      success: true,
      status: 'data_seeded',
      email: REVIEWER_EMAIL,
      userId: existingUser.id,
    });
  }

  // Check if Cognito user already exists
  let cognitoSub: string | undefined;
  try {
    const listRes = await cognito.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${REVIEWER_EMAIL}"`,
    }));
    const existing = listRes.Users?.[0];
    cognitoSub = existing?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  } catch {
    // ignore — will create below
  }

  // Create Cognito user if not exists
  if (!cognitoSub) {
    try {
      const createRes = await cognito.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: REVIEWER_EMAIL,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: REVIEWER_EMAIL },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:display_name', Value: 'Reviewer' },
        ],
        TemporaryPassword: REVIEWER_PASSWORD,
      }));

      cognitoSub = createRes.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;

      // Set permanent password
      await cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: REVIEWER_EMAIL,
        Password: REVIEWER_PASSWORD,
        Permanent: true,
      }));
    } catch (err) {
      console.error('[provision-reviewer] Create Cognito user failed:', err);
      return NextResponse.json({ error: 'Failed to create reviewer account' }, { status: 500 });
    }
  }

  if (!cognitoSub) {
    return NextResponse.json({ error: 'Could not determine Cognito sub' }, { status: 500 });
  }

  // Insert into local users table
  const [newUser] = await db
    .insert(users)
    .values({
      cognitoSub,
      email: REVIEWER_EMAIL,
      displayName: 'Reviewer',
      isDemo: false,
    })
    .onConflictDoUpdate({
      target: users.cognitoSub,
      set: { email: REVIEWER_EMAIL, displayName: 'Reviewer' },
    })
    .returning({ id: users.id });

  try {
    await seedDemoData(newUser.id);
  } catch (err) {
    console.error('[provision-reviewer] Seed failed:', err);
    // Best-effort cleanup of Cognito user
    await cognito.send(new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: REVIEWER_EMAIL,
    })).catch(() => {});
    await db.delete(users).where(eq(users.id, newUser.id)).catch(() => {});
    return NextResponse.json({ error: 'Failed to seed reviewer data' }, { status: 500 });
  }

  console.log(`[provision-reviewer] Created reviewer account: ${REVIEWER_EMAIL} (${newUser.id})`);
  return NextResponse.json({
    success: true,
    status: 'created',
    email: REVIEWER_EMAIL,
    userId: newUser.id,
  });
}

async function seedDemoData(userId: string) {
  const now = new Date();
  const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
  const dayISO = (d: number) => day(d).toISOString().split('T')[0];
  const dayTime = (d: number, h: number, m: number) => { const x = day(d); x.setHours(h, m, 0, 0); return x; };

  const [profile] = await db.insert(careProfiles).values({
    userId,
    patientName: 'Sarah',
    patientAge: 58,
    relationship: 'self',
    cancerType: 'HER2+ Breast Cancer',
    cancerStage: 'Stage IIIA',
    treatmentPhase: 'active_treatment',
    conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nOsteoporosis\nAnxiety',
    allergies: 'Sulfa drugs\nLatex\nIbuprofen (causes GI upset)',
    onboardingCompleted: true,
  }).returning({ id: careProfiles.id });

  if (!profile) throw new Error('Profile insert failed');
  const careProfileId = profile.id;

  const insertedMeds = await db.insert(medications).values([
    { careProfileId, name: 'Trastuzumab (Herceptin)', dose: '440mg', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'HER2-targeted therapy. Monitor cardiac function (echo every 3 months).' },
    { careProfileId, name: 'Pertuzumab (Perjeta)', dose: '840mg', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'HER2-targeted therapy given with Herceptin. Watch for diarrhea.' },
    { careProfileId, name: 'Docetaxel (Taxotere)', dose: '75mg/m²', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Taxane chemotherapy. Main side effects: neuropathy, hair loss, low blood counts.' },
    { careProfileId, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'As needed for nausea', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(3), notes: 'Take at first sign of nausea. May cause constipation.' },
    { careProfileId, name: 'Dexamethasone', dose: '4mg', frequency: 'Before chemo infusion', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Pre-medication for chemo. Take night before and morning of infusion.' },
    { careProfileId, name: 'Tamoxifen', dose: '20mg', frequency: 'Once daily', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(25), notes: 'Hormone therapy. Long-term maintenance (5-10 years).' },
    { careProfileId, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily — morning', prescribingDoctor: 'Dr. Maria Santos (Primary Care)', refillDate: dayISO(20), notes: 'Blood pressure control.' },
    { careProfileId, name: 'Lorazepam (Ativan)', dose: '0.5mg', frequency: 'As needed for anxiety', prescribingDoctor: 'Dr. Maria Santos (Primary Care)', refillDate: dayISO(30), notes: 'PRN for anxiety before scans or procedures. Do not mix with alcohol.' },
  ]).returning({ id: medications.id, name: medications.name });

  await db.insert(labResults).values([
    { userId, testName: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', referenceRange: '4.5-11.0', isAbnormal: true, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'Hemoglobin', value: '11.2', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: true, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'Platelet Count', value: '145', unit: 'K/uL', referenceRange: '150-400', isAbnormal: true, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.6-1.2', isAbnormal: false, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'ALT', value: '22', unit: 'U/L', referenceRange: '7-56', isAbnormal: false, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'HER2/neu', value: '15.8', unit: 'ng/mL', referenceRange: '<15.0', isAbnormal: true, dateTaken: day(-5).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'CA 15-3', value: '28.5', unit: 'U/mL', referenceRange: '<30', isAbnormal: false, dateTaken: day(-5).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'WBC (White Blood Cells)', value: '4.1', unit: 'K/uL', referenceRange: '4.5-11.0', isAbnormal: true, dateTaken: day(-23).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'Hemoglobin', value: '11.8', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: true, dateTaken: day(-23).toISOString().split('T')[0], source: 'Demo' },
    { userId, testName: 'Platelet Count', value: '168', unit: 'K/uL', referenceRange: '150-400', isAbnormal: false, dateTaken: day(-23).toISOString().split('T')[0], source: 'Demo' },
  ]);

  await db.insert(appointments).values([
    { careProfileId, doctorName: 'Dr. Lisa Chen', specialty: 'Medical Oncology', dateTime: dayTime(3, 10, 0), location: 'Cancer Center — Clinic 2, Room 204', purpose: 'Oncology follow-up — treatment response review' },
    { careProfileId, doctorName: 'Lab Work', specialty: 'Laboratory', dateTime: dayTime(6, 8, 0), location: 'Cancer Center — Lab', purpose: 'Pre-chemo bloodwork (CBC, CMP, tumor markers)' },
    { careProfileId, doctorName: 'Infusion Center', specialty: 'Medical Oncology', dateTime: dayTime(7, 9, 0), location: 'Cancer Center — Infusion Suite B', purpose: 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere' },
    { careProfileId, doctorName: 'Dr. James Park', specialty: 'Cardiology', dateTime: dayTime(14, 11, 0), location: 'Heart & Vascular Center', purpose: 'Echocardiogram — Herceptin cardiac monitoring' },
    { careProfileId, doctorName: 'Dr. Rachel Kim', specialty: 'Breast Surgery', dateTime: dayTime(28, 14, 30), location: 'Cancer Center — Surgery Clinic', purpose: 'Post-treatment surgical consult' },
  ]);

  await db.insert(doctors).values([
    { careProfileId, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Lead oncologist. Reachable via MyChart. Nurse line: 555-0211.' },
    { careProfileId, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Monitoring cardiac function during Herceptin treatment.' },
    { careProfileId, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Managing BP, anxiety, general health.' },
    { careProfileId, name: 'Dr. Rachel Kim', specialty: 'Breast Surgeon', phone: '555-0204', notes: 'Surgical oncologist. Did initial lumpectomy.' },
    { careProfileId, name: 'Sarah Johnson, RN', specialty: 'Oncology Nurse Navigator', phone: '555-0211', notes: 'First point of contact for treatment questions or side effects.' },
  ]);

  await db.insert(insurance).values({
    userId,
    provider: 'Blue Cross Blue Shield',
    memberId: 'BCB-882991-04',
    groupNumber: 'GRP-7420',
    planYear: new Date().getFullYear(),
  }).onConflictDoUpdate({
    target: insurance.userId,
    set: { provider: 'Blue Cross Blue Shield', memberId: 'BCB-882991-04', groupNumber: 'GRP-7420' },
  });

  await db.insert(notifications).values([
    { userId, type: 'lab_result', title: 'Low WBC — Neutropenia Warning', message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever or signs of infection. Contact oncology if temp > 100.4°F.', isRead: false },
    { userId, type: 'refill', title: 'Ondansetron (Zofran) refill soon', message: '12 tablets remaining. Refill due in 3 days — you will need these for your next infusion.', isRead: false },
    { userId, type: 'appointment', title: 'Oncology follow-up in 3 days', message: 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM. Review treatment response.', isRead: false },
    { userId, type: 'appointment', title: 'Chemo infusion in 1 week', message: 'Cycle 4 infusion on Thursday. Remember pre-meds (Dexamethasone) night before and morning of.', isRead: false },
    { userId, type: 'lab_result', title: 'HER2/neu slightly elevated', message: 'HER2/neu is 15.8 ng/mL (normal: <15.0). Discuss trend with Dr. Chen at your next visit.', isRead: true },
  ]);

  await seedReminders(userId, careProfileId, insertedMeds);

  await db.insert(userSettings).values({
    userId,
    refillReminders: true,
    appointmentReminders: true,
    labAlerts: true,
    claimUpdates: true,
    aiPersonality: 'friendly',
  }).onConflictDoUpdate({
    target: userSettings.userId,
    set: { refillReminders: true, appointmentReminders: true, labAlerts: true, claimUpdates: true, aiPersonality: 'friendly' },
  });
}

async function seedReminders(
  userId: string,
  careProfileId: string,
  meds?: Array<{ id: string; name: string }>
) {
  const now = new Date();
  const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };

  let dailyMeds = meds?.filter((m) => m.name === 'Tamoxifen' || m.name === 'Lisinopril');

  if (!dailyMeds || dailyMeds.length === 0) {
    dailyMeds = await db
      .select({ id: medications.id, name: medications.name })
      .from(medications)
      .where(eq(medications.careProfileId, careProfileId));
    dailyMeds = dailyMeds.filter((m) => m.name === 'Tamoxifen' || m.name === 'Lisinopril');
  }

  if (dailyMeds.length === 0) return;

  // Clear existing reminders/logs
  const existingReminders = await db
    .select({ id: medicationReminders.id })
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId));

  if (existingReminders.length > 0) {
    const reminderIds = existingReminders.map((r) => r.id);
    await db.delete(reminderLogs).where(inArray(reminderLogs.reminderId, reminderIds));
    await db.delete(medicationReminders).where(inArray(medicationReminders.id, reminderIds));
  }

  for (const med of dailyMeds) {
    const reminderTime = med.name === 'Lisinopril' ? '08:00' : '21:00';
    const [reminder] = await db.insert(medicationReminders).values({
      userId,
      medicationId: med.id,
      medicationName: med.name,
      dose: med.name === 'Tamoxifen' ? '20mg' : '10mg',
      reminderTimes: [reminderTime],
      daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      isActive: true,
    }).returning({ id: medicationReminders.id });

    if (!reminder) continue;

    const logEntries = [];
    for (let d = 7; d >= 1; d--) {
      const scheduledDate = day(-d);
      scheduledDate.setHours(parseInt(reminderTime.split(':')[0]), 0, 0, 0);
      const isMissed = d === 4 && med.name === 'Tamoxifen';
      logEntries.push({
        userId,
        reminderId: reminder.id,
        medicationName: med.name,
        scheduledTime: scheduledDate,
        status: isMissed ? 'missed' : 'taken',
        respondedAt: isMissed ? null : new Date(scheduledDate.getTime() + 5 * 60000),
      });
    }
    await db.insert(reminderLogs).values(logEntries);
  }
}
