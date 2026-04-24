import { describe, it, expect } from 'vitest';
import { validateCheckin, sanitizeNotes } from '../checkin-validation';

describe('checkin validation', () => {
  it('rejects mood outside 1-5 range', () => {
    const result = validateCheckin({ mood: 6, pain: 3, energy: 'medium', sleep: 'good' });
    expect(result.success).toBe(false);
  });

  it('rejects pain outside 0-10 range', () => {
    const result = validateCheckin({ mood: 3, pain: 11, energy: 'medium', sleep: 'good' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid energy value', () => {
    const result = validateCheckin({ mood: 3, pain: 3, energy: 'super', sleep: 'good' });
    expect(result.success).toBe(false);
  });

  it('accepts valid check-in', () => {
    const result = validateCheckin({ mood: 4, pain: 3, energy: 'medium', sleep: 'good' });
    expect(result.success).toBe(true);
  });

  it('accepts valid check-in with notes', () => {
    const result = validateCheckin({ mood: 4, pain: 3, energy: 'medium', sleep: 'good', notes: 'Feeling okay' });
    expect(result.success).toBe(true);
  });

  it('rejects notes over 500 chars', () => {
    const result = validateCheckin({ mood: 4, pain: 3, energy: 'medium', sleep: 'good', notes: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('sanitizeNotes', () => {
  it('strips control characters', () => {
    expect(sanitizeNotes('Hello\x00World\x01Test')).toBe('HelloWorldTest');
  });

  it('caps at 500 chars', () => {
    expect(sanitizeNotes('a'.repeat(600)).length).toBe(500);
  });

  it('trims whitespace', () => {
    expect(sanitizeNotes('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(sanitizeNotes('')).toBe('');
  });
});
