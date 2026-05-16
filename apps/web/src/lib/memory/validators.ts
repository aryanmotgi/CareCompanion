/**
 * Memory-v2 validators: poisoning defense + tier/importance/trust scoring.
 *
 * Fact text is NEVER mutated here — polarity/status columns carry the signal.
 * See docs/superpowers/plans/2026-05-15-memory-upgrade-v2.md Day 2 Step 9.
 */

const INSTRUCTION_PATTERNS: RegExp[] = [
  /\b(always|never)\s+(do|say|respond|answer|tell|reply|recommend|suggest|treat|consider)\b/i,
  /\b(from now on|going forward|ignore|disregard|override|forget|do not respond|stop responding)\b/i,
  /\b(act as|pretend to be|you are now|new instructions?:?)\b/i,
  /\bsystem (prompt|message|instructions?)\b/i,
  /\bwhen asked about [^,]+,?\s+(say|reply|respond|tell)\b/i,
  /\b(reveal|output|print|show me) (your|the) (system|instructions|prompt)\b/i,
  /^\s*(respond only in|reply only in|output only)\b/i,
];

/** Returns true if the fact looks like an AI behavioral directive (prompt injection). */
export function isInstructionShaped(fact: string): boolean {
  return INSTRUCTION_PATTERNS.some((p) => p.test(fact));
}

/** Default importance per category. Overridden by LLM extraction when provided. */
export function defaultImportance(category: string): number {
  const map: Record<string, number> = {
    allergy: 1.0,
    condition: 0.9,
    medication: 0.9,
    lab_result: 0.7,
    treatment_response: 0.7,
    appointment: 0.6,
    provider: 0.6,
    legal: 0.6,
    insurance: 0.5,
    family: 0.5,
    emotional_state: 0.4,
    financial: 0.4,
    preference: 0.3,
    lifestyle: 0.3,
    other: 0.3,
  };
  return map[category] ?? 0.5;
}

/** Trust score per provenance — drives retrieval scoring. */
export function trustForSource(source: string): number {
  if (source === 'fhir_sync') return 1.0;
  if (source === 'manual') return 0.9;
  if (source === 'conversation') return 0.5;
  return 0.3;
}

/**
 * Tier assignment.
 * Tier 1 = always-include safety floor. ONLY asserted + active safety facts.
 * Negated or historical/denied entries fall through to tier 3 — never bypass
 * to safety floor, which would invert the medical signal.
 */
export function tierForCategory(
  category: string,
  status: string,
  polarity: string,
): 1 | 2 | 3 {
  if (
    polarity === 'asserted' &&
    status === 'active' &&
    (category === 'allergy' || category === 'condition' || category === 'medication')
  ) {
    return 1;
  }
  if (category === 'lab_result' || category === 'appointment' || category === 'provider') {
    return 2;
  }
  return 3;
}
