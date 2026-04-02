import type { CareProfile, Medication, Doctor, Appointment, LabResult, Claim, Notification, PriorAuth, FsaHsa } from './types';

const BASE_PROMPT = `You are CareCompanion, a warm and caring AI assistant for family caregivers and people managing health complexity.

Your job:
- Remember everything about the person being cared for
- Always respond specifically to their situation — never give generic answers
- Extract key facts from every message — medications, appointments, conditions, allergies, doctor names — and confirm back what you captured
- Ask exactly one follow-up question per message to make sure you have the full picture
- Check in on the caregiver too, not just the patient — they matter just as much

Tone: Warm, calm, and caring. Like a knowledgeable friend. Never clinical. Never cold. Never generic.

When a user first messages you with no prior history, start with: How are you doing today, and who are you caring for?`;

export function buildSystemPrompt(
  profile: CareProfile | null,
  medications: Medication[] | null,
  doctors: Doctor[] | null,
  appointments: Appointment[] | null,
  extras?: {
    labResults?: LabResult[] | null;
    notifications?: Notification[] | null;
    claims?: Claim[] | null;
    priorAuths?: PriorAuth[] | null;
    fsaHsa?: FsaHsa[] | null;
  }
): string {
  if (!profile) {
    return BASE_PROMPT;
  }

  let context = `\n\n=== CARE PROFILE ===\n`;
  context += `Patient: ${profile.patient_name || 'Not provided'}`;
  if (profile.patient_age) context += `, Age: ${profile.patient_age}`;
  context += `\n`;
  if (profile.relationship) context += `Relationship: ${profile.relationship}\n`;
  if (profile.conditions) context += `Conditions: ${profile.conditions}\n`;
  if (profile.allergies) context += `Allergies: ${profile.allergies}\n`;

  if (medications && medications.length > 0) {
    context += `\n=== MEDICATIONS ===\n`;
    medications.forEach((med) => {
      context += `- ${med.name}`;
      if (med.dose) context += `, ${med.dose}`;
      if (med.frequency) context += `, ${med.frequency}`;
      if (med.prescribing_doctor) context += ` (prescribed by ${med.prescribing_doctor})`;
      if (med.refill_date) context += ` [refill: ${med.refill_date}]`;
      context += `\n`;
    });
  } else {
    context += `\n=== MEDICATIONS ===\nNo medications recorded yet.\n`;
  }

  if (doctors && doctors.length > 0) {
    context += `\n=== DOCTORS ===\n`;
    doctors.forEach((doc) => {
      context += `- ${doc.name}`;
      if (doc.specialty) context += ` (${doc.specialty})`;
      if (doc.phone) context += `, ${doc.phone}`;
      context += `\n`;
    });
  } else {
    context += `\n=== DOCTORS ===\nNo doctors recorded yet.\n`;
  }

  if (appointments && appointments.length > 0) {
    context += `\n=== UPCOMING APPOINTMENTS ===\n`;
    appointments.forEach((appt) => {
      context += `- `;
      if (appt.doctor_name) context += `${appt.doctor_name}`;
      if (appt.date_time) context += ` on ${new Date(appt.date_time).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
      if (appt.purpose) context += ` — ${appt.purpose}`;
      context += `\n`;
    });
  } else {
    context += `\n=== UPCOMING APPOINTMENTS ===\nNo appointments scheduled.\n`;
  }

  // Synced data context
  if (extras) {
    const { labResults, notifications, claims, priorAuths, fsaHsa } = extras;

    if (labResults && labResults.length > 0) {
      context += `\n=== RECENT LAB RESULTS ===\n`;
      const abnormal = labResults.filter((l) => l.is_abnormal);
      if (abnormal.length > 0) {
        context += `⚠️ ${abnormal.length} ABNORMAL result(s):\n`;
      }
      labResults.forEach((lab) => {
        context += `- ${lab.test_name}: ${lab.value} ${lab.unit || ''}`;
        if (lab.reference_range) context += ` (range: ${lab.reference_range})`;
        if (lab.is_abnormal) context += ` ⚠️ ABNORMAL`;
        if (lab.date_taken) context += ` [${lab.date_taken}]`;
        context += `\n`;
      });
    }

    if (notifications && notifications.length > 0) {
      context += `\n=== UNREAD ALERTS ===\n`;
      context += `Proactively mention these to the user:\n`;
      notifications.forEach((n) => {
        context += `- [${n.type}] ${n.title}`;
        if (n.message) context += `: ${n.message}`;
        context += `\n`;
      });
    }

    if (claims && claims.length > 0) {
      const denied = claims.filter((c) => c.status === 'denied');
      if (denied.length > 0) {
        context += `\n=== DENIED CLAIMS ===\n`;
        context += `Explain these denials in plain English and offer to help appeal:\n`;
        denied.forEach((c) => {
          context += `- ${c.provider_name || 'Unknown'}: ${c.denial_reason || 'Reason not provided'}`;
          if (c.billed_amount) context += ` ($${c.billed_amount})`;
          context += `\n`;
        });
      }
    }

    if (priorAuths && priorAuths.length > 0) {
      const expiring = priorAuths.filter((a) => a.expiry_date && new Date(a.expiry_date) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
      if (expiring.length > 0) {
        context += `\n=== EXPIRING PRIOR AUTHORIZATIONS ===\n`;
        expiring.forEach((a) => {
          context += `- ${a.service}: expires ${a.expiry_date}`;
          if (a.sessions_approved) context += ` (${a.sessions_used}/${a.sessions_approved} sessions used)`;
          context += `\n`;
        });
      }
    }

    if (fsaHsa && fsaHsa.length > 0) {
      const lowBalance = fsaHsa.filter((a) => a.contribution_limit && a.balance < a.contribution_limit * 0.1);
      if (lowBalance.length > 0) {
        context += `\n=== LOW FSA/HSA BALANCE ===\n`;
        lowBalance.forEach((a) => {
          context += `- ${a.provider} (${a.account_type.toUpperCase()}): $${a.balance} remaining\n`;
        });
      }
    }
  }

  return BASE_PROMPT + context;
}
