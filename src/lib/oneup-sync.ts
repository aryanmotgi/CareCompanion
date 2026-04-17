import { db } from './db';
import {
  careProfiles,
  medications,
  labResults,
  appointments,
  doctors,
  claims,
  insurance,
  connectedApps,
} from './db/schema';
import { eq, and } from 'drizzle-orm';
import { fhirSearchAll } from './oneup';

import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
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
 * Sync all FHIR data from 1upHealth into our database tables.
 * This is the core engine that auto-populates the user's care profile.
 */
export class TokenExpiredError extends Error {
  constructor() {
    super('1upHealth access token is invalid or expired');
    this.name = 'TokenExpiredError';
  }
}

export async function syncOneUpData(userId: string, accessToken: string): Promise<SyncResults> {
  let saw401 = false;
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
  let [profile] = await db
    .select({
      id: careProfiles.id,
      patientName: careProfiles.patientName,
      patientAge: careProfiles.patientAge,
      conditions: careProfiles.conditions,
      allergies: careProfiles.allergies,
    })
    .from(careProfiles)
    .where(eq(careProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    const [newProfile] = await db
      .insert(careProfiles)
      .values({ userId })
      .returning({
        id: careProfiles.id,
        patientName: careProfiles.patientName,
        patientAge: careProfiles.patientAge,
        conditions: careProfiles.conditions,
        allergies: careProfiles.allergies,
      });
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

      if (name && !profile.patientName) {
        await db
          .update(careProfiles)
          .set({ patientName: name, patientAge: age })
          .where(eq(careProfiles.id, profile.id));
        results.patient_name = name;
        results.patient_age = age;
      }
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        careProfileId: profile.id,
        name,
        dose,
        frequency,
        prescribingDoctor: med.requester?.display || null,
        notes: 'Synced from health records',
      };
    });

    if (rows.length > 0) {
      await db
        .delete(medications)
        .where(and(eq(medications.careProfileId, profile.id), eq(medications.notes, 'Synced from health records')));
      await db.insert(medications).values(rows);
      results.medications = rows.length;
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        await db.update(careProfiles).set({ conditions: updated }).where(eq(careProfiles.id, profile.id));
        results.conditions = newOnes.length;
      }
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        await db.update(careProfiles).set({ allergies: updated }).where(eq(careProfiles.id, profile.id));
        results.allergies = newOnes.length;
      }
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        userId,
        testName: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test',
        value: obs.valueQuantity?.value?.toString() || obs.valueString || null,
        unit: obs.valueQuantity?.unit || null,
        referenceRange: rangeText || null,
        isAbnormal,
        dateTaken: obs.effectiveDateTime?.split('T')[0] || null,
        source: '1uphealth',
      };
    });

    if (rows.length > 0) {
      await db.delete(labResults).where(and(eq(labResults.userId, userId), eq(labResults.source, '1uphealth')));
      await db.insert(labResults).values(rows);
      results.lab_results = rows.length;
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        careProfileId: profile.id,
        doctorName: practitioner?.actor?.display || null,
        dateTime: appt.start ? new Date(appt.start) : null,
        purpose: appt.description || appt.serviceType?.[0]?.text || appt.serviceType?.[0]?.coding?.[0]?.display || null,
      };
    });

    if (rows.length > 0) {
      for (const row of rows) {
        if (row.dateTime) {
          const [existing] = await db
            .select({ id: appointments.id })
            .from(appointments)
            .where(and(eq(appointments.careProfileId, profile.id), eq(appointments.dateTime, row.dateTime)))
            .limit(1);
          if (!existing) {
            await db.insert(appointments).values(row);
            results.appointments++;
          }
        }
      }
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        careProfileId: profile.id,
        name,
        specialty,
        phone,
        notes: 'Synced from health records',
      };
    });

    if (rows.length > 0) {
      await db
        .delete(doctors)
        .where(and(eq(doctors.careProfileId, profile.id), eq(doctors.notes, 'Synced from health records')));
      await db.insert(doctors).values(rows);
      results.doctors = rows.length;
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

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
        userId,
        serviceDate: eob.billablePeriod?.start || null,
        providerName: eob.provider?.display || null,
        billedAmount: billed?.amount?.value?.toString() || null,
        paidAmount: paid?.amount?.value?.toString() || null,
        patientResponsibility: patientCost?.amount?.value?.toString() || null,
        status: eob.outcome === 'complete' ? 'paid' : eob.outcome === 'error' ? 'denied' : 'pending',
      };
    });

    if (rows.length > 0) {
      await db.delete(claims).where(eq(claims.userId, userId));
      await db.insert(claims).values(rows);
      results.claims = rows.length;
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

  // === COVERAGE (Insurance) ===
  try {
    const coverages = await fhirSearchAll('Coverage', 'status=active', accessToken);
    const coverageRows = coverages.map((c) => {
      const coverage = c as {
        payor?: Array<{ display?: string }>;
        subscriberId?: string;
        class?: Array<{ type?: { coding?: Array<{ code?: string }> }; value?: string }>;
      };

      const groupClass = coverage.class?.find((cl) => cl.type?.coding?.[0]?.code === 'group');
      return {
        userId,
        provider: coverage.payor?.[0]?.display || 'Unknown insurer',
        memberId: coverage.subscriberId || null,
        groupNumber: groupClass?.value || null,
        planYear: new Date().getFullYear(),
      };
    });

    if (coverageRows.length > 0) {
      await db.delete(insurance).where(eq(insurance.userId, userId));
      await db.insert(insurance).values(coverageRows);
      results.insurance = coverageRows.length;
    }
  } catch (e) { if (e instanceof Error && e.message.includes("FHIR fetch failed: 401")) saw401 = true; console.error(e); }

  if (saw401) throw new TokenExpiredError();

  // Update last_synced
  await db
    .update(connectedApps)
    .set({ lastSynced: new Date() })
    .where(and(eq(connectedApps.userId, userId), eq(connectedApps.source, '1uphealth')));

  // === AUTO-POPULATE PROFILE FROM SYNCED DATA ===
  try {
    const [updatedProfile] = await db
      .select({
        id: careProfiles.id,
        conditions: careProfiles.conditions,
        allergies: careProfiles.allergies,
        cancerType: careProfiles.cancerType,
        cancerStage: careProfiles.cancerStage,
        treatmentPhase: careProfiles.treatmentPhase,
        patientName: careProfiles.patientName,
        patientAge: careProfiles.patientAge,
      })
      .from(careProfiles)
      .where(eq(careProfiles.userId, userId))
      .limit(1);

    if (updatedProfile) {
      const meds = await db
        .select({ name: medications.name, dose: medications.dose, frequency: medications.frequency })
        .from(medications)
        .where(eq(medications.careProfileId, updatedProfile.id));

      const hasConditions = !!updatedProfile.conditions;
      const hasMeds = meds.length > 0;
      const missingFields = !updatedProfile.cancerType || !updatedProfile.cancerStage || !updatedProfile.treatmentPhase;

      if ((hasConditions || hasMeds) && missingFields) {
        const { output: detected } = await generateText({
          model: anthropic('claude-haiku-4.5'),
          output: Output.object({
            schema: z.object({
              cancer_type: z.string().nullable().describe('The specific cancer type if detectable, e.g. "Breast Cancer", "Lung Cancer", "Colon Cancer". null if not a cancer patient or unclear.'),
              cancer_stage: z.string().nullable().describe('Cancer stage if detectable, e.g. "Stage II", "Stage IIIA", "Stage IV". null if unclear.'),
              treatment_phase: z.string().nullable().describe('Current treatment phase, e.g. "active_treatment", "post_surgery", "chemotherapy", "radiation", "maintenance", "remission", "palliative". null if unclear.'),
            }),
          }),
          prompt: `Analyze this patient's medical data and detect their cancer type, stage, and treatment phase.

CONDITIONS: ${updatedProfile.conditions || 'None listed'}
MEDICATIONS: ${meds.map((m) => `${m.name} ${m.dose || ''} ${m.frequency || ''}`).join(', ') || 'None'}
ALLERGIES: ${updatedProfile.allergies || 'None'}

Rules:
- Only set cancer_type if there's clear evidence of a cancer diagnosis in the conditions
- Only set cancer_stage if the stage is explicitly mentioned or strongly implied
- Detect treatment_phase from medications (e.g. chemo drugs = "active_treatment", tamoxifen = "maintenance")
- Return null for any field you're not confident about
- Be specific: "HER2+ Breast Cancer" is better than "Breast Cancer"`,
        });

        const updates: Partial<typeof careProfiles.$inferInsert> = {};
        if (detected.cancer_type && !updatedProfile.cancerType) updates.cancerType = detected.cancer_type;
        if (detected.cancer_stage && !updatedProfile.cancerStage) updates.cancerStage = detected.cancer_stage;
        if (detected.treatment_phase && !updatedProfile.treatmentPhase) updates.treatmentPhase = detected.treatment_phase;

        if (Object.keys(updates).length > 0) {
          await db.update(careProfiles).set(updates).where(eq(careProfiles.id, updatedProfile.id));
          console.log('[sync] Auto-populated profile:', updates);
        }
      }
    }
  } catch (e) {
    console.error('[sync] Profile auto-populate error:', e);
  }

  return results;
}
