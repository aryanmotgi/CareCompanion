import crypto from 'node:crypto';

/**
 * Per-user rollout gate for ENABLE_MEMORY_HYBRID.
 * - 'true'  → always on
 * - 'false' → always off
 * - '10pct' → deterministic 10% bucket by sha256(userId)
 * - anything else → safe default off
 */
export function hybridEnabledForUser(userId: string): boolean {
  const v = process.env.ENABLE_MEMORY_HYBRID;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '10pct') {
    const buf = crypto.createHash('sha256').update(userId).digest();
    return (buf.readUInt32BE(0) % 100) < 10;
  }
  return false;
}
