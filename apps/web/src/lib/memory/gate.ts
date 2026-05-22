/**
 * Per-user rollout gate for ENABLE_MEMORY_HYBRID.
 * - 'true'  → always on
 * - 'false' → always off
 * - '10pct' → legacy canary value, also promotes to always-on (canary ended
 *             2026-05-20; kept here so the gate still returns true if the env
 *             var hasn't been flipped to 'true' yet on a given environment)
 * - anything else → safe default off
 */
export function hybridEnabledForUser(userId: string): boolean {
  // userId retained for signature parity with the legacy 10pct bucket impl
  // (sha256 modulo). Keeping the parameter avoids touching every call site.
  void userId;

  const v = process.env.ENABLE_MEMORY_HYBRID;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '10pct') return true;
  return false;
}
