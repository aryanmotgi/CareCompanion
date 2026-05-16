import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import { convoMemEnabledForUser, countSessionsForUser } from '@/lib/memory/convomem';

const USER_A = '00000000-0000-0000-0000-000000000001';
const USER_B = '00000000-0000-0000-0000-000000000002';

function mockSessionCount(n: number) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ n }]),
  };
  dbMock.select.mockReturnValueOnce(chain);
}

describe('countSessionsForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
  });

  it('returns row count from conversation_summaries', async () => {
    mockSessionCount(7);
    const n = await countSessionsForUser(USER_A);
    expect(n).toBe(7);
  });

  it('returns 0 on DB error (safe default)', async () => {
    dbMock.select.mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const n = await countSessionsForUser(USER_A);
    expect(n).toBe(0);
  });
});

describe('convoMemEnabledForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true for 0 sessions', async () => {
    mockSessionCount(0);
    expect(await convoMemEnabledForUser(USER_A)).toBe(true);
  });

  it('returns true for 29 sessions (under threshold)', async () => {
    mockSessionCount(29);
    expect(await convoMemEnabledForUser(USER_A)).toBe(true);
  });

  it('returns false for 30 sessions (at threshold)', async () => {
    mockSessionCount(30);
    expect(await convoMemEnabledForUser(USER_A)).toBe(false);
  });

  it('returns false for 100 sessions', async () => {
    mockSessionCount(100);
    expect(await convoMemEnabledForUser(USER_A)).toBe(false);
  });

  it('FORCE_HYBRID_USER_IDS override: returns false even with 0 sessions', async () => {
    vi.stubEnv('FORCE_HYBRID_USER_IDS', `${USER_A},${USER_B}`);
    // Should not need to query — override short-circuits.
    expect(await convoMemEnabledForUser(USER_A)).toBe(false);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('FORCE_HYBRID_USER_IDS with whitespace is tolerated', async () => {
    vi.stubEnv('FORCE_HYBRID_USER_IDS', ` ${USER_A} , ${USER_B} `);
    expect(await convoMemEnabledForUser(USER_A)).toBe(false);
  });

  it('FORCE_HYBRID_USER_IDS not containing the user → normal session-count gate runs', async () => {
    vi.stubEnv('FORCE_HYBRID_USER_IDS', USER_B);
    mockSessionCount(0);
    expect(await convoMemEnabledForUser(USER_A)).toBe(true);
  });

  it('empty FORCE_HYBRID_USER_IDS → normal session-count gate runs', async () => {
    vi.stubEnv('FORCE_HYBRID_USER_IDS', '');
    mockSessionCount(0);
    expect(await convoMemEnabledForUser(USER_A)).toBe(true);
  });
});
