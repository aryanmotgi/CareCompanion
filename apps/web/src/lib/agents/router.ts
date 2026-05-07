import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { SpecialistType } from './specialists';

const routingSchema = z.object({
  specialists: z.array(z.enum(['medication', 'insurance', 'scheduling', 'wellness', 'labs', 'general', 'trials']))
    .describe('Which specialist agents should handle this message. Can be multiple for complex queries.'),
  reasoning: z.string().describe('Brief reasoning for the routing decision'),
  is_complex: z.boolean().describe('Whether this needs multiple specialists working together'),
});

type RoutingOutput = z.infer<typeof routingSchema>;

const SIMPLE_PATTERN = /^(hi|hello|hey|thanks|thank you|thx|yes|no|yeah|nope|ok|okay|sure|great|good|sounds good|got it|👍|❤️|🙏|✅)[\s!.]*$/i;

function isSimpleMessage(message: string): boolean {
  const wordCount = message.trim().split(/\s+/).length;
  return wordCount < 15 && SIMPLE_PATTERN.test(message.trim());
}

/**
 * Route a user message to the appropriate specialist agent(s).
 * Uses Haiku for fast, cheap classification.
 */
export async function routeMessage(
  userMessage: string,
  conversationContext: string,
): Promise<{
  specialists: SpecialistType[];
  reasoning: string;
  isComplex: boolean;
}> {
  if (isSimpleMessage(userMessage)) {
    return { specialists: ['general'], reasoning: 'simple message', isComplex: false };
  }

  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      output: Output.object({ schema: routingSchema }),
      prompt: `You are a message router for a family caregiver AI assistant. Classify which specialist agent(s) should handle this message.

SPECIALISTS:
- medication: Drug interactions, dosages, refills, pharmacy, new/changed medications
- insurance: Claims, denials, appeals, prior auths, costs, FSA/HSA, EOBs
- scheduling: Appointments, visit prep, post-visit notes, follow-ups, calendar
- wellness: Symptoms, mood, sleep, pain, caregiver burnout, emotional support
- labs: Lab results, blood work, test interpretation, trends
- general: Profile updates, general questions, document analysis, multi-topic
- trials: trial, study, clinical trials, research studies, enrollment, trial eligibility, "find me trials", "am I eligible", "close to qualifying", "trial match"

RULES:
- Simple messages → 1 specialist
- Complex messages touching multiple domains → multiple specialists
- If unsure, include "general"
- "How are you" or greetings → general
- Emotional/stress messages → wellness (even if they mention other topics)

RECENT CONTEXT:
${conversationContext.slice(-2000)}

USER MESSAGE:
${userMessage}`,
    });

    const object = result.output as RoutingOutput;
    return {
      specialists: object.specialists as SpecialistType[],
      reasoning: object.reasoning,
      isComplex: object.is_complex,
    };
  } catch (error) {
    console.error('[router] classification failed:', error);
    return { specialists: ['general'], reasoning: 'Fallback due to error', isComplex: false };
  }
}
