/**
 * One-time migration + backfill script.
 *
 * 1) Applies migration 011 — creates user_identities table + indexes.
 * 2) Backfills existing users:
 *    - users.passwordHash IS NOT NULL → identity row { provider:'password', providerSub:null, email }
 *    - users.providerSub IS NOT NULL AND passwordHash IS NULL → identity row { provider:'cognito', providerSub, email }
 *
 * Idempotent: existence guards make re-runs safe.
 *
 * Run from apps/web with env loaded:
 *   bun --env-file=.env.local scripts/backfill-identities.ts
 */
import { db } from '../src/lib/db'
import { users, userIdentities } from '../src/lib/db/schema'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'

async function applyMigration(): Promise<void> {
  console.log('[backfill] applying migration 011 …')
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_identities (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider     text NOT NULL,
      provider_sub text,
      email        text,
      created_at   timestamptz DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_sub_uniq
      ON user_identities (provider, provider_sub)
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_identities_user_provider_uniq
      ON user_identities (user_id, provider)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_identities_email_idx
      ON user_identities (email)
  `)
  console.log('[backfill] migration applied.')
}

async function backfillPasswordIdentities(): Promise<number> {
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(isNotNull(users.passwordHash))
  let inserted = 0
  for (const u of rows) {
    const existing = await db
      .select({ id: userIdentities.id })
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, u.id), eq(userIdentities.provider, 'password')))
      .limit(1)
    if (existing.length > 0) continue
    await db.insert(userIdentities).values({
      userId: u.id,
      provider: 'password',
      providerSub: null,
      email: u.email,
    })
    inserted++
  }
  return inserted
}

async function backfillCognitoIdentities(): Promise<number> {
  const rows = await db
    .select({ id: users.id, email: users.email, providerSub: users.providerSub })
    .from(users)
    .where(and(isNotNull(users.providerSub), isNull(users.passwordHash)))
  let inserted = 0
  for (const u of rows) {
    if (!u.providerSub) continue
    const existing = await db
      .select({ id: userIdentities.id })
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, u.id), eq(userIdentities.provider, 'cognito')))
      .limit(1)
    if (existing.length > 0) continue
    await db.insert(userIdentities).values({
      userId: u.id,
      provider: 'cognito',
      providerSub: u.providerSub,
      email: u.email,
    })
    inserted++
  }
  return inserted
}

async function main(): Promise<void> {
  await applyMigration()
  const pw = await backfillPasswordIdentities()
  const cog = await backfillCognitoIdentities()
  console.log(`[backfill] password identities inserted: ${pw}`)
  console.log(`[backfill] cognito identities inserted: ${cog}`)
  console.log('[backfill] done.')
}

main().catch((err) => {
  console.error('[backfill] failed:', err)
  process.exit(1)
})
