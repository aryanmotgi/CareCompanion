import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as ai from 'ai';
import { extractFromConversation } from '@/lib/memory/extract';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof ai>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

const generateTextMock = vi.mocked(ai.generateText);

function mockFacts(facts: Array<{
  category: string; fact: string; confidence: string;
  polarity: string; status: string; subject: string; importance?: number;
}>) {
  generateTextMock.mockResolvedValueOnce({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output: { facts } as any,
    text: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage: {} as any,
    finishReason: 'stop',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('extractFromConversation', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it('"no penicillin allergy" → polarity=negated, status=active', async () => {
    mockFacts([{
      category: 'allergy',
      fact: 'patient has no penicillin allergy',
      confidence: 'high', polarity: 'negated', status: 'active',
      subject: 'patient', importance: 1.0,
    }]);
    const out = await extractFromConversation('mom has no penicillin allergy', '', []);
    expect(out[0].polarity).toBe('negated');
    expect(out[0].status).toBe('active');
  });

  it('"stopped Tamoxifen" → polarity=asserted, status=historical', async () => {
    mockFacts([{
      category: 'medication',
      fact: 'patient stopped taking Tamoxifen',
      confidence: 'high', polarity: 'asserted', status: 'historical',
      subject: 'patient', importance: 0.7,
    }]);
    const out = await extractFromConversation('mom stopped Tamoxifen last month', '', []);
    expect(out[0].polarity).toBe('asserted');
    expect(out[0].status).toBe('historical');
  });

  it('"refuses chemo" → status=denied', async () => {
    mockFacts([{
      category: 'medication',
      fact: 'patient refused chemo',
      confidence: 'high', polarity: 'asserted', status: 'denied',
      subject: 'patient', importance: 0.8,
    }]);
    const out = await extractFromConversation('mom refused chemo', '', []);
    expect(out[0].status).toBe('denied');
    expect(out[0].polarity).toBe('asserted');
  });

  it('"never had diabetes" → polarity=negated', async () => {
    mockFacts([{
      category: 'condition',
      fact: 'patient has never had diabetes',
      confidence: 'high', polarity: 'negated', status: 'active',
      subject: 'patient', importance: 0.5,
    }]);
    const out = await extractFromConversation('mom has never had diabetes', '', []);
    expect(out[0].polarity).toBe('negated');
  });

  it('caregiver-subject fact preserved', async () => {
    mockFacts([{
      category: 'emotional_state',
      fact: 'caregiver exhausted from 3 months of treatment',
      confidence: 'high', polarity: 'asserted', status: 'active',
      subject: 'caregiver', importance: 0.6,
    }]);
    const out = await extractFromConversation('I am exhausted from caring for her', '', []);
    expect(out[0].subject).toBe('caregiver');
  });

  it('empty facts list returns []', async () => {
    mockFacts([]);
    const out = await extractFromConversation('hello', '', []);
    expect(out).toEqual([]);
  });
});
