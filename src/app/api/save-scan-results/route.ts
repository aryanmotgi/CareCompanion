import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { careProfiles, medications, labResults, insurance, appointments, claims } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const MedicationSchema = z.object({
  name: z.string().min(1),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  prescribing_doctor: z.string().optional(),
  refill_date: z.string().optional(),
});

const LabResultSchema = z.object({
  test_name: z.string().min(1),
  value: z.string().optional(),
  unit: z.string().optional(),
  reference_range: z.string().optional(),
  is_abnormal: z.boolean().optional(),
});

const InsuranceSchema = z.object({
  provider: z.string().optional(),
  member_id: z.string().optional(),
  group_number: z.string().optional(),
});

const AppointmentSchema = z.object({
  doctor_name: z.string().optional(),
  date_time: z.string().optional(),
  purpose: z.string().optional(),
});

const ClaimSchema = z.object({
  service_date: z.string().optional(),
  provider_name: z.string().optional(),
  billed_amount: z.number().optional(),
  paid_amount: z.number().optional(),
  patient_responsibility: z.number().optional(),
  status: z.string().optional(),
});

const ScanResultsSchema = z.object({
  medications: z.array(MedicationSchema).optional(),
  lab_results: z.array(LabResultSchema).optional(),
  insurance: InsuranceSchema.optional(),
  conditions: z.array(z.string()).optional(),
  appointments: z.array(AppointmentSchema).optional(),
  claims: z.array(ClaimSchema).optional(),
  date_taken: z.string().optional(),
}).refine(
  data => data.medications || data.lab_results || data.insurance || data.conditions || data.appointments || data.claims,
  { message: 'At least one data category must be provided' }
);

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return apiError('Too many requests', 429);
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data, error: valError } = validateBody(ScanResultsSchema, body);
    if (valError) return valError;

    // Get care profile
    const [profile] = await db
      .select({ id: careProfiles.id, conditions: careProfiles.conditions })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    if (!profile) {
      return apiError('No care profile found', 400);
    }

    const saved: Record<string, number> = {};

    // Save medications
    if (data.medications?.length) {
      const rows = data.medications.map((med) => ({
        careProfileId: profile.id,
        name: med.name,
        dose: med.dose ?? null,
        frequency: med.frequency ?? null,
        prescribingDoctor: med.prescribing_doctor ?? null,
        refillDate: med.refill_date ?? null,
        notes: 'Imported via photo scan',
      }));
      await db.insert(medications).values(rows);
      saved.medications = rows.length;
    }

    // Save lab results
    if (data.lab_results?.length) {
      const rows = data.lab_results.map((lab) => ({
        userId: user!.id,
        testName: lab.test_name,
        value: lab.value ?? null,
        unit: lab.unit ?? null,
        referenceRange: lab.reference_range ?? null,
        isAbnormal: lab.is_abnormal ?? false,
        dateTaken: data.date_taken ?? null,
        source: 'photo_scan',
      }));
      await db.insert(labResults).values(rows);
      saved.lab_results = rows.length;
    }

    // Save insurance
    if (data.insurance) {
      const ins = data.insurance;
      await db.insert(insurance).values({
        userId: user!.id,
        provider: ins.provider ?? 'Unknown',
        memberId: ins.member_id ?? null,
        groupNumber: ins.group_number ?? null,
        planYear: new Date().getFullYear(),
      });
      saved.insurance = 1;
    }

    // Save conditions (append to existing)
    if (data.conditions?.length) {
      const existing = profile.conditions || '';
      const newConditions = data.conditions.filter((c: string) => !existing.toLowerCase().includes(c.toLowerCase()));
      if (newConditions.length > 0) {
        const updated = existing
          ? `${existing}\n${newConditions.join('\n')}`
          : newConditions.join('\n');
        await db.update(careProfiles).set({ conditions: updated }).where(eq(careProfiles.id, profile.id));
        saved.conditions = newConditions.length;
      }
    }

    // Save appointments
    if (data.appointments?.length) {
      const rows = data.appointments.map((appt) => ({
        careProfileId: profile.id,
        doctorName: appt.doctor_name ?? null,
        dateTime: appt.date_time ? new Date(appt.date_time) : null,
        purpose: appt.purpose ?? null,
      }));
      await db.insert(appointments).values(rows);
      saved.appointments = rows.length;
    }

    // Save claims
    if (data.claims?.length) {
      const rows = data.claims.map((claim) => ({
        userId: user!.id,
        serviceDate: claim.service_date ?? null,
        providerName: claim.provider_name ?? null,
        billedAmount: claim.billed_amount?.toString() ?? null,
        paidAmount: claim.paid_amount?.toString() ?? null,
        patientResponsibility: claim.patient_responsibility?.toString() ?? null,
        status: claim.status ?? 'pending',
      }));
      await db.insert(claims).values(rows);
      saved.claims = rows.length;
    }

    return apiSuccess({ success: true, saved });
  } catch (err) {
    console.error('[save-scan-results] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
