/**
 * Server-side feature flag reads. Centralized so we can swap the source later
 * (env vars → LaunchDarkly/Statsig/etc.) without rippling through callers.
 *
 * Each flag has an explicit default in code; env can flip it. Default is the
 * "production safe" state — if the env var is unset, behave correctly.
 */

function envFlag(name: string, defaultValue: boolean): boolean {
  const v = process.env[name]
  if (v === undefined || v === '') return defaultValue
  return v === 'true' || v === '1'
}

/**
 * Caregiver code-join flow (migration 012, /care-group/code endpoints).
 * Default ON — the new flow is the canonical path. Flip to false to disable
 * for instant rollback if codes-redemption breaks; falls back to the
 * deprecated name+password and long-token invite flows.
 */
export function isCaregiverCodeFlowEnabled(): boolean {
  return envFlag('CAREGIVER_CODE_FLOW_ENABLED', true)
}

/**
 * App Store review account bypass. Returns true for the dedicated reviewer
 * email so onboarding skips the HealthKit requirement (synthetic vitals are
 * pre-seeded instead) and shows all premium features without a real device.
 */
export function isAppReviewAccount(email: string | null | undefined): boolean {
  return email === 'appreview@carecompanionai.org'
}
