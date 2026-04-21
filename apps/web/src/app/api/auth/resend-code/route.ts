import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { parseBody } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/rate-limit'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

const resendLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 3,
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success } = await resendLimiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { body, error: bodyError } = await parseBody<{ email: string }>(req);
  if (bodyError) return bodyError;
  const { email } = body;
  try {
    await client.send(new ResendConfirmationCodeCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email,
    }))
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message || 'Failed to resend.' })
  }
}
