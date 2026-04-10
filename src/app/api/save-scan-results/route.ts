import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
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
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return apiError('Too many requests', 429);
  }

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data, error: valError } = validateBody(ScanResultsSchema, body);
    if (valError) return valError;

    // Get care profile
    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id, conditions, allergies')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return apiError('No care profile found', 400);
    }

    const saved: Record<string, number> = {};

    // Save medications
    if (data.medications?.length) {
      const rows = data.medications.map((med) => ({
        care_profile_id: profile.id,
        name: med.name,
        dose: med.dose || null,
        frequency: med.frequency || null,
        prescribing_doctor: med.prescribing_doctor || null,
        refill_date: med.refill_date || null,
        notes: `Imported via photo scan`,
      }));
      const { error } = await supabase.from('medications').insert(rows);
      if (!error) saved.medications = rows.length;
    }

    // Save lab results
    if (data.lab_results?.length) {
      const rows = data.lab_results.map((lab) => ({
        user_id: user.id,
        test_name: lab.test_name,
        value: lab.value || null,
        unit: lab.unit || null,
        reference_range: lab.reference_range || null,
        is_abnormal: lab.is_abnormal || false,
        date_taken: data.date_taken || null,
        source: 'photo_scan',
      }));
      const { error } = await supabase.from('lab_results').insert(rows);
      if (!error) saved.lab_results = rows.length;
    }

    // Save insurance
    if (data.insurance) {
      const ins = data.insurance;
      const { error } = await supabase.from('insurance').upsert(
        {
          user_id: user.id,
          provider: ins.provider || 'Unknown',
          member_id: ins.member_id || null,
          group_number: ins.group_number || null,
          plan_year: new Date().getFullYear(),
        },
        { onConflict: 'id' }
      );
      if (!error) saved.insurance = 1;
    }

    // Save conditions (append to existing)
    if (data.conditions?.length) {
      const existing = profile.conditions || '';
      const newConditions = data.conditions.filter((c: string) => !existing.toLowerCase().includes(c.toLowerCase()));
      if (newConditions.length > 0) {
        const updated = existing
          ? `${existing}\n${newConditions.join('\n')}`
          : newConditions.join('\n');
        await supabase.from('care_profiles').update({ conditions: updated }).eq('id', profile.id);
        saved.conditions = newConditions.length;
      }
    }

    // Save appointments
    if (data.appointments?.length) {
      const rows = data.appointments.map((appt) => ({
        care_profile_id: profile.id,
        doctor_name: appt.doctor_name || null,
        date_time: appt.date_time || null,
        purpose: appt.purpose || null,
      }));
      const { error } = await supabase.from('appointments').insert(rows);
      if (!error) saved.appointments = rows.length;
    }

    // Save claims
    if (data.claims?.length) {
      const rows = data.claims.map((claim) => ({
        user_id: user.id,
        service_date: claim.service_date || null,
        provider_name: claim.provider_name || null,
        billed_amount: claim.billed_amount || null,
        paid_amount: claim.paid_amount || null,
        patient_responsibility: claim.patient_responsibility || null,
        status: claim.status || 'pending',
      }));
      const { error } = await supabase.from('claims').insert(rows);
      if (!error) saved.claims = rows.length;
    }

    return apiSuccess({ success: true, saved });
  } catch (err) {
    console.error('[save-scan-results] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
