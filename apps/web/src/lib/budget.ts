import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

const DAILY_INPUT_CAP = 200_000;
const DAILY_OUTPUT_CAP = 50_000;

/**
 * Atomically reserves an estimated input token cost. Returns ok=false if
 * reservation would exceed the daily cap. The reservation prevents concurrent
 * chats from each passing a pre-write check. Reconcile in onFinish via
 * recordUsage().
 */
export async function reserveBudget(
  userId: string,
  estimatedInputTokens: number,
): Promise<{ ok: boolean; reason?: string }> {
  const result = await db.execute<{ total_input: number; output_tokens: number }>(sql`
    INSERT INTO user_usage (user_id, usage_date, reserved_input_tokens)
    VALUES (${userId}::uuid, CURRENT_DATE, ${estimatedInputTokens})
    ON CONFLICT (user_id, usage_date) DO UPDATE
      SET reserved_input_tokens = user_usage.reserved_input_tokens + ${estimatedInputTokens}
    RETURNING (user_usage.input_tokens + user_usage.reserved_input_tokens) AS total_input,
              user_usage.output_tokens AS output_tokens
  `);
  const r = result.rows[0];
  if (!r) return { ok: true };

  if (r.total_input > DAILY_INPUT_CAP) {
    await db.execute(sql`
      UPDATE user_usage
        SET reserved_input_tokens = GREATEST(0, reserved_input_tokens - ${estimatedInputTokens})
        WHERE user_id = ${userId}::uuid AND usage_date = CURRENT_DATE
    `);
    return { ok: false, reason: 'daily input token cap exceeded' };
  }
  if (r.output_tokens >= DAILY_OUTPUT_CAP) {
    await db.execute(sql`
      UPDATE user_usage
        SET reserved_input_tokens = GREATEST(0, reserved_input_tokens - ${estimatedInputTokens})
        WHERE user_id = ${userId}::uuid AND usage_date = CURRENT_DATE
    `);
    return { ok: false, reason: 'daily output token cap exceeded' };
  }
  return { ok: true };
}

/**
 * Records actual usage after a chat completes. Adds the real input cost and
 * subtracts the original estimate from the reservation.
 */
export async function recordUsage(
  userId: string,
  estimate: number,
  actual: {
    inputTokens: number;
    outputTokens: number;
    cacheRead: number;
    cacheCreate: number;
  },
): Promise<void> {
  await db.execute(sql`
    UPDATE user_usage SET
      input_tokens = input_tokens + ${actual.inputTokens},
      output_tokens = output_tokens + ${actual.outputTokens},
      cache_read_tokens = cache_read_tokens + ${actual.cacheRead},
      cache_create_tokens = cache_create_tokens + ${actual.cacheCreate},
      reserved_input_tokens = GREATEST(0, reserved_input_tokens - ${estimate}),
      model_calls = model_calls + 1
    WHERE user_id = ${userId}::uuid AND usage_date = CURRENT_DATE
  `);
}

/**
 * Naive token estimator — 4 chars ≈ 1 token. Used for reservations only;
 * actual usage from Anthropic response replaces the estimate in recordUsage.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
