/**
 * Provisions the App Store review demo account in Aurora.
 *
 * Cognito note: auth migrated from Cognito to NextAuth.js Credentials provider.
 * The `users.cognito_sub` column is a legacy no-op — no Cognito UserPool call
 * is made here. This script creates the Aurora user row that NextAuth
 * authenticates against via bcrypt password comparison.
 *
 * Usage:
 *   DEMO_ACCOUNT_PASSWORD=<secret> npx tsx apps/web/src/lib/db/seed-demo.ts
 *
 * Required env vars:
 *   AWS_REGION, AWS_SECRET_ARN, AWS_RESOURCE_ARN, DEMO_ACCOUNT_PASSWORD
 * AWS credentials resolved via SDK default chain (env vars OR `aws sso login`
 * OR shared ~/.aws/credentials profile). Do NOT source .env.local — its
 * stale AWS_ACCESS_KEY_ID will mask your active SSO session.
 *
 * Idempotent: deletes then re-creates all demo data on each run.
 * All data is obviously synthetic — no real PHI.
 */

import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { db } from './index'
import {
  users,
  userIdentities,
  careProfiles,
  careGroups,
  careGroupMembers,
  medications,
  labResults,
  notifications,
  conversations,
  messages,
  wellnessCheckins,
  wellnessVitals,
  userSettings,
} from './schema'

// ── Demo account identifiers ──────────────────────────────────────────────────
export const DEMO_EMAIL = 'appreview@carecompanionai.org'
export const DEMO_CAREGIVER_1_EMAIL = 'caregiver1-demo@carecompanionai.org'
export const DEMO_CAREGIVER_2_EMAIL = 'caregiver2-demo@carecompanionai.org'

// ── Date helpers ──────────────────────────────────────────────────────────────
const base = new Date()
const daysAgo = (n: number): Date => {
  const d = new Date(base)
  d.setDate(d.getDate() - n)
  return d
}
const daysFromNow = (n: number): Date => {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}
const isoDate = (d: Date): string => d.toISOString().split('T')[0]

// ── Deterministic synthetic variation (no Math.random) ────────────────────────
const wave = (i: number, amp: number, freq: number, phase = 0): number =>
  Math.round(amp * Math.sin(i * freq + phase))

// ── Cleanup: delete previous run in FK-safe order ────────────────────────────
async function cleanup(): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1)

  if (existing) {
    // Care groups have no cascade from createdBy — delete them first
    const ownedGroups = await db
      .select({ id: careGroups.id })
      .from(careGroups)
      .where(eq(careGroups.createdBy, existing.id))
    if (ownedGroups.length > 0) {
      await db.delete(careGroups).where(
        inArray(careGroups.id, ownedGroups.map((g) => g.id))
      )
    }
    // Patient delete cascades: careProfiles → medications, labs, checkins, vitals,
    // notifications, conversations, messages
    await db.delete(users).where(eq(users.id, existing.id))
  }

  // Remove caregiver demo users (cascades their careGroupMember rows)
  for (const email of [DEMO_CAREGIVER_1_EMAIL, DEMO_CAREGIVER_2_EMAIL]) {
    await db.delete(users).where(eq(users.email, email))
  }
}

// ── Create a user + password identity row ─────────────────────────────────────
async function createUser(
  email: string,
  displayName: string,
  role: string,
  passwordHash: string | null = null
): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({
      email,
      displayName,
      passwordHash,
      isDemo: true,
      role,
      hipaaConsent: true,
      hipaaConsentAt: base,
      hipaaConsentVersion: '1.0',
    })
    .returning({ id: users.id })

  if (passwordHash) {
    await db.insert(userIdentities).values({
      userId: u.id,
      provider: 'password',
      providerSub: null,
      email,
    })
  }

  return u.id
}

// ── Main provisioning function ────────────────────────────────────────────────
export async function seedDemoAccount(): Promise<void> {
  const password = process.env.DEMO_ACCOUNT_PASSWORD
  if (!password) throw new Error('DEMO_ACCOUNT_PASSWORD env var is required')

  console.log('[seed-demo] Cleaning up previous run…')
  await cleanup()

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Creating users…')
  const passwordHash = await bcrypt.hash(password, 12)
  const patientId = await createUser(DEMO_EMAIL, 'Jordan Meridian', 'patient', passwordHash)
  const cg1Id = await createUser(DEMO_CAREGIVER_1_EMAIL, 'Sam Meridian', 'caregiver')
  const cg2Id = await createUser(DEMO_CAREGIVER_2_EMAIL, 'Dana Meridian', 'caregiver')

  // ── Care profile ───────────────────────────────────────────────────────────
  console.log('[seed-demo] Creating care profile…')
  const [profile] = await db
    .insert(careProfiles)
    .values({
      userId: patientId,
      patientName: 'Jordan Meridian',
      patientAge: 54,
      relationship: 'self',
      cancerType: 'HER2+ Breast Cancer',
      cancerStage: 'Stage IIIA',
      treatmentPhase: 'active_treatment',
      conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nOsteoporosis',
      allergies: 'Sulfa drugs\nLatex',
      onboardingCompleted: true,
      onboardingPriorities: ['medications', 'lab_results', 'appointments', 'side_effects'],
      // Synthetic DOB — not based on any real person
      dateOfBirth: '1970-08-15',
      sexAtBirth: 'female',
      diagnosisDate: isoDate(daysAgo(180)),
      ecogStatus: 1,
      biomarkers: { HER2: 'positive', ER: 'positive', PR: 'negative', Ki67: '28%' },
      priorTreatments: 'Lumpectomy (6 months ago)',
      role: 'patient',
      emergencyContactName: 'Sam Meridian',
      emergencyContactPhone: '555-0100',
    })
    .returning({ id: careProfiles.id })

  const profileId = profile.id

  // ── User settings ──────────────────────────────────────────────────────────
  await db.insert(userSettings).values({
    userId: patientId,
    refillReminders: true,
    appointmentReminders: true,
    labAlerts: true,
    claimUpdates: true,
    aiPersonality: 'friendly',
  })

  // ── Care group with 2 caregivers ───────────────────────────────────────────
  console.log('[seed-demo] Creating care group…')
  const groupPasswordHash = await bcrypt.hash('MeridianCare2026!', 12)
  const [group] = await db
    .insert(careGroups)
    .values({
      name: 'Meridian Care Team',
      passwordHash: groupPasswordHash,
      createdBy: patientId,
    })
    .returning({ id: careGroups.id })

  await db.insert(careGroupMembers).values([
    {
      careGroupId: group.id,
      userId: patientId,
      role: 'owner',
      userType: 'patient',
      perms: { can_read_meds: true, can_read_appts: true, can_read_labs: true, can_chat: true, can_edit_appts: true },
    },
    {
      careGroupId: group.id,
      userId: cg1Id,
      role: 'member',
      userType: 'caregiver',
      relationship: 'spouse',
      perms: { can_read_meds: true, can_read_appts: true, can_read_labs: true, can_chat: true, can_edit_appts: false },
    },
    {
      careGroupId: group.id,
      userId: cg2Id,
      role: 'member',
      userType: 'caregiver',
      relationship: 'parent',
      perms: { can_read_meds: true, can_read_appts: true, can_read_labs: false, can_chat: true, can_edit_appts: false },
    },
  ])

  // ── 6 Medications ──────────────────────────────────────────────────────────
  console.log('[seed-demo] Inserting medications…')
  await db.insert(medications).values([
    {
      careProfileId: profileId,
      name: 'Trastuzumab (Herceptin)',
      dose: '440mg',
      frequency: 'IV every 3 weeks',
      prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)',
      refillDate: isoDate(daysFromNow(7)),
      notes: 'Demo data',
    },
    {
      careProfileId: profileId,
      name: 'Pertuzumab (Perjeta)',
      dose: '840mg loading / 420mg maintenance',
      frequency: 'IV every 3 weeks',
      prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)',
      refillDate: isoDate(daysFromNow(7)),
      notes: 'Demo data',
    },
    {
      careProfileId: profileId,
      name: 'Docetaxel (Taxotere)',
      dose: '75 mg/m²',
      frequency: 'IV every 3 weeks',
      prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)',
      refillDate: isoDate(daysFromNow(7)),
      notes: 'Demo data',
    },
    {
      careProfileId: profileId,
      name: 'Ondansetron (Zofran)',
      dose: '8mg',
      frequency: 'As needed for nausea (max 3× daily)',
      prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)',
      refillDate: isoDate(daysFromNow(3)),
      notes: 'Demo data',
    },
    {
      careProfileId: profileId,
      name: 'Dexamethasone',
      dose: '4mg',
      frequency: 'Before chemotherapy infusion',
      prescribingDoctor: 'Dr. Lisa Chen (Medical Oncology)',
      refillDate: isoDate(daysFromNow(14)),
      notes: 'Demo data',
    },
    {
      careProfileId: profileId,
      name: 'Tamoxifen',
      dose: '20mg',
      frequency: 'Once daily — morning with food',
      prescribingDoctor: 'Dr. Maria Santos (Primary Care)',
      refillDate: isoDate(daysFromNow(21)),
      notes: 'Demo data',
    },
  ])

  // ── 12 Lab Values (2 draw dates × 6 panels) ────────────────────────────────
  console.log('[seed-demo] Inserting lab results…')
  await db.insert(labResults).values([
    // Draw 1 — 3 days ago (most recent)
    { userId: patientId, testName: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/µL', referenceRange: '4.5–11.0', isAbnormal: true,  directionIsGood: false, dateTaken: isoDate(daysAgo(3)),  source: 'Demo data' },
    { userId: patientId, testName: 'HER2/neu',               value: '15.8', unit: 'ng/mL', referenceRange: '<15.0',   isAbnormal: true,  directionIsGood: false, dateTaken: isoDate(daysAgo(3)),  source: 'Demo data' },
    { userId: patientId, testName: 'CA 15-3',                value: '28.5', unit: 'U/mL', referenceRange: '<30',      isAbnormal: false, directionIsGood: true,  dateTaken: isoDate(daysAgo(3)),  source: 'Demo data' },
    { userId: patientId, testName: 'Hemoglobin',             value: '11.2', unit: 'g/dL', referenceRange: '12.0–16.0', isAbnormal: true, directionIsGood: false, dateTaken: isoDate(daysAgo(3)),  source: 'Demo data' },
    { userId: patientId, testName: 'Platelet Count',         value: '148', unit: 'K/µL', referenceRange: '150–400',   isAbnormal: true,  directionIsGood: false, dateTaken: isoDate(daysAgo(3)),  source: 'Demo data' },
    { userId: patientId, testName: 'Creatinine',             value: '0.9',  unit: 'mg/dL', referenceRange: '0.6–1.2', isAbnormal: false, directionIsGood: null,  dateTaken: isoDate(daysAgo(3)),  source: 'Demo data' },
    // Draw 2 — 21 days ago (prior cycle)
    { userId: patientId, testName: 'WBC (White Blood Cells)', value: '3.8', unit: 'K/µL', referenceRange: '4.5–11.0', isAbnormal: true,  directionIsGood: false, dateTaken: isoDate(daysAgo(21)), source: 'Demo data' },
    { userId: patientId, testName: 'HER2/neu',               value: '16.4', unit: 'ng/mL', referenceRange: '<15.0',   isAbnormal: true,  directionIsGood: false, dateTaken: isoDate(daysAgo(21)), source: 'Demo data' },
    { userId: patientId, testName: 'CA 15-3',                value: '31.2', unit: 'U/mL', referenceRange: '<30',      isAbnormal: true,  directionIsGood: false, dateTaken: isoDate(daysAgo(21)), source: 'Demo data' },
    { userId: patientId, testName: 'Hemoglobin',             value: '10.9', unit: 'g/dL', referenceRange: '12.0–16.0', isAbnormal: true, directionIsGood: false, dateTaken: isoDate(daysAgo(21)), source: 'Demo data' },
    { userId: patientId, testName: 'ALT',                    value: '22',   unit: 'U/L',  referenceRange: '7–56',      isAbnormal: false, directionIsGood: null, dateTaken: isoDate(daysAgo(21)), source: 'Demo data' },
    { userId: patientId, testName: 'Neutrophils (ANC)',      value: '1.8',  unit: 'K/µL', referenceRange: '1.8–7.7',  isAbnormal: false, directionIsGood: null,  dateTaken: isoDate(daysAgo(21)), source: 'Demo data' },
  ])

  // ── 5 Notifications ────────────────────────────────────────────────────────
  console.log('[seed-demo] Inserting notifications…')
  await db.insert(notifications).values([
    {
      userId: patientId,
      type: 'lab_result',
      title: 'Low WBC — Neutropenia Watch',
      message: 'WBC is 3.2 K/µL (normal: 4.5–11.0). Monitor for fever over 100.4°F or signs of infection.',
      isRead: false,
      createdAt: daysAgo(1),
    },
    {
      userId: patientId,
      type: 'refill',
      title: 'Ondansetron (Zofran) refill due in 3 days',
      message: 'Approximately 12 tablets remaining. Refill before your next infusion on Day 7.',
      isRead: false,
      createdAt: daysAgo(2),
    },
    {
      userId: patientId,
      type: 'appointment',
      title: 'Oncology follow-up in 3 days',
      message: 'Dr. Lisa Chen · Cancer Center Clinic 2 · 10:00 AM. Bring your symptom log.',
      isRead: false,
      createdAt: daysAgo(2),
    },
    {
      userId: patientId,
      type: 'lab_result',
      title: 'CA 15-3 trending down — positive sign',
      message: 'CA 15-3 dropped from 31.2 → 28.5 U/mL over 3 weeks. Trend suggests treatment response.',
      isRead: true,
      createdAt: daysAgo(3),
    },
    {
      userId: patientId,
      type: 'appointment',
      title: 'Sam logged your evening medications',
      message: 'Your care partner Sam confirmed your 8 PM dose and noted mild fatigue today.',
      isRead: true,
      createdAt: daysAgo(5),
    },
  ])

  // ── 10 Wellness Check-ins (spread over 30 days) ───────────────────────────
  console.log('[seed-demo] Inserting wellness check-ins…')
  const checkinRows: Array<{
    dAgo: number; mood: number; pain: number; energy: string; sleep: string; notes: string | null
  }> = [
    { dAgo: 1,  mood: 3, pain: 4, energy: 'low',    sleep: 'ok',   notes: 'Mild nausea after afternoon dose' },
    { dAgo: 3,  mood: 4, pain: 3, energy: 'medium', sleep: 'good', notes: null },
    { dAgo: 5,  mood: 3, pain: 5, energy: 'low',    sleep: 'bad',  notes: 'Chemo fatigue, rough night' },
    { dAgo: 7,  mood: 4, pain: 2, energy: 'medium', sleep: 'ok',   notes: null },
    { dAgo: 10, mood: 5, pain: 1, energy: 'high',   sleep: 'good', notes: 'Good energy today' },
    { dAgo: 14, mood: 3, pain: 4, energy: 'low',    sleep: 'ok',   notes: null },
    { dAgo: 17, mood: 4, pain: 3, energy: 'medium', sleep: 'good', notes: null },
    { dAgo: 20, mood: 2, pain: 6, energy: 'low',    sleep: 'bad',  notes: 'Infusion day, expected tiredness' },
    { dAgo: 24, mood: 4, pain: 2, energy: 'medium', sleep: 'ok',   notes: null },
    { dAgo: 28, mood: 5, pain: 1, energy: 'high',   sleep: 'good', notes: 'Strong week overall' },
  ]

  await db.insert(wellnessCheckins).values(
    checkinRows.map(({ dAgo, mood, pain, energy, sleep, notes }) => ({
      careProfileId: profileId,
      reportedByUserId: patientId,
      mood,
      pain,
      energy,
      sleep,
      notes,
      checkedInAt: daysAgo(dAgo),
    }))
  )

  // ── 30 days Wellness Vitals (synthetic, bypasses HealthKit requirement) ────
  console.log('[seed-demo] Inserting synthetic wellness vitals (30 days)…')
  await db.insert(wellnessVitals).values(
    Array.from({ length: 30 }, (_, i) => ({
      careProfileId: profileId,
      capturedAt: daysAgo(30 - i),
      // Deterministic waves mimic realistic low-activity chemo patient patterns
      steps: Math.max(400, 3200 + wave(i, 1200, 0.42) + wave(i, 500, 1.1, 1.0)),
      heartRate: String(68 + wave(i, 7, 0.33) + wave(i, 3, 0.9, 0.5)),
      sleepHours: String((6.5 + 0.8 * Math.sin(i * 0.5) + 0.35 * Math.sin(i * 1.3 + 0.2)).toFixed(1)),
      bodyMass: String((68.2 + 0.6 * Math.sin(i * 0.12)).toFixed(1)),
    }))
  )

  // ── 30-day Chat History (6 conversations) ─────────────────────────────────
  console.log('[seed-demo] Inserting chat history…')
  const convData = [
    {
      title: 'Side effects from last infusion',
      dAgo: 28,
      msgs: [
        { role: 'user', text: "I've been having nausea and fatigue after my last infusion. Is this normal with Docetaxel?" },
        { role: 'assistant', text: "Yes — nausea and fatigue are among the most common Docetaxel side effects. They typically peak 24–48 hours after infusion and improve over the following week. Your Ondansetron is prescribed specifically for this; take it as needed rather than waiting for severe nausea. Stay hydrated, rest when possible, and contact Dr. Chen's office immediately if your temperature exceeds 100.4°F, which can indicate neutropenia." },
        { role: 'user', text: "How long does the fatigue usually last?" },
        { role: 'assistant', text: "Most patients find Docetaxel fatigue is worst on days 3–7 post-infusion, then gradually improves. By day 14 many feel notably better. Given your current WBC of 3.2, your body is working hard — prioritize rest, light short walks, and small frequent meals to maintain energy and nutrition." },
        { role: 'user', text: "Should I be worried about my WBC being low?" },
      ],
    },
    {
      title: 'Understanding my WBC results',
      dAgo: 24,
      msgs: [
        { role: 'user', text: "My WBC is 3.2 — the report says below normal. What does that mean for me?" },
        { role: 'assistant', text: "A WBC of 3.2 K/µL is mildly below the normal range of 4.5–11.0, called leukopenia. This is expected during chemotherapy — Docetaxel temporarily suppresses bone marrow. Dr. Chen will monitor this before each infusion. The key warning signs: fever over 100.4°F, unusual infections, chills, or a sudden feeling of being much worse — any of these warrant same-day contact with your oncology team." },
        { role: 'user', text: "Will this affect whether I can get my next infusion?" },
        { role: 'assistant', text: "Possibly. Your CBC is checked before each infusion and there are thresholds below which treatment gets delayed to allow recovery. At 3.2 you're in the monitoring zone — not an immediate hold — but Dr. Chen will assess your trend at your appointment in 3 days, which includes bloodwork." },
        { role: 'user', text: "Is there anything I can do to help my counts come back up?" },
      ],
    },
    {
      title: 'Preparing questions for Dr. Chen',
      dAgo: 18,
      msgs: [
        { role: 'user', text: "I have my oncology appointment coming up. Can you help me prepare questions for Dr. Chen?" },
        { role: 'assistant', text: "Absolutely. Based on your recent data, here are the highest-priority questions:\n\n1. **WBC trend** — \"My WBC has been 3.2–3.8 over two draws. Should I consider Neulasta for future cycles?\"\n2. **HER2/neu tracking** — \"My HER2/neu dropped from 16.4 to 15.8 — what does this trend tell us about Herceptin response?\"\n3. **CA 15-3 improvement** — \"CA 15-3 went 31.2 → 28.5. Is this early evidence the treatment is working?\"\n4. **Cardiac monitoring** — \"When is my next echocardiogram? Herceptin can affect cardiac function.\"\n5. **Fatigue** — \"Is my current fatigue level expected, or is anemia contributing more than the chemo?\"" },
        { role: 'user', text: "What should I bring to the appointment?" },
        { role: 'assistant', text: "Bring:\n• Symptom log from the past 3 weeks (pain, nausea frequency, energy)\n• Full medication list including any supplements (some interact with chemo)\n• Any new symptoms since your last visit\n• A care team member if possible — Sam can help remember details\n• Something to take notes on — treatment plan changes are easy to forget under stress" },
        { role: 'user', text: "Thank you — I feel much more prepared now." },
      ],
    },
    {
      title: 'Tamoxifen and long-term treatment',
      dAgo: 14,
      msgs: [
        { role: 'user', text: "Why am I on Tamoxifen alongside chemotherapy? I thought it was for after chemo." },
        { role: 'assistant', text: "Good question. Tamoxifen is typically a hormone therapy used after chemotherapy for ER+ tumors — it blocks estrogen from fueling cancer growth. If you're taking it concurrently with chemo, Dr. Chen made a specific clinical decision for your situation. I'd recommend confirming the timing and rationale at your next appointment." },
        { role: 'user', text: "How long would I need to take it?" },
        { role: 'assistant', text: "Standard guidelines recommend Tamoxifen for 5–10 years post-chemotherapy for ER+ breast cancer. The extended 10-year regimen (ATLAS trial) further reduces recurrence risk, particularly for premenopausal patients. Dr. Chen will factor in your age, menopausal status, and overall risk when deciding your duration." },
        { role: 'user', text: "What side effects should I know about?" },
      ],
    },
    {
      title: 'Nutrition and weight during chemo',
      dAgo: 8,
      msgs: [
        { role: 'user', text: "I've been having trouble eating. What foods are easiest to tolerate during chemo?" },
        { role: 'assistant', text: "During chemo the goal is getting calories in, not perfect nutrition. What tends to work well:\n\n**Easy on the stomach:** Plain crackers, toast, rice, bananas, ginger tea (helps nausea), cold or room-temp foods (less smell than hot), small meals every 2–3 hours.\n\n**Gentle protein sources:** Scrambled eggs, Greek yogurt, peanut butter, protein smoothies.\n\n**Avoid:** Greasy or fried foods, strong smells, alcohol, raw fish or meat (infection risk with low WBC)." },
        { role: 'user', text: "My weight has dropped about 3 pounds this month. Should I be concerned?" },
        { role: 'assistant', text: "A 3-pound drop during active chemo is worth monitoring. Nausea and taste changes often reduce intake. If you continue losing weight or find eating very difficult, ask Dr. Chen about a referral to an oncology dietitian — most cancer centers offer this and it meaningfully improves energy and treatment tolerance." },
        { role: 'user', text: "Someone suggested I take extra vitamin C. Is that safe?" },
      ],
    },
    {
      title: 'Care team coordination',
      dAgo: 2,
      msgs: [
        { role: 'user', text: "Sam (my spouse) wants to know what they can actually do to help day-to-day." },
        { role: 'assistant', text: "Sam has several options in the Care Team view:\n\n• **Log medications** — confirm daily doses, especially on your harder days\n• **Track symptoms** — log your mood, pain, and energy if you're too fatigued to do it yourself\n• **See your schedule** — upcoming appointments and infusion dates are visible to care team members\n• **Receive key alerts** — significant lab changes and missed check-ins can notify Sam directly\n\nResearch consistently shows the most valuable caregiver role is simply being present at appointments — a second set of ears remembers information that's easy to forget under stress." },
        { role: 'user', text: "How does Sam join my care team?" },
        { role: 'assistant', text: "Go to the Care Team tab and tap \"Invite Caregiver.\" Enter Sam's email and they'll receive an invitation link. Once accepted, you control exactly what Sam can see — medications, labs, appointments — using the permission toggles on their profile card. Sam can also join directly using the care group code for the Meridian Care Team." },
        { role: 'user', text: "Perfect, thanks for walking me through that." },
      ],
    },
  ]

  for (const topic of convData) {
    const convStart = daysAgo(topic.dAgo)
    const [conv] = await db
      .insert(conversations)
      .values({
        userId: patientId,
        title: topic.title,
        lastMessagePreview: topic.msgs.at(-1)!.text.slice(0, 100),
        messageCount: topic.msgs.length,
        createdAt: convStart,
        updatedAt: convStart,
      })
      .returning({ id: conversations.id })

    await db.insert(messages).values(
      topic.msgs.map((m, j) => ({
        userId: patientId,
        conversationId: conv.id,
        role: m.role,
        content: m.text,
        createdAt: new Date(convStart.getTime() + j * 5 * 60_000),
      }))
    )

    console.log(`[seed-demo]   → "${topic.title}"`)
  }

  console.log('\n[seed-demo] ✓ Demo account provisioned successfully.')
  console.log(`  Email:      ${DEMO_EMAIL}`)
  console.log(`  Password:   (from DEMO_ACCOUNT_PASSWORD env var)`)
  console.log(`  Patient:    Jordan Meridian, HER2+ Breast Cancer Stage IIIA`)
  console.log(`  Caregivers: ${DEMO_CAREGIVER_1_EMAIL} (spouse), ${DEMO_CAREGIVER_2_EMAIL} (parent)`)
  console.log(`  Data:       6 meds, 12 labs, 6 conversations, 5 notifications, 10 check-ins, 30-day vitals\n`)
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────
if (require.main === module) {
  seedDemoAccount()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-demo] Fatal:', err)
      process.exit(1)
    })
}
