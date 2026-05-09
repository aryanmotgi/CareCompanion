import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { routeMessage } from './router';
import { SPECIALISTS, type SpecialistType } from './specialists';
import { rateLimit } from '@/lib/rate-limit';

const agentLimiter = rateLimit({ interval: 60000, maxRequests: 10 });

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
  const emptyResult: OrchestratorResult = {
    specialistsUsed: [],
    agentOutputs: {},
    synthesizedContext: '',
    isMultiAgent: false,
  };

  // Step 1: Route the message
  const routing = await routeMessage(userMessage, conversationHistory);

  // Step 2: Fast path — single specialist, short message, not complex → Sonnet handles it alone
  const wordCount = userMessage.trim().split(/\s+/).length;
  if (!routing.isComplex && routing.specialists.length === 1 && wordCount < 20) {
    return emptyResult;
  }

  // Step 2.5: Rate limit specialist calls (max 10 per user per minute)
  const agentRateKey = `agent:${userId}`;
  const agentRateResult = await agentLimiter.check(agentRateKey);
  if (!agentRateResult.success) {
    console.warn(`[orchestrator] Agent rate limit hit for user ${userId}`);
    return emptyResult;
  }

  // Cap at 3 specialists max per message to control costs
  const cappedSpecialists = routing.specialists.slice(0, 3);

  // Step 3: Run specialist agents in parallel
  const specialistPromises = cappedSpecialists.map(async (type) => {
    const config = SPECIALISTS[type];
    const relevantData = buildRelevantData(config.relevantDataKeys, patientContext);

    const runSpecialist = async () => generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: config.systemPrompt,
      prompt: `PATIENT DATA:
${relevantData}

USER MESSAGE:
${userMessage}

CONVERSATION CONTEXT:
${conversationHistory.slice(-1000)}

Provide your specialist analysis. Be specific, reference the patient's actual data, and include any recommendations or flags from your domain. Keep it concise (3-5 key points max).`,
    });

    try {
      const { text } = await runSpecialist();
      return { type, output: text };
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        console.error(`[orchestrator] ${type} specialist failed (non-retryable ${status}):`, error);
        return { type, output: '' };
      }
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const { text } = await runSpecialist();
        return { type, output: text };
      } catch (retryError) {
        console.error(`[orchestrator] ${type} specialist failed after retry:`, retryError);
        return { type, output: '' };
      }
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
        if (context.medications.length) {
          const lines = context.medications.map((m) => {
            const med = m as Record<string, string>;
            return `- ${med.name ?? 'Unknown'} ${med.dose ?? ''} ${med.frequency ?? ''} (Dr. ${med.prescribingDoctor ?? 'Unknown'})`.trim();
          });
          sections.push(`Medications:\n${lines.join('\n')}`);
        }
        break;
      case 'doctors':
        if (context.doctors.length) {
          const lines = context.doctors.map((d) => {
            const doc = d as Record<string, string>;
            return `- ${doc.name ?? 'Unknown'} (${doc.specialty ?? 'Unknown'}) ${doc.phone ?? ''}`.trim();
          });
          sections.push(`Doctors:\n${lines.join('\n')}`);
        }
        break;
      case 'appointments':
        if (context.appointments.length) {
          const lines = context.appointments.map((a) => {
            const apt = a as Record<string, string>;
            return `- ${apt.doctorName ?? 'Unknown'} on ${apt.dateTime ?? 'TBD'} — ${apt.purpose ?? 'General visit'}`;
          });
          sections.push(`Appointments:\n${lines.join('\n')}`);
        }
        break;
      case 'labResults':
        if (context.labResults.length) {
          const lines = context.labResults.map((l) => {
            const lab = l as Record<string, string>;
            const abnormal = lab.isAbnormal === 'true' || lab.isAbnormal === '1' ? ' ⚠️ ABNORMAL' : '';
            return `- ${lab.testName ?? 'Unknown'}: ${lab.value ?? '?'} ${lab.unit ?? ''} (range: ${lab.referenceRange ?? 'N/A'})${abnormal}`;
          });
          sections.push(`Lab Results:\n${lines.join('\n')}`);
        }
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
      case 'cancerType':
        if (context.profile) sections.push(`Cancer Type: ${(context.profile as Record<string, string>).cancerType || 'Not recorded'}`);
        break;
      case 'cancerStage':
        if (context.profile) sections.push(`Cancer Stage: ${(context.profile as Record<string, string>).cancerStage || 'Not recorded'}`);
        break;
      case 'mutations':
        if (context.profile) sections.push(`Mutations: ${(context.profile as Record<string, string>).mutations || 'Not recorded'}`);
        break;
      case 'treatmentHistory': {
        const profile = context.profile as Record<string, string> | null;
        const phase = profile?.treatmentPhase ?? 'Unknown';
        const medCount = context.medications.length;
        sections.push(`Treatment History: Phase: ${phase} | ${medCount} active medication${medCount !== 1 ? 's' : ''}`);
        break;
      }
    }
  }

  return sections.join('\n') || 'No relevant data available.';
}
