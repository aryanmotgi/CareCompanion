/**
 * Canary rollout monitor — checked by GitHub Actions cron every 6h.
 *
 * Reads ENABLE_MEMORY_HYBRID env on the Vercel prod project; when value is
 * "10pct" and the variable was last updated ≥ 48h ago, promotes to "true"
 * (after stop-condition checks pass).
 *
 * Outputs JSON to stdout; workflow parses status + reason to decide whether
 * to open a GitHub issue / log a heartbeat / do nothing.
 *
 * Required env:
 *   VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_ORG_ID
 *   AWS_REGION, AWS_RESOURCE_ARN, AWS_SECRET_ARN
 *     + AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or OIDC role)
 *   GH_REPO (owner/name) + GITHUB_TOKEN
 * Optional:
 *   CANARY_ABORT=true → force-abort, opens issue, no promotion
 */
import {
  RDSDataClient,
  ExecuteStatementCommand,
} from '@aws-sdk/client-rds-data';

type Status =
  | { kind: 'noop'; reason: string }
  | { kind: 'heartbeat'; ageHours: number; auditCount: number; modelCalls: number }
  | { kind: 'abort'; reason: string; details?: Record<string, unknown> }
  | { kind: 'promoted'; deployUrl?: string };

const TARGET_VALUE = '10pct';
const PROMOTE_AFTER_MS = 48 * 60 * 60 * 1000;

const VERCEL_TOKEN = required('VERCEL_TOKEN');
const VERCEL_PROJECT_ID = required('VERCEL_PROJECT_ID');
const VERCEL_ORG_ID = required('VERCEL_ORG_ID');

const AWS_REGION = required('AWS_REGION');
const AWS_RESOURCE_ARN = required('AWS_RESOURCE_ARN');
const AWS_SECRET_ARN = required('AWS_SECRET_ARN');

const GH_REPO = required('GH_REPO');
const GH_TOKEN = required('GITHUB_TOKEN');

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(2);
  }
  return v;
}

type VercelEnvVar = {
  id: string;
  key: string;
  value?: string;
  updatedAt: number;
  target: string[];
  type: string;
};

async function vercelApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://api.vercel.com${path}${sep}teamId=${VERCEL_ORG_ID}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function getHybridEnv(): Promise<VercelEnvVar | undefined> {
  const data = await vercelApi<{ envs: VercelEnvVar[] }>(
    `/v9/projects/${VERCEL_PROJECT_ID}/env?decrypt=true`,
  );
  return data.envs.find(
    (e) => e.key === 'ENABLE_MEMORY_HYBRID' && e.target.includes('production'),
  );
}

async function setHybridEnv(value: string): Promise<void> {
  const existing = await getHybridEnv();
  if (existing) {
    await vercelApi(
      `/v10/projects/${VERCEL_PROJECT_ID}/env/${existing.id}`,
      { method: 'DELETE' },
    );
  }
  await vercelApi(`/v10/projects/${VERCEL_PROJECT_ID}/env`, {
    method: 'POST',
    body: JSON.stringify({
      key: 'ENABLE_MEMORY_HYBRID',
      value,
      type: 'plain',
      target: ['production'],
    }),
  });
}

async function triggerDeploy(): Promise<string | undefined> {
  const project = await vercelApi<{ link?: { repoId?: string }; repo?: { repoId?: string } }>(
    `/v9/projects/${VERCEL_PROJECT_ID}`,
  );
  const repoId = project.link?.repoId ?? project.repo?.repoId;
  if (!repoId) {
    console.error('[canary-monitor] no linked git repo on project — skipping deploy');
    return undefined;
  }
  const dep = await vercelApi<{ url?: string }>(`/v13/deployments`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'carecompanion',
      target: 'production',
      gitSource: { type: 'github', repoId, ref: 'main' },
    }),
  });
  return dep.url;
}

const rds = new RDSDataClient({ region: AWS_REGION });

async function execScalar<T = unknown>(sqlText: string): Promise<T | null> {
  const out = await rds.send(
    new ExecuteStatementCommand({
      resourceArn: AWS_RESOURCE_ARN,
      secretArn: AWS_SECRET_ARN,
      database: process.env.DATABASE_NAME ?? 'carecompanion',
      sql: sqlText,
      includeResultMetadata: false,
    }),
  );
  const rec = out.records?.[0]?.[0];
  if (!rec) return null;
  if ('longValue' in rec) return rec.longValue as unknown as T;
  if ('stringValue' in rec) return rec.stringValue as unknown as T;
  if ('isNull' in rec && rec.isNull) return null;
  return null;
}

async function getAuditCount24h(): Promise<number> {
  return (
    (await execScalar<number>(
      `SELECT COUNT(*) FROM memory_access_log WHERE created_at > NOW() - INTERVAL '24 hours'`,
    )) ?? 0
  );
}

async function getModelCalls24h(): Promise<number> {
  return (
    (await execScalar<number>(
      `SELECT COALESCE(SUM(model_calls),0) FROM user_usage WHERE usage_date >= CURRENT_DATE - 1`,
    )) ?? 0
  );
}

type GhWorkflowRun = { conclusion: string | null; created_at: string; html_url: string };

async function recentSmokeFailures(): Promise<GhWorkflowRun[]> {
  const url = `https://api.github.com/repos/${GH_REPO}/actions/workflows/production-monitor.yml/runs?per_page=20`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    console.error(`[canary-monitor] gh workflows fetch failed: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { workflow_runs: GhWorkflowRun[] };
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return data.workflow_runs.filter(
    (r) => r.conclusion === 'failure' && new Date(r.created_at).getTime() > cutoff,
  );
}

async function main(): Promise<void> {
  const status = await decide();
  console.log(JSON.stringify(status));
  process.exit(0);
}

async function decide(): Promise<Status> {
  if (process.env.CANARY_ABORT === 'true') {
    return { kind: 'abort', reason: 'CANARY_ABORT env flag set' };
  }

  const env = await getHybridEnv();
  if (!env) {
    return { kind: 'noop', reason: 'ENABLE_MEMORY_HYBRID not set on production' };
  }
  if (env.value === 'true') {
    return { kind: 'noop', reason: 'already at 100% (value=true)' };
  }
  if (env.value !== TARGET_VALUE) {
    return { kind: 'noop', reason: `value="${env.value}" — not a canary state` };
  }

  const ageMs = Date.now() - env.updatedAt;
  const ageHours = Math.floor(ageMs / 3_600_000);

  const [auditCount, modelCalls, smokeFails] = await Promise.all([
    getAuditCount24h(),
    getModelCalls24h(),
    recentSmokeFailures(),
  ]);

  if (smokeFails.length > 0) {
    return {
      kind: 'abort',
      reason: `production-monitor.yml: ${smokeFails.length} failure(s) in last 24h`,
      details: { runs: smokeFails.slice(0, 5).map((r) => r.html_url) },
    };
  }

  // Audit-loss heuristic: if there was chat traffic but zero audit rows in 24h,
  // the fail-loud audit path is broken or memory load is silently bypassed.
  if (modelCalls > 5 && auditCount === 0) {
    return {
      kind: 'abort',
      reason: 'chat traffic present (model_calls>5) but no audit rows in last 24h',
      details: { modelCalls, auditCount },
    };
  }

  if (ageMs < PROMOTE_AFTER_MS) {
    return { kind: 'heartbeat', ageHours, auditCount, modelCalls };
  }

  // Promote
  await setHybridEnv('true');
  const deployUrl = await triggerDeploy();
  return { kind: 'promoted', deployUrl };
}

main().catch((e) => {
  console.error('[canary-monitor] fatal', e);
  console.log(JSON.stringify({ kind: 'abort', reason: `script error: ${(e as Error).message}` }));
  process.exit(0);
});
