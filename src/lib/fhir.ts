// FHIR R4 resource parsing utilities for 1upHealth integration

export interface FhirBundle {
  resourceType: 'Bundle';
  entry?: Array<{ resource: Record<string, unknown> }>;
}

export function parseMedications(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'MedicationRequest')
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const med = r.medicationCodeableConcept as { text?: string; coding?: Array<{ display?: string }> } | undefined;
      const dosage = (r.dosageInstruction as Array<Record<string, unknown>> | undefined)?.[0];
      const timing = dosage?.timing as { code?: { text?: string } } | undefined;

      return {
        name: med?.text || med?.coding?.[0]?.display || 'Unknown',
        dose: dosage?.doseAndRate
          ? `${(dosage.doseAndRate as Array<{ doseQuantity?: { value?: number; unit?: string } }>)?.[0]?.doseQuantity?.value || ''} ${(dosage.doseAndRate as Array<{ doseQuantity?: { value?: number; unit?: string } }>)?.[0]?.doseQuantity?.unit || ''}`.trim()
          : null,
        frequency: timing?.code?.text || null,
      };
    });
}

export function parseConditions(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'Condition')
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const code = r.code as { text?: string; coding?: Array<{ display?: string }> } | undefined;
      return code?.text || code?.coding?.[0]?.display || 'Unknown condition';
    });
}

export function parseAllergies(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'AllergyIntolerance')
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const code = r.code as { text?: string; coding?: Array<{ display?: string }> } | undefined;
      return code?.text || code?.coding?.[0]?.display || 'Unknown allergy';
    });
}

export function parseAppointments(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'Appointment')
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const participants = r.participant as Array<{ actor?: { display?: string } }> | undefined;
      const doctor = participants?.find((p) => p.actor?.display)?.actor?.display || null;
      return {
        doctor_name: doctor,
        date_time: (r.start as string) || null,
        purpose: (r.description as string) || (r.serviceType as Array<{ text?: string }>)?.[0]?.text || null,
      };
    });
}

export function parseLabResults(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'Observation')
    .filter((e) => {
      const cats = (e.resource.category as Array<{ coding?: Array<{ code?: string }> }>) || [];
      return cats.some((c) => c.coding?.some((cd) => cd.code === 'laboratory'));
    })
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const code = r.code as { text?: string; coding?: Array<{ display?: string }> } | undefined;
      const valueQuantity = r.valueQuantity as { value?: number; unit?: string } | undefined;
      const refRange = (r.referenceRange as Array<{ text?: string; low?: { value?: number }; high?: { value?: number } }>)?.[0];
      const interp = (r.interpretation as Array<{ coding?: Array<{ code?: string }> }>)?.[0]?.coding?.[0]?.code;

      return {
        test_name: code?.text || code?.coding?.[0]?.display || 'Unknown test',
        value: valueQuantity?.value?.toString() || (r.valueString as string) || null,
        unit: valueQuantity?.unit || null,
        reference_range: refRange?.text || (refRange?.low && refRange?.high ? `${refRange.low.value}-${refRange.high.value}` : null),
        is_abnormal: interp === 'H' || interp === 'L' || interp === 'A',
        date_taken: (r.effectiveDateTime as string)?.split('T')[0] || null,
      };
    });
}

export function parseClaims(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'ExplanationOfBenefit')
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const total = (r.total as Array<{ category?: { coding?: Array<{ code?: string }> }; amount?: { value?: number } }>) || [];
      const billed = total.find((t) => t.category?.coding?.[0]?.code === 'submitted')?.amount?.value || null;
      const paid = total.find((t) => t.category?.coding?.[0]?.code === 'benefit')?.amount?.value || null;
      const patient = total.find((t) => t.category?.coding?.[0]?.code === 'deductible')?.amount?.value || null;
      const outcome = r.outcome as string | undefined;

      return {
        service_date: (r.billablePeriod as { start?: string })?.start?.split('T')[0] || null,
        provider_name: (r.provider as { display?: string })?.display || null,
        billed_amount: billed,
        paid_amount: paid,
        patient_responsibility: patient,
        status: outcome === 'complete' ? 'paid' : outcome === 'error' ? 'denied' : 'pending',
        denial_reason: outcome === 'error' ? 'Claim denied by insurer' : null,
      };
    });
}

export function parseCoverage(bundle: FhirBundle) {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter((e) => e.resource.resourceType === 'Coverage')
    .map((e) => {
      const r = e.resource as Record<string, unknown>;
      const payor = (r.payor as Array<{ display?: string }>)?.[0]?.display || 'Unknown';
      const clazz = (r.class as Array<{ type?: { coding?: Array<{ code?: string }> }; value?: string }>) || [];
      const groupNum = clazz.find((c) => c.type?.coding?.[0]?.code === 'group')?.value || null;
      const memberId = (r.subscriberId as string) || null;

      return {
        provider: payor,
        member_id: memberId,
        group_number: groupNum,
      };
    });
}
