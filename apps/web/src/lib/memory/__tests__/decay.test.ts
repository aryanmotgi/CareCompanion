import { describe, expect, it } from 'vitest';
import { decayForCategory } from '@/lib/memory/validators';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function approxDaysFromNow(d: Date): number {
  return Math.round((d.getTime() - Date.now()) / DAY);
}

describe('decayForCategory', () => {
  it('returns null for allergy (never decays)', () => {
    expect(decayForCategory('allergy', 'active')).toBeNull();
  });

  it('returns null for active condition', () => {
    expect(decayForCategory('condition', 'active')).toBeNull();
  });

  it('returns null for active medication', () => {
    expect(decayForCategory('medication', 'active')).toBeNull();
  });

  it('returns ~365 day TTL for lab_result', () => {
    const d = decayForCategory('lab_result', 'active');
    expect(d).not.toBeNull();
    expect(approxDaysFromNow(d as Date)).toBe(365);
  });

  it('returns ~180 day TTL for emotional_state', () => {
    const d = decayForCategory('emotional_state', 'active');
    expect(approxDaysFromNow(d as Date)).toBe(180);
  });

  it('returns ~180 day TTL for preference', () => {
    const d = decayForCategory('preference', 'active');
    expect(approxDaysFromNow(d as Date)).toBe(180);
  });

  it('returns ~90 day TTL for appointment', () => {
    const d = decayForCategory('appointment', 'active');
    expect(approxDaysFromNow(d as Date)).toBe(90);
  });

  it('returns null for provider (long-lived)', () => {
    expect(decayForCategory('provider', 'active')).toBeNull();
  });

  it('returns null for insurance', () => {
    expect(decayForCategory('insurance', 'active')).toBeNull();
  });

  it('returns null for family', () => {
    expect(decayForCategory('family', 'active')).toBeNull();
  });

  it('returns ~90 day TTL for "other"', () => {
    const d = decayForCategory('other', 'active');
    expect(approxDaysFromNow(d as Date)).toBe(90);
  });

  it('historical medication still returns null (handled by status filter not decay)', () => {
    expect(decayForCategory('medication', 'historical')).toBeNull();
  });

  it('unknown category falls back to 90d default', () => {
    const d = decayForCategory('unknown_cat', 'active');
    expect(approxDaysFromNow(d as Date)).toBe(90);
  });
});
