import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hybridEnabledForUser } from '@/lib/memory/gate';

const ORIGINAL = process.env.ENABLE_MEMORY_HYBRID;
const U = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, '0')}`;

describe('hybridEnabledForUser', () => {
  beforeEach(() => {
    delete process.env.ENABLE_MEMORY_HYBRID;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ENABLE_MEMORY_HYBRID;
    else process.env.ENABLE_MEMORY_HYBRID = ORIGINAL;
  });

  it("'true' → always on", () => {
    process.env.ENABLE_MEMORY_HYBRID = 'true';
    for (let i = 0; i < 20; i++) expect(hybridEnabledForUser(U(i))).toBe(true);
  });

  it("'false' → always off", () => {
    process.env.ENABLE_MEMORY_HYBRID = 'false';
    for (let i = 0; i < 20; i++) expect(hybridEnabledForUser(U(i))).toBe(false);
  });

  it('unknown value → safe default off', () => {
    process.env.ENABLE_MEMORY_HYBRID = 'maybe';
    expect(hybridEnabledForUser(U(1))).toBe(false);
  });

  it('unset → safe default off', () => {
    expect(hybridEnabledForUser(U(1))).toBe(false);
  });

  it("'10pct' → deterministic per userId", () => {
    process.env.ENABLE_MEMORY_HYBRID = '10pct';
    const id = U(42);
    const a = hybridEnabledForUser(id);
    const b = hybridEnabledForUser(id);
    const c = hybridEnabledForUser(id);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("'10pct' → ~10% of 1000 random ids enabled (8-12%)", () => {
    process.env.ENABLE_MEMORY_HYBRID = '10pct';
    let on = 0;
    for (let i = 0; i < 1000; i++) {
      if (hybridEnabledForUser(U(i))) on++;
    }
    expect(on).toBeGreaterThanOrEqual(70);
    expect(on).toBeLessThanOrEqual(130);
  });
});
