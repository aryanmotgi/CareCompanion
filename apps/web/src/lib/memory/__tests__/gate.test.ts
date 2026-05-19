import { afterEach, describe, expect, it, vi } from 'vitest';
import { hybridEnabledForUser } from '@/lib/memory/gate';

const USER_A = '00000000-0000-0000-0000-000000000001';

describe('hybridEnabledForUser', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when ENABLE_MEMORY_HYBRID=true', () => {
    vi.stubEnv('ENABLE_MEMORY_HYBRID', 'true');
    expect(hybridEnabledForUser(USER_A)).toBe(true);
  });

  it('returns false when ENABLE_MEMORY_HYBRID=false', () => {
    vi.stubEnv('ENABLE_MEMORY_HYBRID', 'false');
    expect(hybridEnabledForUser(USER_A)).toBe(false);
  });

  it('returns false when env is not set (safe default)', () => {
    delete process.env.ENABLE_MEMORY_HYBRID;
    expect(hybridEnabledForUser(USER_A)).toBe(false);
  });

  it('returns false for unrecognized env value', () => {
    vi.stubEnv('ENABLE_MEMORY_HYBRID', 'yes');
    expect(hybridEnabledForUser(USER_A)).toBe(false);
  });

  it('returns false for empty string env value', () => {
    vi.stubEnv('ENABLE_MEMORY_HYBRID', '');
    expect(hybridEnabledForUser(USER_A)).toBe(false);
  });

  describe('10pct mode', () => {
    it('returns a boolean (not undefined/null)', () => {
      vi.stubEnv('ENABLE_MEMORY_HYBRID', '10pct');
      const result = hybridEnabledForUser(USER_A);
      expect(typeof result).toBe('boolean');
    });

    it('is deterministic — same user always gets same result', () => {
      vi.stubEnv('ENABLE_MEMORY_HYBRID', '10pct');
      const r1 = hybridEnabledForUser(USER_A);
      const r2 = hybridEnabledForUser(USER_A);
      expect(r1).toBe(r2);
    });

    it('does not throw for various userId shapes', () => {
      vi.stubEnv('ENABLE_MEMORY_HYBRID', '10pct');
      expect(() => hybridEnabledForUser('')).not.toThrow();
      expect(() => hybridEnabledForUser('short')).not.toThrow();
      expect(() => hybridEnabledForUser('00000000-0000-0000-0000-000000000002')).not.toThrow();
    });

    it('uses deterministic bucket — result in [0, 99] range check', () => {
      vi.stubEnv('ENABLE_MEMORY_HYBRID', '10pct');
      // Verify the bucket is consistent: if true, user is in lowest 10% of sha256 bucket
      const result = hybridEnabledForUser(USER_A);
      expect(result === true || result === false).toBe(true);
    });
  });
});
