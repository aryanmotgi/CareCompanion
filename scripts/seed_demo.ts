/**
 * Provision demo@carecompanionai.org
 *
 * Creates the Cognito user + DB record + seeds full HER2+ demo data.
 * Safe to run multiple times — idempotent.
 *
 * Usage:
 *   npx tsx scripts/seed_demo.ts
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  RDSDataClient,
  ExecuteStatementCommand,
} from '@aws-sdk/client-rds-data';

const DEMO_EMAIL = 'demo@carecompanionai.org';
const DEMO_PASSWORD = 'CareDemo2026';
const DEMO_DISPLAY_NAME = 'Demo User';

const REGION = 'us-east-1';
const USER_POOL_ID = 'us-east-1_ZLns0ABGw';
const RESOURCE_ARN = process.env.RESOURCE_ARN ?? 'arn:aws:rds:us-east-1:136455701483:cluster:database-3';
const SECRET_ARN = process.env.SECRET_ARN ?? 'arn:aws:secretsmanager:us-east-1:136455701483:secret:carecompanion/db-SHzJzs';
const DB = 'carecompanion';

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
};

const cognito = new CognitoIdentityProviderClient({ region: REGION, credentials: creds });
const rds = new RDSDataClient({ region: REGION, credentials: creds });

async function sql(query: string) {
  const res = await rds.send(new ExecuteStatementCommand({
    resourceArn: RESOURCE_ARN,
    secretArn: SECRET_ARN,
    database: DB,
    sql: query,
    includeResultMetadata: true,
  }));
  return res;
}

function day(d: number) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x;
}
function dayISO(d: number) { return day(d).toISOString().split('T')[0]; }
function dayTime(d: number, h: number, m: number) {
  const x = day(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 Provisioning ${DEMO_EMAIL}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // ── 1. Cognito ─────────────────────────────────────────────────────────────
  console.log('🔐 Step 1: Checking Cognito...');
  let providerSub: string | undefined;

  const listRes = await cognito.send(new ListUsersCommand({
    UserPoolId: USER_POOL_ID,
    Filter: `email = "${DEMO_EMAIL}"`,
  }));
  const existingCognito = listRes.Users?.[0];
  providerSub = existingCognito?.Attributes?.find((a) => a.Name === 'sub')?.Value;

  if (providerSub) {
    console.log(`   ✅ Cognito user exists (sub: ${providerSub})`);
    // Reset password in case it changed
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: DEMO_EMAIL,
      Password: DEMO_PASSWORD,
      Permanent: true,
    }));
    console.log(`   🔑 Password reset to: ${DEMO_PASSWORD}`);
  } else {
    console.log(`   ➕ Creating Cognito user...`);
    const createRes = await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: DEMO_EMAIL,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: DEMO_EMAIL },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:display_name', Value: DEMO_DISPLAY_NAME },
      ],
      TemporaryPassword: DEMO_PASSWORD + 'Tmp1!',
    }));
    providerSub = createRes.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;

    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: DEMO_EMAIL,
      Password: DEMO_PASSWORD,
      Permanent: true,
    }));
    console.log(`   ✅ Created (sub: ${providerSub})`);
    console.log(`   🔑 Password set to: ${DEMO_PASSWORD}`);
  }

  if (!providerSub) throw new Error('Could not determine Cognito sub');

  // ── 2. DB user record ──────────────────────────────────────────────────────
  console.log('\n👤 Step 2: Upserting users table...');
  const userRes = await sql(`
    INSERT INTO users (id, cognito_sub, email, display_name, is_demo)
    VALUES (gen_random_uuid(), '${providerSub}', '${DEMO_EMAIL}', '${DEMO_DISPLAY_NAME}', true)
    ON CONFLICT (cognito_sub) DO UPDATE SET email = '${DEMO_EMAIL}', display_name = '${DEMO_DISPLAY_NAME}'
    RETURNING id
  `);
  const userId = userRes.records?.[0]?.[0]?.stringValue;
  if (!userId) throw new Error('Could not get user ID from DB');
  console.log(`   ✅ User ID: ${userId}`);

  // ── 3. Check existing profile ──────────────────────────────────────────────
  console.log('\n🔍 Step 3: Checking existing profile...');
  const profileCheck = await sql(`SELECT id FROM care_profiles WHERE user_id = '${userId}' LIMIT 1`);
  const existingProfileId = profileCheck.records?.[0]?.[0]?.stringValue;

  if (existingProfileId) {
    console.log(`   ⚠️  Profile exists (${existingProfileId}) — clearing old data...`);
    await sql(`DELETE FROM medication_reminders WHERE user_id = '${userId}'`);
    await sql(`DELETE FROM medications WHERE care_profile_id = '${existingProfileId}'`);
    await sql(`DELETE FROM appointments WHERE care_profile_id = '${existingProfileId}'`);
    await sql(`DELETE FROM doctors WHERE care_profile_id = '${existingProfileId}'`);
    await sql(`DELETE FROM lab_results WHERE user_id = '${userId}'`);
    await sql(`DELETE FROM notifications WHERE user_id = '${userId}'`);
    await sql(`DELETE FROM insurance WHERE user_id = '${userId}'`);
    await sql(`DELETE FROM user_settings WHERE user_id = '${userId}'`);
    await sql(`DELETE FROM care_profiles WHERE id = '${existingProfileId}'`);
    console.log(`   ✅ Cleared`);
  } else {
    console.log(`   ✅ No existing profile`);
  }

  // ── 4. Care profile ────────────────────────────────────────────────────────
  console.log('\n🏥 Step 4: Creating care profile...');
  const profileRes = await sql(`
    INSERT INTO care_profiles (id, user_id, patient_name, patient_age, relationship, cancer_type, cancer_stage, treatment_phase, conditions, allergies, onboarding_completed)
    VALUES (gen_random_uuid(), '${userId}', 'Margaret Chen', 58, 'self', 'HER2+ Breast Cancer', 'Stage IIIA', 'active_treatment',
      'Stage IIIA Breast Cancer (HER2+, ER+)
Hypertension
Osteoporosis
Anxiety',
      'Sulfa drugs
Latex
Ibuprofen (causes GI upset)',
      true)
    RETURNING id
  `);
  const careProfileId = profileRes.records?.[0]?.[0]?.stringValue;
  if (!careProfileId) throw new Error('Could not get care profile ID');
  console.log(`   ✅ Profile ID: ${careProfileId}`);

  // ── 5. Medications ─────────────────────────────────────────────────────────
  console.log('\n💊 Step 5: Adding medications...');
  const medsInsert = await sql(`
    INSERT INTO medications (id, care_profile_id, name, dose, frequency, prescribing_doctor, refill_date, notes) VALUES
    (gen_random_uuid(), '${careProfileId}', 'Trastuzumab (Herceptin)', '440mg', 'IV every 3 weeks', 'Dr. Lisa Chen (Medical Oncology)', '${dayISO(7)}', 'HER2-targeted therapy. Monitor cardiac function (echo every 3 months).'),
    (gen_random_uuid(), '${careProfileId}', 'Pertuzumab (Perjeta)', '840mg', 'IV every 3 weeks', 'Dr. Lisa Chen (Medical Oncology)', '${dayISO(7)}', 'HER2-targeted therapy given with Herceptin. Watch for diarrhea.'),
    (gen_random_uuid(), '${careProfileId}', 'Docetaxel (Taxotere)', '75mg/m²', 'IV every 3 weeks', 'Dr. Lisa Chen (Medical Oncology)', '${dayISO(7)}', 'Taxane chemotherapy. Main side effects: neuropathy, hair loss, low blood counts.'),
    (gen_random_uuid(), '${careProfileId}', 'Ondansetron (Zofran)', '8mg', 'As needed for nausea', 'Dr. Lisa Chen (Medical Oncology)', '${dayISO(3)}', 'Take at first sign of nausea. May cause constipation.'),
    (gen_random_uuid(), '${careProfileId}', 'Dexamethasone', '4mg', 'Before chemo infusion', 'Dr. Lisa Chen (Medical Oncology)', '${dayISO(7)}', 'Pre-medication for chemo. Take night before and morning of infusion.'),
    (gen_random_uuid(), '${careProfileId}', 'Tamoxifen', '20mg', 'Once daily', 'Dr. Lisa Chen (Medical Oncology)', '${dayISO(25)}', 'Hormone therapy. Long-term maintenance (5-10 years).'),
    (gen_random_uuid(), '${careProfileId}', 'Lisinopril', '10mg', 'Once daily — morning', 'Dr. Maria Santos (Primary Care)', '${dayISO(20)}', 'Blood pressure control.'),
    (gen_random_uuid(), '${careProfileId}', 'Lorazepam (Ativan)', '0.5mg', 'As needed for anxiety', 'Dr. Maria Santos (Primary Care)', '${dayISO(30)}', 'PRN for anxiety before scans or procedures. Do not mix with alcohol.')
    RETURNING id, name
  `);
  const insertedMeds = medsInsert.records?.map((r) => ({
    id: r[0]?.stringValue!,
    name: r[1]?.stringValue!,
  })) ?? [];
  console.log(`   ✅ ${insertedMeds.length} medications`);

  // ── 6. Lab results ─────────────────────────────────────────────────────────
  console.log('\n🧪 Step 6: Adding lab results...');
  await sql(`
    INSERT INTO lab_results (id, user_id, test_name, value, unit, reference_range, is_abnormal, date_taken, source) VALUES
    (gen_random_uuid(), '${userId}', 'WBC (White Blood Cells)', '3.2', 'K/uL', '4.5-11.0', true, '${dayISO(-2)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'Hemoglobin', '11.2', 'g/dL', '12.0-16.0', true, '${dayISO(-2)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'Platelet Count', '145', 'K/uL', '150-400', true, '${dayISO(-2)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'Creatinine', '0.9', 'mg/dL', '0.6-1.2', false, '${dayISO(-2)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'ALT', '22', 'U/L', '7-56', false, '${dayISO(-2)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'HER2/neu', '15.8', 'ng/mL', '<15.0', true, '${dayISO(-5)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'CA 15-3', '28.5', 'U/mL', '<30', false, '${dayISO(-5)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'WBC (White Blood Cells)', '4.1', 'K/uL', '4.5-11.0', true, '${dayISO(-23)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'Hemoglobin', '11.8', 'g/dL', '12.0-16.0', true, '${dayISO(-23)}', 'Demo'),
    (gen_random_uuid(), '${userId}', 'Platelet Count', '168', 'K/uL', '150-400', false, '${dayISO(-23)}', 'Demo')
  `);
  console.log(`   ✅ 10 lab results`);

  // ── 7. Appointments ────────────────────────────────────────────────────────
  console.log('\n📅 Step 7: Adding appointments...');
  await sql(`
    INSERT INTO appointments (id, care_profile_id, doctor_name, specialty, date_time, location, purpose) VALUES
    (gen_random_uuid(), '${careProfileId}', 'Dr. Lisa Chen', 'Medical Oncology', '${dayTime(3, 10, 0)}', 'Cancer Center — Clinic 2, Room 204', 'Oncology follow-up — treatment response review'),
    (gen_random_uuid(), '${careProfileId}', 'Lab Work', 'Laboratory', '${dayTime(6, 8, 0)}', 'Cancer Center — Lab', 'Pre-chemo bloodwork (CBC, CMP, tumor markers)'),
    (gen_random_uuid(), '${careProfileId}', 'Infusion Center', 'Medical Oncology', '${dayTime(7, 9, 0)}', 'Cancer Center — Infusion Suite B', 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere'),
    (gen_random_uuid(), '${careProfileId}', 'Dr. James Park', 'Cardiology', '${dayTime(14, 11, 0)}', 'Heart & Vascular Center', 'Echocardiogram — Herceptin cardiac monitoring'),
    (gen_random_uuid(), '${careProfileId}', 'Dr. Rachel Kim', 'Breast Surgery', '${dayTime(28, 14, 30)}', 'Cancer Center — Surgery Clinic', 'Post-treatment surgical consult')
  `);
  console.log(`   ✅ 5 appointments`);

  // ── 8. Doctors ─────────────────────────────────────────────────────────────
  console.log('\n👨‍⚕️  Step 8: Adding doctors...');
  await sql(`
    INSERT INTO doctors (id, care_profile_id, name, specialty, phone, notes) VALUES
    (gen_random_uuid(), '${careProfileId}', 'Dr. Lisa Chen', 'Medical Oncologist', '555-0201', 'Lead oncologist. Reachable via MyChart. Nurse line: 555-0211.'),
    (gen_random_uuid(), '${careProfileId}', 'Dr. James Park', 'Cardiologist', '555-0202', 'Monitoring cardiac function during Herceptin treatment.'),
    (gen_random_uuid(), '${careProfileId}', 'Dr. Maria Santos', 'Primary Care', '555-0203', 'Managing BP, anxiety, general health.'),
    (gen_random_uuid(), '${careProfileId}', 'Dr. Rachel Kim', 'Breast Surgeon', '555-0204', 'Surgical oncologist. Did initial lumpectomy.'),
    (gen_random_uuid(), '${careProfileId}', 'Sarah Johnson, RN', 'Oncology Nurse Navigator', '555-0211', 'First point of contact for treatment questions or side effects.')
  `);
  console.log(`   ✅ 5 doctors`);

  // ── 9. Insurance ───────────────────────────────────────────────────────────
  console.log('\n🏥 Step 9: Adding insurance...');
  await sql(`
    INSERT INTO insurance (id, user_id, provider, member_id, group_number, plan_year)
    VALUES (gen_random_uuid(), '${userId}', 'Blue Cross Blue Shield', 'BCB-882991-04', 'GRP-7420', ${new Date().getFullYear()})
  `);
  console.log(`   ✅ BCBS`);

  // ── 10. Notifications ──────────────────────────────────────────────────────
  console.log('\n🔔 Step 10: Adding notifications...');
  await sql(`
    INSERT INTO notifications (id, user_id, type, title, message, is_read) VALUES
    (gen_random_uuid(), '${userId}', 'lab_result', 'Low WBC — Neutropenia Warning', 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever or signs of infection. Contact oncology if temp > 100.4°F.', false),
    (gen_random_uuid(), '${userId}', 'refill', 'Ondansetron (Zofran) refill soon', '12 tablets remaining. Refill due in 3 days — you will need these for your next infusion.', false),
    (gen_random_uuid(), '${userId}', 'appointment', 'Oncology follow-up in 3 days', 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM. Review treatment response.', false),
    (gen_random_uuid(), '${userId}', 'appointment', 'Chemo infusion in 1 week', 'Cycle 4 infusion on Thursday. Remember pre-meds (Dexamethasone) night before and morning of.', false),
    (gen_random_uuid(), '${userId}', 'lab_result', 'HER2/neu slightly elevated', 'HER2/neu is 15.8 ng/mL (normal: <15.0). Discuss trend with Dr. Chen at your next visit.', true)
  `);
  console.log(`   ✅ 5 notifications`);

  // ── 11. User settings ──────────────────────────────────────────────────────
  console.log('\n⚙️  Step 11: Adding user settings...');
  await sql(`
    INSERT INTO user_settings (user_id, refill_reminders, appointment_reminders, lab_alerts, claim_updates, ai_personality)
    VALUES ('${userId}', true, true, true, true, 'friendly')
    ON CONFLICT (user_id) DO UPDATE SET
      refill_reminders = true, appointment_reminders = true, lab_alerts = true,
      claim_updates = true, ai_personality = 'friendly'
  `);
  console.log(`   ✅ Settings saved`);

  // ── 12. Medication reminders ───────────────────────────────────────────────
  console.log('\n⏰ Step 12: Adding medication reminders...');
  const dailyMeds = insertedMeds.filter((m) => m.name === 'Tamoxifen' || m.name === 'Lisinopril');

  for (const med of dailyMeds) {
    const reminderTime = med.name === 'Lisinopril' ? '08:00' : '21:00';
    const dose = med.name === 'Tamoxifen' ? '20mg' : '10mg';
    const reminderRes = await sql(`
      INSERT INTO medication_reminders (id, user_id, medication_id, medication_name, dose, reminder_times, days_of_week, is_active)
      VALUES (gen_random_uuid(), '${userId}', '${med.id}', '${med.name}', '${dose}',
        ARRAY['${reminderTime}'], ARRAY['mon','tue','wed','thu','fri','sat','sun'], true)
      RETURNING id
    `);
    const reminderId = reminderRes.records?.[0]?.[0]?.stringValue;
    if (!reminderId) continue;

    const hour = parseInt(reminderTime.split(':')[0]);
    const logRows = [];
    for (let d = 7; d >= 1; d--) {
      const dt = day(-d);
      dt.setHours(hour, 0, 0, 0);
      const isMissed = d === 4 && med.name === 'Tamoxifen';
      const respondedAt = isMissed ? 'NULL' : `'${new Date(dt.getTime() + 5 * 60000).toISOString()}'`;
      logRows.push(`(gen_random_uuid(), '${userId}', '${reminderId}', '${med.name}', '${dt.toISOString()}', '${isMissed ? 'missed' : 'taken'}', ${respondedAt})`);
    }
    await sql(`
      INSERT INTO reminder_logs (id, user_id, reminder_id, medication_name, scheduled_time, status, responded_at)
      VALUES ${logRows.join(',\n')}
    `);
    console.log(`   ✅ ${med.name} reminder + 7 days history`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ DEMO ACCOUNT READY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📧 Email:    ${DEMO_EMAIL}`);
  console.log(`🔑 Password: ${DEMO_PASSWORD}`);
  console.log(`👤 Patient:  Margaret Chen, 58F`);
  console.log(`🎗️  Cancer:   HER2+ Breast Cancer, Stage IIIA`);
  console.log(`💊 Meds:     ${insertedMeds.length}`);
  console.log(`🧪 Labs:     10`);
  console.log(`📅 Appts:    5`);
  console.log(`👨‍⚕️  Doctors:  5`);
  console.log(`🔔 Notifs:   5`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err);
  process.exit(1);
});
