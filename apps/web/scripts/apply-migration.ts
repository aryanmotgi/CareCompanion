/**
 * Apply a SQL migration file against the configured Aurora cluster via the
 * RDS Data API. Splits on bare `;` line endings (no in-string `;` handling —
 * keep migration files boringly formatted).
 *
 * Usage:
 *   bun apps/web/scripts/apply-migration.ts apps/web/src/lib/db/migrations/008-premium-care-os-tables.sql
 *
 * Requires AWS_REGION, AWS_RESOURCE_ARN, AWS_SECRET_ARN, DATABASE_NAME in env.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ExecuteStatementCommand, RDSDataClient } from '@aws-sdk/client-rds-data'

const file = process.argv[2]
if (!file) {
  console.error('Usage: bun apps/web/scripts/apply-migration.ts <path-to-sql>')
  process.exit(1)
}

const sql = readFileSync(resolve(file), 'utf8')

// Strip SQL line comments first, then split on `;` at line ends. This avoids
// the trap where a comment header at the top of a chunk causes the chunk
// (and its real SQL after the header) to be dropped.
const stripped = sql.replace(/^\s*--[^\n]*$/gm, '')
const statements = stripped
  .split(/;\s*(?:\n|$)/)
  .map(s => s.trim())
  .filter(s => s.length > 0)

const client = new RDSDataClient({ region: process.env.AWS_REGION })
const baseInput = {
  resourceArn: process.env.AWS_RESOURCE_ARN!,
  secretArn: process.env.AWS_SECRET_ARN!,
  database: process.env.DATABASE_NAME ?? 'carecompanion',
}

console.log(`[migrate] applying ${file} (${statements.length} statements)`)

let i = 0
for (const stmt of statements) {
  i++
  const preview = stmt.split('\n')[0].slice(0, 80)
  process.stdout.write(`[${i}/${statements.length}] ${preview}... `)
  try {
    await client.send(new ExecuteStatementCommand({ ...baseInput, sql: stmt }))
    console.log('ok')
  } catch (err) {
    console.log('FAIL')
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

console.log(`[migrate] done — ${statements.length} statements applied`)
