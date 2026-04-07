import { fhirSearchAll } from './oneup';
import { createAdminClient } from './supabase/admin';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

interface SyncResults {
  patient_name?: string;
  patient_age?: number | null;
  medications: number;
  conditions: number;
  allergies: number;
  lab_results: number;
  appointments: number;
  doctors: number;
  claims: number;
  insurance: number;
}

/**
 * Sync all FHIR data from 1upHealth into our Supabase tables.
 * This is the core engine that auto-populates the user's care profile.
 */
export async function syncOneUpData(userId: string, accessToken: string): Promise<SyncResults> {
  const admin = createAdminClient();
  const results: SyncResults = {
    medications: 0,
    conditions: 0,
    allergies: 0,
    lab_results: 0,
    appointments: 0,
    doctors: 0,
    claims: 0,
    insurance: 0,
  };

  // Ensure care profile exists
  let { data: profile } = await admin
    .from('care_profiles')
    .select('id, patient_name, patient_age, conditions, allergies')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    const { data: newProfile } = await admin
      .from('care_profiles')
      .insert({ user_id: userId })
      .select('id, patient_name, patient_age, conditions, allergies')
      .single();
    profile = newProfile;
  }

  if (!profile) throw new Error('Could not create care profile');

  // === PATIENT DEMOGRAPHICS ===
  try {
    const patients = await fhirSearchAll('Patient', '', accessToken);
    if (patients.length > 0) {
      const patient = patients[0] as {
        name?: Array<{ given?: string[]; family?: string; text?: string }>;
        birthDate?: string;
        gender?: string;
      };

      const name = patient.name?.[0]?.text
        || [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ')
        || null;

      let age: number | null = null;
      if (patient.birthDate) {
        const birth = new Date(patient.birthDate);
        age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }

      // Only update if we got actual data and profile doesn't already have a name
      if (name && !profile.patient_name) {
        await admin.from('care_profiles').update({
          patient_name: name,
          patient_age: age,
        }).eq('id', profile.id);
        results.patient_name = name;
        results.patient_age = age;
      }
    }
  } catch (e) { console.error('Sync patient demographics error:', e); }

  // === MEDICATIONS (MedicationRequest) ===
  try {
    const meds = await fhirSearchAll('MedicationRequest', 'status=active', accessToken);
    const rows = meds.map((m) => {
      const med = m as {
        medicationCodeableConcept?: { text?: string; coding?: Array<{ display?: string }> };
        dosageInstruction?: Array<{
          text?: string;
          timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
          doseAndRate?: Array<{ doseQuantity?: { value?: number; unit?: string } }>;
        }>;
        requester?: { display?: string };
      };

      const name = med.medicationCodeableConcept?.text
        || med.medicationCodeableConcept?.coding?.[0]?.display
        || 'Unknown medication';

      const dosage = med.dosageInstruction?.[0];
      const doseQty = dosage?.doseAndRate?.[0]?.doseQuantity;
      const dose = doseQty ? `${doseQty.value} ${doseQty.unit || ''}`.trim() : (dosage?.text || null);

      const timing = dosage?.timing?.repeat;
      const frequency = timing
        ? `${timing.frequency || 1}x per ${timing.period || 1} ${timing.periodUnit || 'd'}`
        : null;

      return {
        care_profile_id: profile.id,
        name,
        dose,
        frequency,
        prescribing_doctor: med.requester?.display || null,
        notes: 'Synced from health records',
      };
    });

    if (rows.length > 0) {
      // Remove previously synced meds, insert fresh
      await admin.from('medications').delete()
        .eq('care_profile_id', profile.id)
        .eq('notes', 'Synced from health records');
      await admin.from('medications').insert(rows);
      results.medications = rows.length;
    }
  } catch (e) { console.error('Sync medications error:', e); }

  // === CONDITIONS ===
  try {
    const conditions = await fhirSearchAll('Condition', 'clinical-status=active', accessToken);
    const names = conditions
      .map((c) => {
        const cond = c as { code?: { text?: string; coding?: Array<{ display?: string }> } };
        return cond.code?.text || cond.code?.coding?.[0]?.display || null;
      })
      .filter(Boolean) as string[];

    if (names.length > 0) {
      const existing = profile.conditions || '';
      const newOnes = names.filter((n) => !existing.toLowerCase().includes(n.toLowerCase()));
      if (newOnes.length > 0) {
        const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
        await admin.from('care_profiles').update({ conditions: updated }).eq('id', profile.id);
        results.conditions = newOnes.length;
      }
    }
  } catch (e) { console.error('Sync conditions error:', e); }

  // === ALLERGIES ===
  try {
    const allergies = await fhirSearchAll('AllergyIntolerance', '', accessToken);
    const names = allergies
      .map((a) => {
        const allergy = a as { code?: { text?: string; coding?: Array<{ display?: string }> } };
        return allergy.code?.text || allergy.code?.coding?.[0]?.display || null;
      })
      .filter(Boolean) as string[];

    if (names.length > 0) {
      const existing = profile.allergies || '';
      const newOnes = names.filter((n) => !existing.toLowerCase().includes(n.toLowerCase()));
      if (newOnes.length > 0) {
        const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
        await admin.from('care_profiles').update({ allergies: updated }).eq('id', profile.id);
        results.allergies = newOnes.length;
      }
    }
  } catch (e) { console.error('Sync allergies error:', e); }

  // === LAB RESULTS (Observation) ===
  try {
    const labs = await fhirSearchAll('Observation', 'category=laboratory&_sort=-date&_count=50', accessToken);
    const rows = labs.map((o) => {
      const obs = o as {
        code?: { text?: string; coding?: Array<{ display?: string }> };
        valueQuantity?: { value?: number; unit?: string };
        valueString?: string;
        referenceRange?: Array<{ text?: string; low?: { value?: number; unit?: string }; high?: { value?: number; unit?: string } }>;
        interpretation?: Array<{ coding?: Array<{ code?: string }> }>;
        effectiveDateTime?: string;
      };

      const interpCode = obs.interpretation?.[0]?.coding?.[0]?.code;
      const isAbnormal = ['A', 'AA', 'H', 'HH', 'L', 'LL'].includes(interpCode || '');

      const refRange = obs.referenceRange?.[0];
      const rangeText = refRange?.text
        || (refRange?.low && refRange?.high ? `${refRange.low.value}-${refRange.high.value} ${refRange.high.unit || ''}` : null);

      return {
        user_id: userId,
        test_name: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test',
        value: obs.valueQuantity?.value?.toString() || obs.valueString || null,
        unit: obs.valueQuantity?.unit || null,
        reference_range: rangeText || null,
        is_abnormal: isAbnormal,
        date_taken: obs.effectiveDateTime || null,
        source: '1uphealth',
      };
    });

    if (rows.length > 0) {
      await admin.from('lab_results').delete().eq('user_id', userId).eq('source', '1uphealth');
      await admin.from('lab_results').insert(rows);
      results.lab_results = rows.length;
    }
  } catch (e) { console.error('Sync lab results error:', e); }

  // === APPOINTMENTS ===
  try {
    const today = new Date().toISOString().split('T')[0];
    const appts = await fhirSearchAll('Appointment', `date=ge${today}&status=booked,pending`, accessToken);
    const rows = appts.map((a) => {
      const appt = a as {
        participant?: Array<{ actor?: { display?: string; reference?: string } }>;
        start?: string;
        description?: string;
        serviceType?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
      };

      const practitioner = appt.participant?.find((p) =>
        p.actor?.reference?.includes('Practitioner') || (!p.actor?.reference?.includes('Patient'))
      );

      return {
        care_profile_id: profile.id,
        doctor_name: practitioner?.actor?.display || null,
        date_time: appt.start || null,
        purpose: appt.description || appt.serviceType?.[0]?.text || appt.serviceType?.[0]?.coding?.[0]?.display || null,
      };
    });

    if (rows.length > 0) {
      for (const row of rows) {
        if (row.date_time) {
          const { data: existing } = await admin.from('appointments')
            .select('id')
            .eq('care_profile_id', profile.id)
            .eq('date_time', row.date_time)
            .maybeSingle();
          if (!existing) {
            await admin.from('appointments').insert(row);
            results.appointments++;
          }
        }
      }
    }
  } catch (e) { console.error('Sync appointments error:', e); }

  // === PRACTITIONERS (Doctors) ===
  try {
    const practitioners = await fhirSearchAll('Practitioner', '_count=50', accessToken);
    const rows = practitioners.map((p) => {
      const pract = p as {
        name?: Array<{ text?: string; given?: string[]; family?: string }>;
        qualification?: Array<{ code?: { text?: string; coding?: Array<{ display?: string }> } }>;
        telecom?: Array<{ system?: string; value?: string }>;
      };

      const name = pract.name?.[0]?.text
        || [pract.name?.[0]?.given?.[0], pract.name?.[0]?.family].filter(Boolean).join(' ')
        || 'Unknown';

      const phone = pract.telecom?.find((t) => t.system === 'phone')?.value || null;
      const specialty = pract.qualification?.[0]?.code?.text
        || pract.qualification?.[0]?.code?.coding?.[0]?.display
        || null;

      return {
        care_profile_id: profile.id,
        name,
        specialty,
        phone,
        notes: 'Synced from health records',
      };
    });

    if (rows.length > 0) {
      await admin.from('doctors').delete()
        .eq('care_profile_id', profile.id)
        .eq('notes', 'Synced from health records');
      await admin.from('doctors').insert(rows);
      results.doctors = rows.length;
    }
  } catch (e) { console.error('Sync practitioners error:', e); }

  // === CLAIMS / EOBs ===
  try {
    const eobs = await fhirSearchAll('ExplanationOfBenefit', '_sort=-created&_count=20', accessToken);
    const rows = eobs.map((e) => {
      const eob = e as {
        billablePeriod?: { start?: string };
        provider?: { display?: string };
        total?: Array<{
          category?: { coding?: Array<{ code?: string }> };
          amount?: { value?: number };
        }>;
        outcome?: string;
      };

      const billed = eob.total?.find((t) => t.category?.coding?.[0]?.code === 'submitted');
      const paid = eob.total?.find((t) => t.category?.coding?.[0]?.code === 'benefit');
      const patientCost = eob.total?.find((t) => t.category?.coding?.[0]?.code === 'deductible');

      return {
        user_id: userId,
        service_date: eob.billablePeriod?.start || null,
        provider_name: eob.provider?.display || null,
        billed_amount: billed?.amount?.value || null,
        paid_amount: paid?.amount?.value || null,
        patient_responsibility: patientCost?.amount?.value || null,
        status: eob.outcome === 'complete' ? 'paid' as const : eob.outcome === 'error' ? 'denied' as const : 'pending' as const,
      };
    });

    if (rows.length > 0) {
      await admin.from('claims').delete().eq('user_id', userId);
      await admin.from('claims').insert(rows);
      results.claims = rows.length;
    }
  } catch (e) { console.error('Sync claims error:', e); }

  // === COVERAGE (Insurance) ===
  try {
    const coverages = await fhirSearchAll('Coverage', 'status=active', accessToken);
    for (const c of coverages) {
      const coverage = c as {
        payor?: Array<{ display?: string }>;
        subscriberId?: string;
        class?: Array<{ type?: { coding?: Array<{ code?: string }> }; value?: string }>;
      };

      const provider = coverage.payor?.[0]?.display || 'Unknown insurer';
      const memberId = coverage.subscriberId || null;
      const groupClass = coverage.class?.find((cl) => cl.type?.coding?.[0]?.code === 'group');
      const groupNumber = groupClass?.value || null;

      await admin.from('insurance').upsert({
        user_id: userId,
        provider,
        member_id: memberId,
        group_number: groupNumber,
        plan_year: new Date().getFullYear(),
      }, { onConflict: 'id' });
      results.insurance++;
    }
  } catch (e) { console.error('Sync coverage error:', e); }

  // Update last_synced
  await admin.from('connected_apps')
    .update({ last_synced: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('source', '1uphealth');

  // === AUTO-POPULATE PROFILE FROM SYNCED DATA ===
  // Use AI to detect cancer type, stage, and treatment phase from conditions + medications
  try {
    // Re-fetch the profile to get updated conditions
    const { data: updatedProfile } = await admin
      .from('care_profiles')
      .select('id, conditions, allergies, cancer_type, cancer_stage, treatment_phase, patient_name, patient_age')
      .eq('user_id', userId)
      .single();

    if (updatedProfile) {
      // Get medications for treatment phase detection
      const { data: meds } = await admin
        .from('medications')
        .select('name, dose, frequency')
        .eq('care_profile_id', updatedProfile.id);

      const hasConditions = !!updatedProfile.conditions;
      const hasMeds = (meds || []).length > 0;
      const missingFields = !updatedProfile.cancer_type || !updatedProfile.cancer_stage || !updatedProfile.treatment_phase;

      // Only run AI detection if we have data to analyze AND fields are missing
      if ((hasConditions || hasMeds) && missingFields) {
        const { object: detected } = await generateObject({
          model: anthropic('claude-haiku-4-5-20251001'),
          schema: z.object({
            cancer_type: z.string().nullable().describe('The specific cancer type if detectable, e.g. "Breast Cancer", "Lung Cancer", "Colon Cancer". null if not a cancer patient or unclear.'),
            cancer_stage: z.string().nullable().describe('Cancer stage if detectable, e.g. "Stage II", "Stage IIIA", "Stage IV". null if unclear.'),
            treatment_phase: z.string().nullable().describe('Current treatment phase, e.g. "active_treatment", "post_surgery", "chemotherapy", "radiation", "maintenance", "remission", "palliative". null if unclear.'),
          }),
          prompt: `Analyze this patient's medical data and detect their cancer type, stage, and treatment phase.

CONDITIONS: ${updatedProfile.conditions || 'None listed'}
MEDICATIONS: ${(meds || []).map((m) => `${m.name} ${m.dose || ''} ${m.frequency || ''}`).join(', ') || 'None'}
ALLERGIES: ${updatedProfile.allergies || 'None'}

Rules:
- Only set cancer_type if there's clear evidence of a cancer diagnosis in the conditions
- Only set cancer_stage if the stage is explicitly mentioned or strongly implied
- Detect treatment_phase from medications (e.g. chemo drugs = "active_treatment", tamoxifen = "maintenance")
- Return null for any field you're not confident about
- Be specific: "HER2+ Breast Cancer" is better than "Breast Cancer"`,
        });

        const updates: Record<string, string> = {};
        if (detected.cancer_type && !updatedProfile.cancer_type) updates.cancer_type = detected.cancer_type;
        if (detected.cancer_stage && !updatedProfile.cancer_stage) updates.cancer_stage = detected.cancer_stage;
        if (detected.treatment_phase && !updatedProfile.treatment_phase) updates.treatment_phase = detected.treatment_phase;

        if (Object.keys(updates).length > 0) {
          await admin.from('care_profiles').update(updates).eq('id', updatedProfile.id);
          console.log('[sync] Auto-populated profile:', updates);
        }
      }
    }
  } catch (e) {
    // Non-critical — profile auto-population is a convenience, not a requirement
    console.error('[sync] Profile auto-populate error:', e);
  }

  return results;
}
