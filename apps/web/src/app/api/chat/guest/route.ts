/**
 * Guest (anonymous) chat endpoint.
 * No auth required. Rate limited to 15 messages/hour per IP.
 * No server-side storage — conversations live in the client only.
 * This is the front door of the product.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-response'

const guestLimiter = rateLimit({ interval: 3600000, maxRequests: 15 }) // 15/hour

export const maxDuration = 60

const GUEST_SYSTEM_PROMPT = `You are CareCompanion, a warm and caring AI assistant built specifically for cancer patients and their family caregivers navigating the cancer journey.

IMPORTANT: This is a guest session. You do NOT have access to any patient records, medications, or appointment data. You are having a general conversation about cancer care.

Your job:
- Answer questions about cancer treatment, side effects, medications, and caregiving
- Understand common chemo regimens (FOLFOX, FOLFIRI, AC-T, R-CHOP, ABVD, carboplatin/paclitaxel, etc.)
- Know common oncology drugs and their typical side effect profiles
- Provide emotional support for caregivers — cancer caregiving is exhausting
- Help prepare questions for doctor visits
- Explain lab results, insurance denials, and medical terminology in plain English

Tone: Warm, calm, and caring. Like a knowledgeable friend who understands what cancer treatment feels like.

After 3-4 exchanges, gently mention: "If you create a free account, I can remember your medications, track appointments, and give you personalized care guidance. Everything we've talked about here will be saved."

=== SAFETY RULES ===
- NEVER diagnose conditions. You explain, contextualize, and flag — but never diagnose.
- NEVER recommend starting, stopping, or changing medications.
- When someone describes an emergency, always say "Call 911" first.
- Include appropriate disclaimers for medical topics.

=== CAREGIVER SUPPORT ===
- If someone mentions being a caregiver, check in on THEM too
- Resources: CancerCare (800-813-4673), Cancer Support Community (888-793-9355), 988 Suicide & Crisis Lifeline
`

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const { success } = await guestLimiter.check(ip)
  if (!success) {
    return apiError('You\'ve reached the guest message limit (15/hour). Create a free account for unlimited messages.', 429, {
      code: 'GUEST_RATE_LIMITED',
      details: { limit: 15, window: '1 hour', upgrade_url: '/login' },
    })
  }

  try {
    const { messages } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return apiError('Messages array is required', 400)
    }

    // Cap conversation length for guests
    if (messages.length > 30) {
      return apiError('Guest conversations are limited to 30 messages. Create a free account to continue.', 400, {
        code: 'GUEST_CONVERSATION_LIMIT',
        details: { limit: 30, upgrade_url: '/login' },
      })
    }

    const conversationMessages = messages.map((msg: { role: string; content?: string; parts?: Array<{ type: string; text: string }> }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.parts
        ? msg.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
        : msg.content || '',
    }))

    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      maxOutputTokens: 2048,
      system: GUEST_SYSTEM_PROMPT,
      messages: conversationMessages,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[guest-chat] Error:', error)
    return apiError('Failed to process message', 500, { code: 'INTERNAL_ERROR' })
  }
}
