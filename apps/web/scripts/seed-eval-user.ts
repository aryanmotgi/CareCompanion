/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { embedText, toHalfvecLiteral } from '../src/lib/memory/embed';
import { EVAL_MEMORIES, EVAL_USER_ID, EVAL_PROFILE_ID } from '../src/lib/__tests__/memory.eval';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  await db.execute(sql`
    INSERT INTO users (id, email, display_name, hipaa_consent, role)
    VALUES (${EVAL_USER_ID}::uuid, 'eval@test.carecompanionai.org', 'Eval Caregiver', true, 'caregiver')
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO care_profiles (
      id, user_id, patient_name, cancer_type, cancer_stage, treatment_phase,
      allergies, conditions, onboarding_completed, role
    )
    VALUES (
      ${EVAL_PROFILE_ID}::uuid, ${EVAL_USER_ID}::uuid, 'Eleanor', 'Breast Cancer (HER2+)',
      'Stage 2', 'active_treatment', 'Penicillin, NSAIDs',
      'Hypertension, CKD stage 3', true, 'patient'
    )
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`DELETE FROM memories WHERE user_id = ${EVAL_USER_ID}::uuid`);

  console.log(`Embedding ${EVAL_MEMORIES.length} memories via Gemini (serial, 700ms gap to dodge free-tier RPM cap)...`);
  for (let i = 0; i < EVAL_MEMORIES.length; i++) {
    const m = EVAL_MEMORIES[i];
    const vec = await embedText(m.fact);
    const emb = toHalfvecLiteral(vec);
    if (i % 5 === 0) console.log(`  ${i + 1}/${EVAL_MEMORIES.length}`);
    await sleep(700);
    await db.execute(sql`
      INSERT INTO memories (
        user_id, care_profile_id, category, fact, polarity, status, subject,
        importance, tier, embedding, source, confidence, slug
      ) VALUES (
        ${EVAL_USER_ID}::uuid, ${EVAL_PROFILE_ID}::uuid, ${m.category}, ${m.fact},
        ${m.polarity}, ${m.status}, ${m.subject ?? 'patient'},
        ${String(m.importance)}::numeric, ${m.tier},
        ${emb}::halfvec, 'manual', 'high', ${m.slug}
      )
    `);
  }

  console.log(`Seeded ${EVAL_MEMORIES.length} memories for user ${EVAL_USER_ID}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
