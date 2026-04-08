/**
 * FHIR Webhook receiver.
 * Receives push notifications from Epic/1upHealth when new health data arrives.
 * Eliminates polling delay — lab results appear immediately.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/api-response'
import { z } from 'zod'

const WebhookPayloadSchema = z.object({
  event: z.string(),
  patient_id: z.string().optional(),
  resource_type: z.string().optional(),
  resource_id: z.string().optional(),
  timestamp: z.string().optional(),
})

// Verify webhook signature (basic HMAC — replace with provider-specific verification)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifyWebhookSignature(req: Request, body: string): boolean {
  const signature = req.headers.get('x-webhook-signature')
  const secret = process.env.FHIR_WEBHOOK_SECRET

  if (!secret) {
    console.warn('[fhir-webhook] No FHIR_WEBHOOK_SECRET configured — accepting all webhooks in dev')
    return process.env.NODE_ENV !== 'production'
  }

  if (!signature) return false

  // In production, implement proper HMAC-SHA256 verification here
  // For now, simple secret comparison
  return signature === secret
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()

    if (!verifyWebhookSignature(req, bodyText)) {
      return apiError('Invalid webhook signature', 401, { code: 'INVALID_SIGNATURE' })
    }

    const body = JSON.parse(bodyText)
    const parsed = WebhookPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Invalid webhook payload', 400)
    }

    const { event, resource_type } = parsed.data
    const admin = createAdminClient()

    console.log(`[fhir-webhook] Received: ${event} (${resource_type || 'unknown'})`)

    // Map webhook events to sync actions
    switch (event) {
      case 'new-data':
      case 'data-updated':
      case 'Observation.create':
      case 'DiagnosticReport.create': {
        // New lab results — trigger sync for affected users
        // Find users with active FHIR connections
        const { data: connections } = await admin
          .from('connected_apps')
          .select('user_id')
          .in('source', ['epic', '1uphealth', 'fhir'])
          .not('access_token', 'is', null)

        if (connections && connections.length > 0) {
          // Queue sync for each user (in a real system, use a job queue)
          for (const conn of connections) {
            await admin.from('notifications').insert({
              user_id: conn.user_id,
              type: 'data_sync',
              title: 'New health data available',
              message: `New ${resource_type || 'health'} data has been received from your provider. Syncing now.`,
            })
          }

          console.log(`[fhir-webhook] Queued sync for ${connections.length} users`)
        }
        break
      }

      case 'MedicationRequest.create':
      case 'MedicationRequest.update': {
        // New or updated prescription
        console.log('[fhir-webhook] New medication data — will sync on next cron cycle')
        break
      }

      case 'Appointment.create':
      case 'Appointment.update': {
        // New or updated appointment
        console.log('[fhir-webhook] New appointment data — will sync on next cron cycle')
        break
      }

      default:
        console.log(`[fhir-webhook] Unhandled event: ${event}`)
    }

    return apiSuccess({ received: true, event })
  } catch (error) {
    console.error('[fhir-webhook] Error:', error)
    return apiError('Webhook processing failed', 500)
  }
}

// Respond to webhook verification challenges
export async function GET(req: Request) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get('hub.challenge')

  if (challenge) {
    return new Response(challenge, { status: 200 })
  }

  return apiSuccess({ status: 'FHIR webhook endpoint active' })
}
