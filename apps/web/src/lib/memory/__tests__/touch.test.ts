import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Memory } from '@/lib/memory/types';

const { dbMock } = vi.hoisted(() => {
  const whereChain = { where: vi.fn().mockResolvedValue(undefined) };
  const setChain = { set: vi.fn().mockReturnValue(whereChain) };
  return {
    dbMock: {
      update: vi.fn().mockReturnValue(setChain),
      _whereChain: whereChain,
      _setChain: setChain,
    },
  };
});

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/schema', () => ({ memories: { id: 'id' } }));

import { touchReferencedMemories } from '@/lib/memory/touch';

function makeMem(id: string, fact: string): Memory {
  return {
    id,
    userId: 'user-1',
    careProfileId: null,
    category: 'medication',
    fact,
    source: 'conversation',
    confidence: 'high',
    createdAt: null,
    lastReferenced: null,
  };
}

const USER_ID = '00000000-0000-0000-0000-000000000001';

describe('touchReferencedMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const whereChain = { where: vi.fn().mockResolvedValue(undefined) };
    const setChain = { set: vi.fn().mockReturnValue(whereChain) };
    dbMock.update.mockReturnValue(setChain);
  });

  it('does not touch DB when mems list is empty', async () => {
    await touchReferencedMemories(USER_ID, 'patient takes metformin daily breakfast', []);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('does not touch DB when message has no keyword matches', async () => {
    const mem = makeMem('m1', 'Patient takes metformin daily at breakfast');
    await touchReferencedMemories(USER_ID, 'hello there', [mem]);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('does not touch DB with only 1 keyword match (threshold is 2)', async () => {
    // "metformin" (8 chars) is in both message and fact — but only 1 match, not 2
    const mem = makeMem('m1', 'Patient takes metformin daily');
    await touchReferencedMemories(USER_ID, 'asking about metformin only today', [mem]);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('touches memory when 2+ keywords match between message and fact', async () => {
    // "metformin" (9) and "breakfast" (9) both ≥5 chars, not in COMMON_WORDS
    const mem = makeMem('m1', 'Patient takes metformin daily at breakfast');
    await touchReferencedMemories(USER_ID, 'taking metformin before breakfast lately', [mem]);
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it('touches memory with medication entity match (drug Nmg pattern)', async () => {
    // "lisinopril 10mg" matches /\b([a-z]+)\s+\d+\s*mg\b/gi in both message and fact
    const mem = makeMem('m2', 'Patient prescribed lisinopril 10mg for hypertension');
    await touchReferencedMemories(USER_ID, 'is lisinopril 10mg causing dizziness?', [mem]);
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it('touches memory with doctor name entity match (Dr. pattern)', async () => {
    // "johnson" entity extracted from "Dr. Johnson" in both message and fact
    const mem = makeMem('m3', 'Dr. Johnson prescribed antibiotics last visit');
    await touchReferencedMemories(USER_ID, 'what did Dr. Johnson recommend?', [mem]);
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it('only touches memories that actually match, skipping others', async () => {
    const memA = makeMem('m-a', 'Patient takes metformin daily during breakfast time');
    const memB = makeMem('m-b', 'Unrelated fact about apples oranges bananas lemons grapes');
    // Message matches memA (metformin + breakfast) but not memB
    await touchReferencedMemories(USER_ID, 'taking metformin before breakfast daily', [memA, memB]);
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it('skips short words (<5 chars) in keyword matching', async () => {
    // "cat" (3) and "dog" (3) are too short — no match even if both in message and fact
    const mem = makeMem('m4', 'The cat and dog are fine today');
    await touchReferencedMemories(USER_ID, 'what about the cat and dog?', [mem]);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('skips common stop words in keyword matching', async () => {
    // "their" and "about" are in COMMON_WORDS — should not count
    const mem = makeMem('m5', 'about their condition which should would could');
    await touchReferencedMemories(USER_ID, 'asking about their conditions which could affect them', [mem]);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
