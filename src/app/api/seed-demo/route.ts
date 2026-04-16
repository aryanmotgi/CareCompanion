import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { careProfiles, medications, appointments, doctors, labResults, insurance, connectedApps, userSettings, notifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const [profile] = await db
      .select({ id: careProfiles.id, patientName: careProfiles.patientName })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1);

    if (!profile) return apiError('No profile', 400);

    const now = new Date();
    const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
    const dayISO = (d: number) => day(d).toISOString().split('T')[0];
    const dayTime = (d: number, h: number, m: number) => { const x = day(d); x.setHours(h, m, 0, 0); return x; };

    // Clear previous demo data
    await Promise.all([
      db.delete(medications).where(and(eq(medications.careProfileId, profile.id), eq(medications.notes, 'Demo data'))),
      db.delete(appointments).where(and(eq(appointments.careProfileId, profile.id), eq(appointments.purpose, 'Demo data'))),
      db.delete(doctors).where(and(eq(doctors.careProfileId, profile.id), eq(doctors.notes, 'Demo data'))),
      db.delete(labResults).where(and(eq(labResults.userId, dbUser!.id), eq(labResults.source, 'Demo data'))),
    ]);

    // Update care profile
    await db.update(careProfiles).set({
      patientName: profile.patientName || 'Sarah Mitchell',
      patientAge: 58,
      cancerType: 'HER2+ Breast Cancer',
      cancerStage: 'Stage IIIA',
      treatmentPhase: 'active_treatment',
      conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nOsteoporosis\nAnxiety',
      allergies: 'Sulfa drugs\nLatex\nIbuprofen (causes GI upset)',
      onboardingCompleted: true,
    }).where(eq(careProfiles.id, profile.id));

    // Medications (8)
    const meds = await db.insert(medications).values([
      { careProfileId: profile.id, name: 'Trastuzumab (Herceptin)', dose: '440mg', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Pertuzumab (Perjeta)', dose: '840mg', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Docetaxel (Taxotere)', dose: '75mg/m²', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'As needed for nausea', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(3), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Dexamethasone', dose: '4mg', frequency: 'Before chemo infusion', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Tamoxifen', dose: '20mg', frequency: 'Once daily', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(25), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily — morning', prescribingDoctor: 'Dr. Maria Santos (Primary Care)', refillDate: dayISO(20), notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Lorazepam (Ativan)', dose: '0.5mg', frequency: 'As needed for anxiety', prescribingDoctor: 'Dr. Maria Santos (Primary Care)', refillDate: dayISO(30), notes: 'Demo data' },
    ]).returning({ id: medications.id });

    // Lab results (7)
    const labs = await db.insert(labResults).values([
      { userId: dbUser!.id, testName: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', referenceRange: '4.5-11.0', isAbnormal: true, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo data' },
      { userId: dbUser!.id, testName: 'HER2/neu', value: '15.8', unit: 'ng/mL', referenceRange: '<15.0', isAbnormal: true, dateTaken: day(-5).toISOString().split('T')[0], source: 'Demo data' },
      { userId: dbUser!.id, testName: 'CA 15-3', value: '28.5', unit: 'U/mL', referenceRange: '<30', isAbnormal: false, dateTaken: day(-5).toISOString().split('T')[0], source: 'Demo data' },
      { userId: dbUser!.id, testName: 'Hemoglobin', value: '11.2', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: true, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo data' },
      { userId: dbUser!.id, testName: 'Platelet Count', value: '145', unit: 'K/uL', referenceRange: '150-400', isAbnormal: true, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo data' },
      { userId: dbUser!.id, testName: 'Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.6-1.2', isAbnormal: false, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo data' },
      { userId: dbUser!.id, testName: 'ALT', value: '22', unit: 'U/L', referenceRange: '7-56', isAbnormal: false, dateTaken: day(-2).toISOString().split('T')[0], source: 'Demo data' },
    ]).returning({ id: labResults.id });

    // Appointments (4 future)
    const appts = await db.insert(appointments).values([
      { careProfileId: profile.id, doctorName: 'Dr. Lisa Chen', specialty: 'Medical Oncology', dateTime: dayTime(3, 10, 0), location: 'Cancer Center — Clinic 2', purpose: 'Oncology follow-up — treatment response review' },
      { careProfileId: profile.id, doctorName: 'Lab Work', specialty: 'Laboratory', dateTime: dayTime(6, 8, 0), location: 'Cancer Center — Lab', purpose: 'Pre-chemo bloodwork (CBC, CMP, tumor markers)' },
      { careProfileId: profile.id, doctorName: 'Infusion Center', specialty: 'Medical Oncology', dateTime: dayTime(7, 9, 0), location: 'Cancer Center — Infusion Suite B', purpose: 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere' },
      { careProfileId: profile.id, doctorName: 'Dr. James Park', specialty: 'Cardiology', dateTime: dayTime(14, 11, 0), location: 'Heart & Vascular Center', purpose: 'Echocardiogram — Herceptin cardiac monitoring' },
    ]).returning({ id: appointments.id });

    // Doctors (4)
    const docs = await db.insert(doctors).values([
      { careProfileId: profile.id, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Demo data' },
      { careProfileId: profile.id, name: 'Dr. Rachel Kim', specialty: 'Breast Surgeon', phone: '555-0204', notes: 'Demo data' },
    ]).returning({ id: doctors.id });

    // Insurance
    await db.insert(insurance).values({
      userId: dbUser!.id,
      provider: 'Blue Cross Blue Shield',
      memberId: 'BCB-882991-04',
      groupNumber: 'GRP-7420',
    }).onConflictDoUpdate({
      target: insurance.userId,
      set: { provider: 'Blue Cross Blue Shield', memberId: 'BCB-882991-04', groupNumber: 'GRP-7420' },
    });

    // Mark 1upHealth as connected
    await db.delete(connectedApps).where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, '1uphealth')));
    await db.insert(connectedApps).values({
      userId: dbUser!.id,
      source: '1uphealth',
      accessToken: 'demo-token',
      lastSynced: new Date(),
      metadata: { provider_name: '1upHealth', provider_id: '1uphealth', demo: true },
    });

    // Upsert user settings
    await db.insert(userSettings).values({
      userId: dbUser!.id,
      refillReminders: true,
      appointmentReminders: true,
      labAlerts: true,
      claimUpdates: true,
      aiPersonality: 'friendly',
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { refillReminders: true, appointmentReminders: true, labAlerts: true, claimUpdates: true, aiPersonality: 'friendly' },
    });

    // Seed notifications
    await db.insert(notifications).values([
      { userId: dbUser!.id, type: 'lab_result', title: 'Low WBC — Neutropenia Warning', message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever or signs of infection. Contact oncology if temp > 100.4 F.', isRead: false },
      { userId: dbUser!.id, type: 'refill', title: 'Ondansetron (Zofran) refill soon', message: '12 tablets remaining. Refill due in 3 days — you will need these for your next infusion.', isRead: false },
      { userId: dbUser!.id, type: 'appointment', title: 'Oncology follow-up in 3 days', message: 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM. Review treatment response.', isRead: false },
    ]);

    return apiSuccess({
      counts: {
        medications: meds.length,
        labs: labs.length,
        appointments: appts.length,
        doctors: docs.length,
      },
    });
  } catch (err) {
    console.error('[seed-demo] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
