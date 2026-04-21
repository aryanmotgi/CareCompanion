import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { routeMessage } from './router';
import { SPECIALISTS, type SpecialistType } from './specialists';
import { rateLimit } from '@/lib/rate-limit';

interface PatientContext {
  profile: Record<string, unknown> | null;
  medications: Record<string, unknown>[];
  doctors: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  labResults: Record<string, unknown>[];
  insurance: Record<string, unknown> | null;
  claims: Record<string, unknown>[];
  priorAuths: Record<string, unknown>[];
  fsaHsa: Record<string, unknown>[];
  memories: Record<string, unknown>[];
  symptoms: Record<string, unknown>[];
}

interface OrchestratorResult {
  specialistsUsed: Array<{ type: SpecialistType; name: string }>;
  agentOutputs: Record<string, string>;
  synthesizedContext: string;
  isMultiAgent: boolean;
}

/**
 * Orchestrate specialist agents for a user message.
 * Routes to specialists, runs them in parallel, and returns their outputs
 * for the main Claude instance to synthesize into a final response.
 */
export async function orchestrate(
  userMessage: string,
  conversationHistory: string,
  patientContext: PatientContext,
  userId: string,
): Promise<OrchestratorResult> {
  // Step 1: Route the message
  const routing = await routeMessage(userMessage, conversationHistory);

  // Step 2: If single simple specialist, skip the full orchestration
  if (!routing.isComplex && routing.specialists.length === 1 && routing.specialists[0] === 'general') {
    return {
      specialistsUsed: [],
      agentOutputs: {},
      synthesizedContext: '',
      isMultiAgent: false,
    };
  }

  // Step 2.5: Rate limit specialist calls (max 10 per user per minute)
  const agentRateKey = `agent:${userId}`
  const agentLimiter = rateLimit({ interval: 60000, maxRequests: 10 })
  const agentRateResult = await agentLimiter.check(agentRateKey)
  if (!agentRateResult.success) {
    console.warn(`[orchestrator] Agent rate limit hit for user ${userId}`)
    return {
      specialistsUsed: [],
      agentOutputs: {},
      synthesizedContext: '',
      isMultiAgent: false,
    }
  }

  // Cap at 3 specialists max per message to control costs
  const cappedSpecialists = routing.specialists.slice(0, 3)

  // Step 3: Run specialist agents in parallel
  const specialistPromises = cappedSpecialists.map(async (type) => {
    const config = SPECIALISTS[type];
    const relevantData = buildRelevantData(config.relevantDataKeys, patientContext);

    try {
      const { text } = await generateText({
        model: anthropic('claude-haiku-4.5'),
        system: config.systemPrompt,
        prompt: `PATIENT DATA:
${relevantData}

USER MESSAGE:
${userMessage}

CONVERSATION CONTEXT:
${conversationHistory.slice(-1000)}

Provide your specialist analysis. Be specific, reference the patient's actual data, and include any recommendations or flags from your domain. Keep it concise (3-5 key points max).`,
      });

      return { type, output: text };
    } catch (error) {
      console.error(`[orchestrator] ${type} specialist failed:`, error);
      return { type, output: '' };
    }
  });

  const results = await Promise.all(specialistPromises);

  // Step 4: Build the orchestrator result
  const agentOutputs: Record<string, string> = {};
  const specialistsUsed: OrchestratorResult['specialistsUsed'] = [];

  for (const { type, output } of results) {
    if (output) {
      const config = SPECIALISTS[type];
      agentOutputs[type] = output;
      specialistsUsed.push({ type, name: config.name });
    }
  }

  // Step 5: Build synthesized context for the main model
  let synthesizedContext = '';
  if (Object.keys(agentOutputs).length > 0) {
    synthesizedContext = '\n=== SPECIALIST AGENT ANALYSES ===\n';
    synthesizedContext += 'Multiple specialist agents have analyzed this query. Synthesize their insights into one cohesive, warm response.\n\n';

    for (const [type, output] of Object.entries(agentOutputs)) {
      const config = SPECIALISTS[type as SpecialistType];
      synthesizedContext += `[${config.name}]\n${output}\n\n`;
    }

    synthesizedContext += 'SYNTHESIS INSTRUCTIONS:\n';
    synthesizedContext += '- Weave the specialist insights together naturally — do NOT present them as separate sections\n';
    synthesizedContext += '- Lead with the most urgent/important information\n';
    synthesizedContext += '- Include all relevant disclaimers from each specialist\n';
    synthesizedContext += '- Maintain your warm, caring tone throughout\n';
    synthesizedContext += '- If specialists flag conflicting information, note it and recommend asking the doctor\n';
  }

  // Log multi-agent activity
  if (specialistsUsed.length > 1) {
    try {
      const { db } = await import('@/lib/db');
      const { memories } = await import('@/lib/db/schema');
      await db.insert(memories).values({
        userId,
        category: 'other',
        fact: `Multi-agent query handled by: ${specialistsUsed.map((s) => s.name).join(', ')}. Topic: ${userMessage.slice(0, 100)}`,
        source: 'conversation',
        confidence: 'high',
      });
    } catch { /* non-critical */ }
  }

  return {
    specialistsUsed,
    agentOutputs,
    synthesizedContext,
    isMultiAgent: specialistsUsed.length > 1,
  };
}

function buildRelevantData(keys: string[], context: PatientContext): string {
  const sections: string[] = [];

  for (const key of keys) {
    switch (key) {
      case 'profile':
        if (context.profile) sections.push(`Patient: ${JSON.stringify(context.profile)}`);
        break;
      case 'medications':
        if (context.medications.length) sections.push(`Medications: ${JSON.stringify(context.medications)}`);
        break;
      case 'doctors':
        if (context.doctors.length) sections.push(`Doctors: ${JSON.stringify(context.doctors)}`);
        break;
      case 'appointments':
        if (context.appointments.length) sections.push(`Appointments: ${JSON.stringify(context.appointments)}`);
        break;
      case 'labResults':
        if (context.labResults.length) sections.push(`Lab Results: ${JSON.stringify(context.labResults)}`);
        break;
      case 'insurance':
        if (context.insurance) sections.push(`Insurance: ${JSON.stringify(context.insurance)}`);
        break;
      case 'claims':
        if (context.claims.length) sections.push(`Claims: ${JSON.stringify(context.claims)}`);
        break;
      case 'priorAuths':
        if (context.priorAuths.length) sections.push(`Prior Auths: ${JSON.stringify(context.priorAuths)}`);
        break;
      case 'fsaHsa':
        if (context.fsaHsa.length) sections.push(`FSA/HSA: ${JSON.stringify(context.fsaHsa)}`);
        break;
      case 'conditions':
        if (context.profile) sections.push(`Conditions: ${(context.profile as Record<string, string>).conditions || 'None'}`);
        break;
      case 'allergies':
        if (context.profile) sections.push(`Allergies: ${(context.profile as Record<string, string>).allergies || 'None'}`);
        break;
      case 'memories':
        if (context.memories.length) sections.push(`Key memories: ${context.memories.map((m) => (m as Record<string, string>).fact).join('; ')}`);
        break;
      case 'symptoms':
        if (context.symptoms.length) sections.push(`Recent symptoms: ${JSON.stringify(context.symptoms)}`);
        break;
    }
  }

  return sections.join('\n') || 'No relevant data available.';
}
