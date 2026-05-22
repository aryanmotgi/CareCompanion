/**
 * One-shot apply for migration 022_app_version_config.
 * Run with: tsx apps/web/scripts/apply-022.ts (env: AWS_* + AWS_RESOURCE_ARN + AWS_SECRET_ARN)
 */
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data'

const client = new RDSDataClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const COMMON = {
  database: 'carecompanion',
  secretArn: process.env.AWS_SECRET_ARN!,
  resourceArn: process.env.AWS_RESOURCE_ARN!,
}

async function exec(sql: string) {
  await client.send(new ExecuteStatementCommand({ ...COMMON, sql }))
}

async function main() {
  console.log('[022] creating app_version_config table…')
  await exec(`
    CREATE TABLE IF NOT EXISTS app_version_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const seeds: Array<[string, string]> = [
    ['min_ios_build', '1'],
    ['min_android_build', '1'],
    ['latest_build', '1'],
    ['kill_switch', 'false'],
    ['kill_reason', ''],
    ['message', ''],
  ]

  for (const [key, value] of seeds) {
    console.log(`[022] seed ${key}…`)
    await exec(
      `INSERT INTO app_version_config (key, value) VALUES ('${key}', '${value}') ON CONFLICT (key) DO NOTHING`,
    )
  }

  console.log('[022] verifying rows…')
  const verify = await client.send(
    new ExecuteStatementCommand({
      ...COMMON,
      sql: 'SELECT key, value FROM app_version_config ORDER BY key',
    }),
  )
  console.log(JSON.stringify(verify.records, null, 2))
  console.log('[022] done.')
}

main().catch((err) => {
  console.error('[022] FAILED:', err)
  process.exit(1)
})
