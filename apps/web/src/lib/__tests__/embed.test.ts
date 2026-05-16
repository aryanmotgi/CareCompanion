import { describe, it, expect } from 'vitest';
import { toHalfvecLiteral, embedText } from '@/lib/memory/embed';

describe('assertFiniteVector (via toHalfvecLiteral)', () => {
  it('rejects NaN', () => {
    const v = [1, NaN, 2, ...new Array(765).fill(0)];
    expect(() => toHalfvecLiteral(v)).toThrow(/NaN/);
  });
  it('rejects Infinity', () => {
    const v = [1, Infinity, 2, ...new Array(765).fill(0)];
    expect(() => toHalfvecLiteral(v)).toThrow(/NaN\/Infinity/);
  });
  it('rejects wrong dimension', () => {
    expect(() => toHalfvecLiteral([1, 2, 3])).toThrow(/length/);
  });
  it('produces halfvec literal for 768-d vector', () => {
    const v = new Array(768).fill(0).map((_, i) => i / 1000);
    const lit = toHalfvecLiteral(v);
    expect(lit.startsWith('[')).toBe(true);
    expect(lit.endsWith(']')).toBe(true);
  });
});

describe.skipIf(!process.env.GEMINI_API_KEY)('embedText (integration)', () => {
  it('returns 768-dim finite vector', async () => {
    const v = await embedText('Patient takes Tamoxifen 20mg daily');
    expect(v).toHaveLength(768);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
  });
});
