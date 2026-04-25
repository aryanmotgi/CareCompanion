/**
 * Start Demo Session
 *
 * Creates an ephemeral demo account pre-loaded with realistic HER2+ Breast
 * Cancer care data. Mints a session JWT directly — no Cognito required.
 * Demo accounts have `isDemo = true` so the DemoBanner shows across the app
 * and a cleanup job can purge them later.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  users,
  careProfiles,
  medications,
  labResults,
  doctors,
  insurance,
  notifications,
  userSettings,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimit } from '@/lib/rate-limit';
import { encode } from 'next-auth/jwt';
import crypto from 'crypto';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 10 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateOk } = await limiter.check(ip);
  if (!rateOk) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const uuid = crypto.randomUUID();
  const email = `demo-${uuid}@demo.carecompanionai.org`;

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: 'AUTH_SECRET not configured' }, { status: 500 });
  }

  // 1. Insert demo user directly — no Cognito needed
  let newUser: { id: string };
  try {
    const [inserted] = await db.insert(users).values({
      email,
      displayName: 'Demo',
      isDemo: true,
      hipaaConsent: true,
    }).returning({ id: users.id });
    newUser = inserted;
  } catch (err) {
    console.error('[demo] Insert user failed:', err);
    return NextResponse.json({ error: 'Failed to create demo account' }, { status: 500 });
  }

  // 2. Seed the full cancer care dataset
  try {
    await seedDemoData(newUser.id);
  } catch (err) {
    console.error('[demo] Seed data failed:', err);
    await db.delete(users).where(eq(users.id, newUser.id)).catch(() => {});
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }

  // 3. Mint session JWT and set cookie
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Secure-authjs.session-token' : 'authjs.session-token';

  const sessionToken = await encode({
    token: {
      sub: newUser.id,
      email,
      name: 'Demo',
      id: newUser.id,
      dbUserId: newUser.id,
      displayName: 'Demo',
      isDemo: true,
    },
    secret: authSecret,
    salt: cookieName,
    maxAge: 60 * 60, // 1 hour
  });

  const res = NextResponse.json({ success: true });

  // Clear the other cookie variant so the old real session can't win
  const otherCookieName = isProd ? 'authjs.session-token' : '__Secure-authjs.session-token';
  res.cookies.set(otherCookieName, '', { maxAge: 0, path: '/' });

  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });

  return res;
}

// ═════════════════════════════════════════════════════════════════════════
// Seed function — creates a realistic HER2+ Breast Cancer care profile
// ═════════════════════════════════════════════════════════════════════════

async function seedDemoData(userId: string) {
  const now = new Date();
  const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
  const dayISO = (d: number) => day(d).toISOString().split('T')[0];

  // ── CARE PROFILE (must come first — others reference its id) ──
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

  // ── PARALLEL: medications + labs + doctors + notifications + settings ──
  await Promise.all([
    db.insert(medications).values([
      { careProfileId, name: 'Trastuzumab (Herceptin)', dose: '440mg', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'HER2-targeted therapy. Monitor cardiac function.' },
      { careProfileId, name: 'Pertuzumab (Perjeta)', dose: '840mg', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'HER2-targeted therapy. Watch for diarrhea.' },
      { careProfileId, name: 'Docetaxel (Taxotere)', dose: '75mg/m²', frequency: 'IV every 3 weeks', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(7), notes: 'Taxane chemo. Side effects: neuropathy, hair loss, low blood counts.' },
      { careProfileId, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'As needed for nausea', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(3), notes: 'Take at first sign of nausea.' },
      { careProfileId, name: 'Tamoxifen', dose: '20mg', frequency: 'Once daily', prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)', refillDate: dayISO(25), notes: 'Hormone therapy. Long-term maintenance.' },
      { careProfileId, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily', prescribingDoctor: 'Dr. Maria Santos (Primary Care)', refillDate: dayISO(20), notes: 'Blood pressure control.' },
    ]),

    db.insert(labResults).values([
      { userId, testName: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', referenceRange: '4.5-11.0', isAbnormal: true, dateTaken: dayISO(-2), source: 'Demo' },
      { userId, testName: 'Hemoglobin', value: '11.2', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: true, dateTaken: dayISO(-2), source: 'Demo' },
      { userId, testName: 'Platelet Count', value: '145', unit: 'K/uL', referenceRange: '150-400', isAbnormal: true, dateTaken: dayISO(-2), source: 'Demo' },
      { userId, testName: 'HER2/neu', value: '15.8', unit: 'ng/mL', referenceRange: '<15.0', isAbnormal: true, dateTaken: dayISO(-5), source: 'Demo' },
      { userId, testName: 'CA 15-3', value: '28.5', unit: 'U/mL', referenceRange: '<30', isAbnormal: false, dateTaken: dayISO(-5), source: 'Demo' },
      { userId, testName: 'Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.6-1.2', isAbnormal: false, dateTaken: dayISO(-2), source: 'Demo' },
    ]),

    db.insert(doctors).values([
      { careProfileId, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Lead oncologist.' },
      { careProfileId, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Cardiac monitoring during Herceptin.' },
      { careProfileId, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Managing BP and general health.' },
      { careProfileId, name: 'Dr. Rachel Kim', specialty: 'Breast Surgeon', phone: '555-0204', notes: 'Surgical oncologist.' },
    ]),

    db.insert(notifications).values([
      { userId, type: 'lab_result', title: 'Low WBC - Neutropenia Warning', message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever. Call oncology if temp > 100.4F.', isRead: false },
      { userId, type: 'refill', title: 'Ondansetron (Zofran) refill soon', message: '12 tablets remaining. Refill due in 3 days.', isRead: false },
      { userId, type: 'appointment', title: 'Oncology follow-up in 3 days', message: 'Dr. Lisa Chen at Cancer Center, 10:00 AM.', isRead: false },
      { userId, type: 'lab_result', title: 'HER2/neu slightly elevated', message: 'HER2/neu is 15.8 ng/mL (normal: <15.0). Discuss with Dr. Chen.', isRead: true },
    ]),

    db.insert(userSettings).values({
      userId, refillReminders: true, appointmentReminders: true,
      labAlerts: true, claimUpdates: true, aiPersonality: 'friendly',
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { refillReminders: true, appointmentReminders: true, labAlerts: true, claimUpdates: true },
    }),

    db.insert(insurance).values({
      userId, provider: 'Blue Cross Blue Shield',
      memberId: 'BCB-882991-04', groupNumber: 'GRP-7420',
      planYear: new Date().getFullYear(),
    }).onConflictDoNothing(),
  ]);
}
