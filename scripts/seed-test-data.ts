/**
 * Seed script: creates a test user with realistic data so you can
 * test the full app UI. Run with: npx tsx scripts/seed-test-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  console.log('🌱 Seeding test data...\n')

  // 1. Create anonymous test user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `testuser-${Date.now()}@test.local`,
    email_confirm: true,
    user_metadata: { display_name: 'Aryan Motgi' },
  })

  if (authError || !authData.user) {
    console.error('❌ Failed to create user:', authError)
    return
  }

  const userId = authData.user.id
  console.log(`✅ Created user: ${userId}`)

  // 2. Create care profile
  const { data: profile, error: profileError } = await supabase
    .from('care_profiles')
    .insert({
      user_id: userId,
      patient_name: 'Mom',
      patient_age: 67,
      relationship: 'parent',
      conditions: 'Type 2 Diabetes, Hypertension, High Cholesterol',
      allergies: 'Penicillin, Sulfa drugs',
    })
    .select()
    .single()

  if (profileError || !profile) {
    console.error('❌ Failed to create profile:', profileError)
    return
  }

  console.log(`✅ Created care profile: ${profile.id}`)

  const now = new Date()

  // 3. Seed medications (some with upcoming refills)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const in3Days = new Date(now)
  in3Days.setDate(in3Days.getDate() + 3)

  const in18Days = new Date(now)
  in18Days.setDate(in18Days.getDate() + 18)

  const in24Days = new Date(now)
  in24Days.setDate(in24Days.getDate() + 24)

  const in45Days = new Date(now)
  in45Days.setDate(in45Days.getDate() + 45)

  const medications = [
    {
      care_profile_id: profile.id,
      name: 'Lisinopril',
      dose: '10mg',
      frequency: 'Once daily - Morning',
      prescribing_doctor: 'Dr. Patel',
      refill_date: tomorrow.toISOString().split('T')[0],
      quantity_remaining: 3,
      notes: 'Take with water, monitor blood pressure',
    },
    {
      care_profile_id: profile.id,
      name: 'Metformin',
      dose: '500mg',
      frequency: 'Twice daily - With meals',
      prescribing_doctor: 'Dr. Chen',
      refill_date: in18Days.toISOString().split('T')[0],
      quantity_remaining: 36,
      notes: 'Extended release, do not crush',
    },
    {
      care_profile_id: profile.id,
      name: 'Atorvastatin',
      dose: '20mg',
      frequency: 'Once daily - Evening',
      prescribing_doctor: 'Dr. Patel',
      refill_date: in24Days.toISOString().split('T')[0],
      quantity_remaining: 24,
    },
    {
      care_profile_id: profile.id,
      name: 'Amlodipine',
      dose: '5mg',
      frequency: 'Once daily - Morning',
      prescribing_doctor: 'Dr. Patel',
      refill_date: in3Days.toISOString().split('T')[0],
      quantity_remaining: 5,
      notes: 'For blood pressure, may cause swelling',
    },
    {
      care_profile_id: profile.id,
      name: 'Vitamin D3',
      dose: '2000 IU',
      frequency: 'Once daily',
      prescribing_doctor: 'Dr. Chen',
      refill_date: in45Days.toISOString().split('T')[0],
      quantity_remaining: 60,
    },
  ]

  const { error: medError } = await supabase.from('medications').insert(medications)
  console.log(medError ? `❌ Meds: ${medError.message}` : `✅ Seeded ${medications.length} medications`)

  // 4. Seed appointments
  const thursday = new Date(now)
  thursday.setDate(thursday.getDate() + (4 - thursday.getDay() + 7) % 7 || 7)
  thursday.setHours(14, 30, 0, 0)

  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 10)
  nextWeek.setHours(10, 0, 0, 0)

  const in3Weeks = new Date(now)
  in3Weeks.setDate(in3Weeks.getDate() + 21)
  in3Weeks.setHours(9, 15, 0, 0)

  const dayAfterTomorrow = new Date(now)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
  dayAfterTomorrow.setHours(11, 0, 0, 0)

  const appointments = [
    {
      care_profile_id: profile.id,
      doctor_name: 'Dr. Patel',
      specialty: 'Cardiology',
      date_time: thursday.toISOString(),
      location: 'Heart & Vascular Center, Suite 200',
      purpose: 'Follow-up on blood pressure medication',
      prep_notes: 'Bring blood pressure log, fasting not required',
    },
    {
      care_profile_id: profile.id,
      doctor_name: 'Dr. Chen',
      specialty: 'Endocrinology',
      date_time: dayAfterTomorrow.toISOString(),
      location: 'Diabetes Care Clinic, Building B',
      purpose: 'A1C check and medication review',
      prep_notes: 'Fasting 8 hours, bring glucose log',
    },
    {
      care_profile_id: profile.id,
      doctor_name: 'Dr. Williams',
      specialty: 'Primary Care',
      date_time: nextWeek.toISOString(),
      location: 'Valley Medical Group',
      purpose: 'Annual wellness visit',
    },
    {
      care_profile_id: profile.id,
      doctor_name: 'Dr. Kim',
      specialty: 'Ophthalmology',
      date_time: in3Weeks.toISOString(),
      location: 'Eye Care Associates',
      purpose: 'Diabetic eye exam',
    },
  ]

  const { error: apptError } = await supabase.from('appointments').insert(appointments)
  console.log(apptError ? `❌ Appointments: ${apptError.message}` : `✅ Seeded ${appointments.length} appointments`)

  // 5. Seed lab results (some abnormal)
  const labResults = [
    {
      user_id: userId,
      test_name: 'LDL Cholesterol',
      value: '165',
      unit: 'mg/dL',
      reference_range: '< 100',
      is_abnormal: true,
      date_taken: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Quest Diagnostics',
    },
    {
      user_id: userId,
      test_name: 'Hemoglobin A1C',
      value: '7.2',
      unit: '%',
      reference_range: '< 5.7',
      is_abnormal: true,
      date_taken: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Quest Diagnostics',
    },
    {
      user_id: userId,
      test_name: 'Blood Pressure',
      value: '142/88',
      unit: 'mmHg',
      reference_range: '< 120/80',
      is_abnormal: true,
      date_taken: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Home Monitor',
    },
    {
      user_id: userId,
      test_name: 'Fasting Glucose',
      value: '95',
      unit: 'mg/dL',
      reference_range: '70-100',
      is_abnormal: false,
      date_taken: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Quest Diagnostics',
    },
    {
      user_id: userId,
      test_name: 'eGFR',
      value: '82',
      unit: 'mL/min',
      reference_range: '> 60',
      is_abnormal: false,
      date_taken: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Quest Diagnostics',
    },
  ]

  const { error: labError } = await supabase.from('lab_results').insert(labResults)
  console.log(labError ? `❌ Labs: ${labError.message}` : `✅ Seeded ${labResults.length} lab results`)

  // 6. Seed claims (one denied)
  const claims = [
    {
      user_id: userId,
      service_date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      provider_name: 'Heart & Vascular Center',
      billed_amount: 450.00,
      paid_amount: 360.00,
      patient_responsibility: 90.00,
      status: 'paid' as const,
    },
    {
      user_id: userId,
      service_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      provider_name: 'Quest Diagnostics',
      billed_amount: 285.00,
      paid_amount: 0,
      patient_responsibility: 285.00,
      status: 'denied' as const,
      denial_reason: 'Prior authorization required',
    },
    {
      user_id: userId,
      service_date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      provider_name: 'Valley Pharmacy',
      billed_amount: 45.00,
      paid_amount: 35.00,
      patient_responsibility: 10.00,
      status: 'paid' as const,
    },
  ]

  const { error: claimError } = await supabase.from('claims').insert(claims)
  console.log(claimError ? `❌ Claims: ${claimError.message}` : `✅ Seeded ${claims.length} claims`)

  // 7. Seed notifications
  const notifications = [
    {
      user_id: userId,
      type: 'refill',
      title: 'Lisinopril refill due tomorrow',
      message: 'Your Lisinopril prescription needs to be refilled. Contact your pharmacy.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'appointment',
      title: 'Upcoming: Dr. Chen appointment',
      message: 'Remember to fast 8 hours before your endocrinology visit.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'lab',
      title: 'New lab results available',
      message: 'Your cholesterol panel results from Quest Diagnostics are ready to review.',
      is_read: false,
    },
  ]

  const { error: notifError } = await supabase.from('notifications').insert(notifications)
  console.log(notifError ? `❌ Notifications: ${notifError.message}` : `✅ Seeded ${notifications.length} notifications`)

  // Done!
  console.log('\n🎉 Seed complete!')
  console.log('\n📋 To test the app:')
  console.log('   1. Go to http://localhost:3000/login')
  console.log('   2. Enter name: "Aryan Motgi"')
  console.log('   3. This creates a NEW anonymous user (different from seeded one)')
  console.log('')
  console.log('   OR — to use the seeded user directly, use this email to sign in:')
  console.log(`   Email: ${authData.user.email}`)
  console.log(`   User ID: ${userId}`)
  console.log(`   Profile ID: ${profile.id}`)
}

seed().catch(console.error)
