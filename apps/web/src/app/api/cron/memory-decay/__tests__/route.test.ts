import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: { execute: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import { GET } from '@/app/api/cron/memory-decay/route';

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/cron/memory-decay', { headers });
}

describe('GET /api/cron/memory-decay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.execute.mockReset();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 without Bearer token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('returns 401 with wrong Bearer token', async () => {
    const res = await GET(makeReq('Bearer wrong'));
    expect(res.status).toBe(401);
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('soft-deletes expired rows on valid auth', async () => {
    dbMock.execute.mockResolvedValueOnce({ rowCount: 3 });

    const res = await GET(makeReq('Bearer test-secret'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, softDeleted: 3 });
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
  });

  it('SQL only touches rows where decay_at < NOW() AND valid_to IS NULL', async () => {
    dbMock.execute.mockResolvedValueOnce({ rowCount: 0 });

    await GET(makeReq('Bearer test-secret'));

    const call = dbMock.execute.mock.calls[0]?.[0] as {
      queryChunks?: Array<{ value?: unknown } | unknown>;
    };
    const sqlText = (call.queryChunks ?? [])
      .map((c) => {
        if (c && typeof c === 'object' && 'value' in c && Array.isArray((c as { value: unknown[] }).value)) {
          return ((c as { value: unknown[] }).value).join(' ');
        }
        return '';
      })
      .join(' ')
      .toLowerCase();

    expect(sqlText).toContain('update memories');
    expect(sqlText).toContain('valid_to');
    expect(sqlText).toContain('decay_at');
    expect(sqlText).toContain('now()');
  });

  it('idempotent: rowCount 0 on second run is ok', async () => {
    dbMock.execute.mockResolvedValueOnce({ rowCount: 0 });

    const res = await GET(makeReq('Bearer test-secret'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, softDeleted: 0 });
  });

  it('returns 500 on DB failure', async () => {
    dbMock.execute.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(makeReq('Bearer test-secret'));
    expect(res.status).toBe(500);
  });
});
